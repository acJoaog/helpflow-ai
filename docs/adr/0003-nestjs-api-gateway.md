# ADR 0003: NestJS como framework do api-gateway

**Status:** aceita
**Data:** 2026-06-30
**Story relacionada:** US-101, US-102, US-103

## Contexto

O histórico de projetos anteriores usa Express de forma direta. Para o
`api-gateway`, que concentra autenticação, multi-tenancy e RBAC — áreas onde
organização em camadas (controller/service/guard/módulo) reduz erro humano —
avaliou-se trocar para NestJS.

## Decisão

Usar **NestJS** no `api-gateway`. Os demais serviços (tickets, ai-agent,
billing) serão avaliados individualmente — não é uma decisão que precisa se
propagar por padronização forçada; cada serviço pode usar a ferramenta mais
adequada ao seu papel.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não foi escolhida |
|---|---|---|---|
| Express direto | Familiaridade, menos boilerplate inicial | Estrutura de módulos/guards precisa ser construída manualmente; mais fácil misturar responsabilidades num serviço com regras de auth complexas | Não escolhida para este serviço especificamente |
| NestJS | Módulos, Guards e Decorators nativos mapeiam diretamente para os requisitos de auth/RBAC/multi-tenancy; injeção de dependência facilita testes unitários isolados; convenção clara para quem for ler o código (recrutador incluso) | Curva de aprendizado, mais boilerplate inicial | Escolhida — o ganho estrutural compensa o tempo de aprendizado, e demonstra capacidade de usar um framework opinativo corretamente |

## Consequências

- Guards do NestJS (`JwtAuthGuard`, `RolesGuard`) tornam RBAC declarativo via
  decorators (`@Roles('admin')`), reduzindo risco de esquecer uma checagem
  de permissão numa rota nova
- Testes unitários de `AuthService`/`TenantsService` ficam desacoplados do
  HTTP graças à injeção de dependência do Nest
- Introduz uma dependência a mais de aprendizado; documentar isso
  publicamente no README também serve como evidência de capacidade de
  aprender ferramentas novas rapidamente
