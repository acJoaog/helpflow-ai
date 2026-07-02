-- Row-Level Security real para isolamento de tenant.
-- Ver docs/adr/0001-multi-tenancy-rls.md e docs/adr/0004-rls-bypass-login.md.
--
-- Diferente da primeira tentativa (prisma/rls-policies.sql, removido nesta
-- migration), isto roda automaticamente via `prisma migrate deploy` — o
-- mesmo mecanismo já usado em produção pelo docker-entrypoint.sh — em vez
-- de depender de alguém rodar um script manualmente.

-- 1. Habilita RLS nas tabelas multi-tenant.
--    FORCE é necessário: por padrão, o dono da tabela (o próprio usuário
--    de aplicação, que criou as tabelas via migration) IGNORA as políticas
--    de RLS. Sem FORCE, RLS pareceria estar ativo mas não filtraria nada
--    para a própria aplicação — o cenário mais perigoso possível, porque
--    os testes dariam a falsa impressão de que o isolamento funciona.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites FORCE ROW LEVEL SECURITY;

-- 2. Política de isolamento: aplica-se a todos os comandos (SELECT/INSERT/
--    UPDATE/DELETE). Sem app.current_tenant setado na sessão, a expressão
--    avalia para NULL (não verdadeiro) e a tabela fica, na prática,
--    completamente inacessível — fail-closed, não fail-open.
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_invites ON invites
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

-- 3. Role dedicada para os dois únicos pontos do sistema em que é preciso
--    ler a tabela `users` ANTES de saber o tenant_id: login (busca por
--    e-mail) e renovação de refresh token (busca por user_id). Nenhuma
--    outra query do sistema deve usar esta role nem estas funções.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'helpflow_rls_bypass') THEN
    CREATE ROLE helpflow_rls_bypass NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

-- 4. Funções SECURITY DEFINER: rodam com o privilégio da role dona da
--    função (helpflow_rls_bypass, com BYPASSRLS), não com o privilégio de
--    quem chama. Cada uma retorna apenas as colunas estritamente
--    necessárias para autenticação — nunca a linha inteira — para limitar
--    o que um bug futuro nelas poderia expor.
CREATE OR REPLACE FUNCTION auth_lookup_user_by_email(p_email text)
RETURNS TABLE (
    id text,
    tenant_id text,
    password_hash text,
    role "Role"
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, tenant_id, password_hash, role
    FROM users
    WHERE email = lower(p_email)
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_lookup_user_by_id(p_user_id text)
RETURNS TABLE (
    id text,
    tenant_id text,
    role "Role"
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, tenant_id, role
    FROM users
    WHERE id = p_user_id
    LIMIT 1;
$$;

ALTER FUNCTION auth_lookup_user_by_email(text) OWNER TO helpflow_rls_bypass;
ALTER FUNCTION auth_lookup_user_by_id(text) OWNER TO helpflow_rls_bypass;

-- 5. CURRENT_USER aqui é o papel usado para aplicar a própria migration —
--    ou seja, o papel de conexão da aplicação (DATABASE_URL), o mesmo em
--    dev e produção. Evita hardcodar um nome de role específico.
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_email(text) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_id(text) TO CURRENT_USER;

-- Nota de operação (ambientes gerenciados): criar uma ROLE exige o
-- privilégio CREATEROLE. Em Postgres gerenciado (RDS, Cloud SQL etc.) onde
-- o usuário da aplicação não tem esse privilégio, o passo 3 deve ser
-- executado uma vez por um usuário administrativo antes do primeiro
-- `prisma migrate deploy` em produção.
