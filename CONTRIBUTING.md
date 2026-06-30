# Guia de contribuição

Mesmo sendo um projeto solo, este documento define as convenções usadas — o
objetivo é simular o processo de um time real e manter rastreabilidade entre
user stories, código e testes.

## Fluxo de trabalho

1. Toda mudança nasce de uma **issue** vinculada a uma user story (ver
   `docs/product-and-backlog.md`)
2. Criar uma branch a partir de `develop`:
   ```
   feature/US-301-agente-rag-resposta-automatica
   fix/US-201-erro-criacao-ticket
   chore/US-1001-configura-pipeline-ci
   ```
3. Commits seguem [Conventional Commits](https://www.conventionalcommits.org/),
   sempre referenciando o ID da story:
   ```
   feat(ai-agent): implementa resposta automática via RAG [US-301]
   fix(tickets): corrige race condition no status do ticket [US-203]
   test(auth): adiciona testes de isolamento de tenant [US-901]
   docs(readme): atualiza instruções de setup local
   ```
4. Abrir Pull Request para `develop` com:
   - Título referenciando o ID da story
   - Checklist dos critérios de aceitação da story (copiar de
     `docs/product-and-backlog.md`)
   - Descrição do que foi testado
5. CI precisa passar (lint, testes, build) antes do merge
6. Após merge, mover o card da issue para "Done" no board (ou deixar a
   automação do GitHub Projects fazer isso)

## Branches principais

- `main` — sempre estável, reflete produção
- `develop` — integração contínua das features em andamento

## Padrão de testes

- Toda nova funcionalidade precisa de teste automatizado cobrindo o critério
  de aceitação da story correspondente (ver seção 6 — Matriz de
  rastreabilidade — em `docs/product-and-backlog.md`)
- Rotas que lidam com dados sensíveis (multi-tenancy, auth) exigem teste de
  isolamento, não só teste de "caminho feliz"

## Architecture Decision Records (ADR)

Decisões técnicas relevantes (ex.: "por que RabbitMQ e não Kafka", "por que
row-level security e não schema por tenant") devem ser registradas em
`docs/adr/` usando o template em `docs/adr/0000-template.md`.
