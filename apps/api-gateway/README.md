# api-gateway

Serviço de autenticação, multi-tenancy e RBAC do HelpFlow AI. Ver:
- [ADR-0001](../../docs/adr/0001-multi-tenancy-rls.md) — multi-tenancy via RLS
- [ADR-0003](../../docs/adr/0003-nestjs-api-gateway.md) — escolha do NestJS
- [ADR-0004](../../docs/adr/0004-rls-bypass-login.md) — RLS forçado, bypass
  controlado no login e propagação automática de contexto de tenant

## Rotas implementadas

| Método | Rota | Story | Descrição |
|---|---|---|---|
| POST | `/auth/register-tenant` | US-101 | Cria tenant + usuário admin |
| POST | `/auth/login` | US-102 | Login, retorna access + refresh token |
| POST | `/auth/refresh` | US-102 | Rotaciona o refresh token |
| POST | `/auth/invite` | US-103 | Convida atendente (somente ADMIN) |

## Isolamento de tenant (Row-Level Security)

`users` e `invites` têm RLS **forçado** no Postgres — nenhuma query, nem
mesmo do próprio usuário de banco da aplicação, retorna linhas de outro
tenant sem o contexto correto setado. Isso é automático para toda rota
autenticada via `TenantContextInterceptor`; services usam `this.prisma.db`
(não `this.prisma` direto) para herdar esse contexto automaticamente.

Login e refresh de token são exceções necessárias — acontecem antes do
tenant ser conhecido — e passam por duas funções SQL `SECURITY DEFINER`
estreitas, nunca por um bypass geral. Detalhes completos no ADR-0004.

## Rodando localmente

```bash
pnpm install
cp ../../.env.example .env   # ajuste DATABASE_URL e JWT_SECRET
pnpm prisma:generate
pnpm prisma:migrate           # aplica schema + RLS (migration 20260701040000)
pnpm dev
```

## Testes

```bash
pnpm test          # unitários (mockam PrismaService/JwtService)
pnpm test:e2e       # e2e — requer Postgres rodando com as migrations aplicadas
```

Os testes e2e incluem uma prova direta de que o RLS bloqueia acesso
cross-tenant no nível do banco, não só confiado pelo código da aplicação
(ver `test/auth.e2e-spec.ts`).
