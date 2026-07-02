# ADR 0004: Row-Level Security forçado, bypass controlado no login e propagação automática de contexto de tenant

**Status:** aceita e implementada
**Data:** 2026-07-01
**Story relacionada:** US-101, US-102, US-903, US-901

## Contexto

O ADR-0001 definiu Row-Level Security (RLS) como estratégia de isolamento
multi-tenant, mas deixou a implementação real como um passo manual
(`prisma/rls-policies.sql`, para ser rodado à parte). Na prática, esse
script nunca chegou a ser executado contra o banco — o que significa que,
até agora, o isolamento de tenant dependia inteiramente do código da
aplicação lembrar de filtrar por `tenant_id` em toda query. Exatamente o
risco que o ADR-0001 já havia identificado como consequência a evitar.

Ao aplicar RLS de verdade, três problemas novos apareceram:

1. **Login e refresh de token** acontecem *antes* de sabermos o tenant do
   usuário — é a própria query que vai descobrir isso. Uma policy de RLS
   corretamente fail-closed bloqueia essas consultas por padrão.
2. **Dono da tabela ignora RLS por padrão.** `ENABLE ROW LEVEL SECURITY`
   sozinho não protege a própria aplicação, porque o usuário de banco da
   aplicação é o mesmo que criou as tabelas via migration (dono da tabela).
   Sem `FORCE ROW LEVEL SECURITY`, os testes dariam a falsa sensação de que
   o isolamento funciona, quando na verdade nunca foi exercitado.
3. **Propagar `app.current_tenant` manualmente em cada service** (como o
   `withTenantContext()` original exigia) é exatamente o tipo de disciplina
   que se perde com o tempo — basta um desenvolvedor futuro esquecer de
   envolver uma query nova.

## Decisão

**RLS com FORCE, aplicado via migration real (não script manual):**
`ALTER TABLE users/invites ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL
SECURITY`, com policy fail-closed (`USING`/`WITH CHECK` exigindo
`tenant_id = current_setting('app.current_tenant')`). Roda automaticamente
via `prisma migrate deploy` — o mesmo mecanismo já usado em produção pelo
`docker-entrypoint.sh` — eliminando a dependência de um passo manual.

**Bypass mínimo e auditável para login/refresh:** uma role dedicada
(`helpflow_rls_bypass`, `NOLOGIN NOINHERIT BYPASSRLS`) é dona de duas
funções `SECURITY DEFINER` — `auth_lookup_user_by_email` e
`auth_lookup_user_by_id` — que retornam apenas as colunas necessárias para
autenticar. A aplicação nunca recebe `BYPASSRLS` diretamente; só pode
executar essas duas funções específicas.

**Propagação automática do contexto de tenant:** um `TenantContextInterceptor`
global lê `request.user.tenantId` (populado pelo `JwtAuthGuard`) e abre uma
transação com `SET LOCAL app.current_tenant` para toda a duração do
request, guardando o client de transação num `AsyncLocalStorage`. Services
passam a usar `this.prisma.db` (não `this.prisma` direto) para automaticamente
herdar esse contexto — sem precisar chamar nada explicitamente request a
request.

**Criação de tenant** é o único fluxo que ainda usa `SET LOCAL` manual,
mas de forma segura: dentro da mesma transação em que o tenant é criado, o
`tenant_id` recém-gerado é setado antes do INSERT do usuário admin — não
precisa de bypass, porque o tenant que a policy exige já existe no momento
do INSERT.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não foi escolhida |
|---|---|---|---|
| Função `SECURITY DEFINER` estreita (login/refresh) | Bypass mínimo, auditável, limitado a 2 operações | Exige role adicional na migration | **Escolhida** — menor superfície de risco |
| Dar `BYPASSRLS` à role da aplicação | Simples | Anula RLS para TODAS as queries, não só login | Descartada — contradiz o propósito do RLS |
| Policy com `OR current_setting(...) IS NULL` | Não precisa de função extra | Qualquer query sem contexto setado (inclusive por bug) passaria a enxergar tudo | Descartada — risco de regressão silenciosa de segurança |
| `withTenantContext()` chamado manualmente por service | Simples de entender | Exige disciplina; um novo endpoint pode esquecer de usá-lo | Descartada como abordagem única — falha "aberta" quando esquecida |
| `AsyncLocalStorage` + interceptor global + `Prisma.TransactionClient` | Automática, nenhum service pode "esquecer" | Mantém uma transação aberta pela duração inteira do request autenticado | **Escolhida** — o interceptor cobre o caso comum; `withTenantContext`/lógica manual continua disponível para os poucos fluxos pré-auth |

## Consequências

- O isolamento de tenant agora é verificado de fato pelo Postgres, não só
  presumido pelo código da aplicação — coberto por teste e2e que tenta
  ler dados de outro tenant deliberadamente e confirma que retorna vazio
  (ver `test/auth.e2e-spec.ts`)
- **Trade-off aceito:** a transação por request fica aberta durante toda a
  execução do handler, não só das queries. Para os endpoints atuais (rápidos,
  majoritariamente de banco) isso é aceitável; se um serviço futuro passar a
  fazer chamadas externas lentas dentro de uma rota autenticada, vale
  revisitar (ex.: transação mais estreita dentro do próprio service)
- **Trade-off aceito, documentado explicitamente:** `refresh_tokens` não tem
  RLS baseado em `tenant_id` (a tabela não tem essa coluna — o isolamento
  vem do hash do token em si, um valor de 320 bits, criptograficamente
  inadequado de adivinhar). Se no futuro `refresh_tokens` passar a ter
  `tenant_id`, o mesmo padrão de RLS deve ser estendido a ela
- **Nota de deploy:** `CREATE ROLE` exige `CREATEROLE`. Em Postgres gerenciado
  onde o usuário de aplicação não tem esse privilégio, a criação da role
  `helpflow_rls_bypass` precisa ser feita uma vez por um usuário
  administrativo antes do primeiro `prisma migrate deploy` em produção
- CI agora sobe um serviço Postgres real e roda `prisma migrate deploy`
  antes dos testes e2e — sem isso, esta migration nunca seria de fato
  exercitada em pipeline, só localmente
