# ADR 0001: Estratégia de multi-tenancy via Row-Level Security

**Status:** aceita
**Data:** 2026-06-30
**Story relacionada:** US-101, US-901

## Contexto

O HelpFlow AI precisa isolar completamente os dados de cada empresa cliente
(tenant). Existem três estratégias clássicas: banco de dados separado por
tenant, schema separado por tenant, ou tabelas compartilhadas com uma coluna
`tenant_id` e Row-Level Security (RLS) no PostgreSQL.

Como portfólio, o objetivo é demonstrar profundidade técnica em segurança de
dados sem inviabilizar a operação de múltiplos tenants num único ambiente de
desenvolvimento/free tier de cloud.

## Decisão

Usar **tabelas compartilhadas com `tenant_id` e Row-Level Security nativa do
PostgreSQL**, aplicada via política de RLS por tabela e reforçada por uma
claim `tenant_id` no JWT, propagada em cada conexão de banco via
`SET app.current_tenant`.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não foi escolhida |
|---|---|---|---|
| Banco por tenant | Isolamento físico máximo | Custo e complexidade operacional alta (migração por tenant) | Inviável para portfólio com poucos recursos de infra |
| Schema por tenant | Bom isolamento lógico | Cresce mal além de algumas dezenas de tenants; migrações ficam complexas | Não demonstra a técnica mais usada em SaaS modernos de grande escala |
| Tabelas compartilhadas + RLS | Escalável, isolamento garantido no nível do banco, técnica usada por SaaS reais (Supabase, etc.) | Exige disciplina: toda query precisa do contexto de tenant configurado | Escolhida — melhor equilíbrio entre realismo de mercado e viabilidade |

## Consequências

- Toda migração do Prisma precisa incluir a política de RLS correspondente
- É obrigatório ter teste automatizado validando que uma query sem o
  `tenant_id` correto nunca retorna dado de outro tenant (US-901)
- Facilita demonstrar em entrevista o entendimento de isolamento de dados em
  SaaS multi-tenant, um tema recorrente em vagas backend/segurança
