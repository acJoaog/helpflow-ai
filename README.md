# HelpFlow AI

> Plataforma de helpdesk multi-tenant com agente de IA (RAG) para triagem e
> resposta automática de tickets de suporte.

[![CI](https://github.com/SEU_USUARIO/helpflow-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/SEU_USUARIO/helpflow-ai/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Sobre o projeto

PMEs pagam caro por ferramentas de helpdesk e raramente conseguem automatizar a
triagem de tickets. O HelpFlow AI resolve isso com um agente de IA que classifica
tickets, responde dúvidas frequentes usando a própria base de conhecimento da
empresa (RAG) e escala para um humano quando necessário.

Projeto desenvolvido como portfólio técnico, cobrindo o ciclo completo de
engenharia de software: API, clientes web e mobile, agente de IA, DevOps,
observabilidade e segurança em profundidade.

📄 Documentação completa de produto e backlog: [`docs/product-and-backlog.md`](./docs/product-and-backlog.md)

## Arquitetura

```
apps/
  api-gateway/       # Autenticação, rate limiting, roteamento multi-tenant
  tickets-service/    # Gestão de tickets em tempo real (WebSocket)
  ai-agent-service/   # Agente de IA com RAG e escalonamento
  billing-service/    # Cobrança e planos (Stripe)
  web/                 # Painel admin/atendente (React)
  mobile/              # App do atendente (React Native)

packages/
  shared-types/        # Tipos TypeScript compartilhados entre serviços
  eslint-config/        # Configuração de lint compartilhada

infra/
  docker/               # Dockerfiles e docker-compose
  k8s/                  # Manifests Kubernetes
  terraform/             # Infraestrutura como código
  jenkins/                # Pipeline CI/CD
  monitoring/             # Prometheus, Grafana, Loki

docs/
  architecture/           # Diagramas e decisões de arquitetura
  adr/                    # Architecture Decision Records
  product-and-backlog.md  # Modelo de negócio, personas, user stories
```

Diagrama detalhado da arquitetura: [`docs/architecture/`](./docs/architecture/).

## Stack técnica

- **Backend:** Node.js, Express/NestJS, Prisma, PostgreSQL + pgvector
- **IA:** Agente com tool use e RAG sobre base de conhecimento por tenant
- **Mensageria:** RabbitMQ
- **Web:** React
- **Mobile:** React Native
- **Infra:** Docker, Kubernetes, Terraform, Jenkins + GitHub Actions
- **Observabilidade:** Prometheus, Grafana, Loki
- **Testes:** Jest, Supertest, Playwright, k6

## Como rodar localmente

```bash
# Clonar o repositório
git clone https://github.com/SEU_USUARIO/helpflow-ai.git
cd helpflow-ai

# Instalar dependências (monorepo com workspaces)
pnpm install

# Subir infraestrutura local (Postgres, RabbitMQ, etc.)
docker compose -f infra/docker/docker-compose.yml up -d

# Rodar migrações
pnpm --filter api-gateway prisma migrate dev

# Subir os serviços em modo desenvolvimento
pnpm dev
```

> Pré-requisitos: Node.js 20+, pnpm, Docker e Docker Compose.

## Metodologia

O desenvolvimento segue Kanban com rastreabilidade completa entre user story,
implementação e teste. Veja o processo definido em
[`docs/product-and-backlog.md`](./docs/product-and-backlog.md#7-metodologia-ágil--kanban)
e o board público no GitHub Projects (link a adicionar).

## Licença

Distribuído sob a licença MIT. Veja [`LICENSE`](./LICENSE) para mais detalhes.
