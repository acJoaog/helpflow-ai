# ADR 0002: Automação do board Kanban — nativo vs. customizado

**Status:** aceita
**Data:** 2026-06-30
**Story relacionada:** US-1001 (processo de CI/CD e automação de workflow)

## Contexto

O GitHub Projects (v2) oferece automações nativas via "Workflows" no board,
mas elas cobrem apenas um conjunto fixo de gatilhos: `Item closed`,
`Item reopened`, `Pull request merged`, `Code review approved` e
`Auto-add/archive`. Não existe gatilho nativo para "PR aberta vinculada a uma
issue → mover status", que seria útil para refletir automaticamente quando
uma story entra em revisão de código.

Para cobrir esse gap, é possível escrever uma GitHub Action customizada que
usa a API GraphQL de Projects v2 (`updateProjectV2ItemFieldValue`) para mover
o item do board quando uma PR com `Closes #N` é aberta. Essa abordagem foi
prototipada (`.github/workflows/project-automation.yml`) e funciona, mas
exige:
- Um Personal Access Token com escopo `project` armazenado como secret
- Manutenção de uma Action customizada (nomes de coluna/campo hardcoded,
  sujeitos a quebrar se o board for reorganizado)
- Superfície de permissão adicional num repositório de portfólio público

## Decisão

Usar **apenas as automações nativas do GitHub Projects** (`Item closed → Done`
e `Pull request merged → Done`). A transição para "Em Progresso" e
"Code Review / QA" é feita **manualmente**, movendo o card no momento em que
o trabalho realmente começa ou a PR é aberta.

A Action customizada para mover "PR aberta → Code Review" foi descartada
como prática padrão, mas o código permanece no repositório como referência
técnica (não habilitado por padrão).

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não foi escolhida |
|---|---|---|---|
| Automação nativa apenas | Zero manutenção, zero superfície de credencial extra, suficiente pra refletir o estado real do trabalho | Duas transições (Em Progresso, Code Review) exigem ação manual | Escolhida — custo de 2 cliques por story é desprezível frente ao risco/manutenção de uma Action customizada |
| Action customizada via GraphQL | Automação completa do fluxo, board sempre sincronizado sem intervenção | Exige PAT com escopo `project` como secret; lógica acoplada a nomes de coluna/campo; ponto extra de falha em CI | Não escolhida como padrão — over-engineering para o ganho que traz num projeto solo |
| Ferramenta de terceiros (ex. Zenhub, Linear sync) | Automação rica, UI dedicada | Introduz dependência externa e custo, foge do objetivo de demonstrar uso nativo do ecossistema GitHub | Não escolhida — não agrega ao objetivo de portfólio |

## Consequências

- O board reflete o estado real do trabalho com uma pequena dose de
  disciplina manual (mover o card ao iniciar/abrir PR), que é exatamente o
  comportamento esperado de um processo Kanban bem aplicado — a automação
  resolve o que é mecânico (fechar = done), não o julgamento de quando uma
  story está "em progresso"
- Reduz a superfície de segurança do repositório (sem PAT de projeto
  circulando como secret)
- Caso o projeto cresça para múltiplos colaboradores no futuro, esta decisão
  deve ser revisitada — automação completa passa a valer mais a pena quando
  o board é mantido por mais de uma pessoa
