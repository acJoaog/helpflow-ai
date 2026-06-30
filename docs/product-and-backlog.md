# HelpFlow AI — Modelo de Negócio, Backlog e Metodologia Ágil

> Documento de produto do projeto de portfólio. Cobre modelo de negócio, personas,
> epics, backlog de user stories com rastreabilidade e definição do processo ágil (Kanban).
> Este arquivo deve viver em `docs/product-and-backlog.md` no repositório.

---

## 1. Visão geral do produto

**Nome do produto:** HelpFlow AI
**Problema:** PMEs (pequenas e médias empresas) pagam caro por ferramentas de helpdesk
(Zendesk, Intercom, Freshdesk) e raramente conseguem configurar automação de triagem
decente. Times pequenos de suporte perdem tempo respondendo perguntas repetitivas que
já estão documentadas na própria base de conhecimento da empresa.

**Solução:** Plataforma de helpdesk multi-tenant com um agente de IA que classifica
tickets automaticamente, responde dúvidas frequentes usando RAG sobre a base de
conhecimento da própria empresa, e escala para um atendente humano quando a confiança
da resposta é baixa ou o cliente pede explicitamente.

**Diferencial:** não é "mais um chatbot com prompt fixo" — o agente tem acesso a
ferramentas (consultar histórico do cliente, buscar artigos, abrir ticket, verificar
status de assinatura) e decide quando agir sozinho e quando escalar.

---

## 2. Modelo de negócio (Lean Canvas)

| Bloco | Conteúdo |
|---|---|
| **Segmento de clientes** | PMEs B2B com equipe de suporte de 2 a 30 atendentes (SaaS, e-commerce, fintechs pequenas) |
| **Problema** | Alto custo de ferramentas de helpdesk; triagem manual lenta; conhecimento institucional não reaproveitado |
| **Proposta de valor** | Reduzir tempo médio de primeira resposta em até 70% com triagem e respostas automáticas por IA, mantendo controle humano sobre casos sensíveis |
| **Solução** | Helpdesk multi-tenant + agente de IA com RAG + escalonamento inteligente |
| **Canais** | Site institucional, marketplace de integrações (Slack, WhatsApp Business), indicação |
| **Fontes de receita** | Assinatura recorrente por faixas de uso (ver seção 2.1) |
| **Estrutura de custos** | Infraestrutura cloud (compute + banco), custo de tokens de IA por chamada, suporte ao cliente |
| **Métricas-chave** | Tempo médio de primeira resposta, % de tickets resolvidos sem humano, churn mensal, NPS |
| **Vantagem injusta** | Base de conhecimento de cada tenant treina o agente daquele tenant — quanto mais a empresa usa, melhor o agente fica para ela especificamente |

### 2.1 Planos de assinatura

| Plano | Público | Limite de agentes | Tickets IA/mês | Preço (ilustrativo) |
|---|---|---|---|---|
| Starter | Times de 1–5 atendentes | 5 | 500 | R$ 99/mês |
| Growth | Times de 6–15 atendentes | 15 | 3.000 | R$ 349/mês |
| Scale | Times de 16–30 atendentes | 30 | 10.000 | R$ 899/mês |

---

## 3. Personas

**1. Camila — Gestora de suporte (Admin)**
Configura a equipe, define políticas de escalonamento, acompanha métricas e cuida da
base de conhecimento. Quer reduzir custo operacional sem perder qualidade de atendimento.

**2. Diego — Atendente**
Resolve tickets escalados pela IA ou abertos diretamente. Trabalha boa parte do tempo
fora da mesa, por isso depende do app mobile. Quer contexto completo do ticket sem
precisar repetir perguntas já respondidas pela IA.

**3. Marina — Cliente final**
Abre um ticket esperando resposta rápida. Não se importa se quem responde é IA ou
humano, desde que resolva o problema.

---

## 4. Epics

| ID | Epic | Componente arquitetural relacionado |
|---|---|---|
| E1 | Autenticação e multi-tenancy | API Gateway |
| E2 | Gestão de tickets | Serviço de Tickets |
| E3 | Agente de IA com RAG | Serviço de Agente de IA |
| E4 | Base de conhecimento | PostgreSQL + pgvector |
| E5 | Cobrança e planos | Serviço de Cobrança |
| E6 | Painel web (admin/atendente) | Painel web |
| E7 | App mobile do atendente | App mobile |
| E8 | Observabilidade e confiabilidade | Infra/DevOps |
| E9 | Segurança e compliance | Transversal |
| E10 | CI/CD e infraestrutura | Infra/DevOps |

---

## 5. Product Backlog (User Stories)

Formato: `Como [persona], eu quero [ação], para que [benefício]`
Prioridade segue MoSCoW (**M**ust, **S**hould, **C**ould, **W**on't-now).
Estimativa em pontos (escala Fibonacci: 1, 2, 3, 5, 8, 13).

### Epic 1 — Autenticação e multi-tenancy

| ID | User Story | Critério de aceitação (Gherkin resumido) | Prioridade | Pontos |
|---|---|---|---|---|
| US-101 | Como gestora, quero criar uma conta de empresa (tenant), para que minha equipe tenha um espaço isolado | Dado um e-mail corporativo válido, quando cadastro a empresa, então um tenant isolado é criado com schema/linha própria | M | 5 |
| US-102 | Como atendente, quero fazer login com e-mail e senha, para acessar apenas os dados do meu tenant | Dado um login válido, então recebo um JWT escopado ao tenant_id; tentar acessar dado de outro tenant retorna 403 | M | 3 |
| US-103 | Como gestora, quero convidar atendentes por e-mail com papéis definidos (admin/atendente), para controlar permissões | Dado um convite enviado, quando o atendente aceita, então ele recebe o papel definido e RBAC é aplicado em todas as rotas | M | 5 |
| US-104 | Como usuária, quero recuperar minha senha com segurança, para não perder acesso à conta | Token de reset expira em 15 min e é de uso único | S | 2 |
| US-105 | Como gestora, quero habilitar login social (OAuth2), para reduzir fricção de onboarding | Login via Google funciona e vincula ao tenant correto | C | 5 |

### Epic 2 — Gestão de tickets

| ID | User Story | Critério de aceitação | Prioridade | Pontos |
|---|---|---|---|---|
| US-201 | Como cliente final, quero abrir um ticket descrevendo meu problema, para receber ajuda | Ticket criado com status "novo" e associado ao tenant correto | M | 3 |
| US-202 | Como atendente, quero ver a fila de tickets em tempo real, para priorizar atendimentos | Novo ticket aparece no painel via WebSocket sem reload | M | 5 |
| US-203 | Como atendente, quero responder um ticket e ver a resposta refletida instantaneamente para o cliente | Latência de entrega da mensagem < 1s em condição normal | M | 5 |
| US-204 | Como gestora, quero definir SLAs por prioridade, para garantir tempo de resposta | Ticket vencido muda visualmente de status e gera alerta | S | 5 |
| US-205 | Como atendente, quero ver o histórico completo do cliente (tickets anteriores), para dar contexto à resposta | Histórico carrega em uma única consulta, sem N+1 | S | 3 |

### Epic 3 — Agente de IA com RAG

| ID | User Story | Critério de aceitação | Prioridade | Pontos |
|---|---|---|---|---|
| US-301 | Como cliente final, quero receber uma resposta automática quando minha dúvida já está documentada, para não esperar um humano | IA responde em < 5s usando artigos da base com similaridade > limiar definido | M | 13 |
| US-302 | Como gestora, quero que o agente escale para humano quando não tiver confiança na resposta, para evitar respostas erradas | Score de confiança abaixo do limiar dispara escalonamento automático com justificativa registrada | M | 8 |
| US-303 | Como atendente, quero ver o raciocínio resumido do agente antes de assumir um ticket escalado, para não perder contexto | Painel mostra resumo gerado pelo agente: o que já foi tentado, por que escalou | S | 5 |
| US-304 | Como gestora, quero ver métricas de quantos tickets a IA resolveu sozinha, para medir ROI | Dashboard mostra % de auto-resolução por período | S | 3 |
| US-305 | Como cliente final, quero poder pedir explicitamente para falar com um humano, para casos sensíveis | Comando do usuário força escalonamento independentemente do score | M | 2 |

### Epic 4 — Base de conhecimento

| ID | User Story | Critério de aceitação | Prioridade | Pontos |
|---|---|---|---|---|
| US-401 | Como gestora, quero cadastrar artigos de ajuda, para alimentar o agente de IA | Artigo salvo gera embedding automaticamente via job assíncrono | M | 5 |
| US-402 | Como gestora, quero importar uma base de conhecimento existente (CSV/Markdown), para não recadastrar tudo manualmente | Importação em lote processa N artigos e reporta falhas individualmente | C | 5 |
| US-403 | Como gestora, quero ver quais artigos nunca são usados pelo agente, para revisar conteúdo desatualizado | Relatório de uso de artigos por período | C | 3 |

### Epic 5 — Cobrança e planos

| ID | User Story | Critério de aceitação | Prioridade | Pontos |
|---|---|---|---|---|
| US-501 | Como gestora, quero assinar um plano com cartão de crédito, para ativar a conta | Integração com Stripe Checkout cria assinatura e libera o tenant | M | 5 |
| US-502 | Como gestora, quero ser bloqueada de criar novos atendentes ao atingir o limite do plano, para respeitar o contrato | Tentativa acima do limite retorna erro claro com sugestão de upgrade | S | 3 |
| US-503 | Como gestora, quero ver minha fatura e histórico de pagamentos, para controle financeiro | Listagem paginada de faturas via Stripe API | S | 3 |

### Epic 6 — Painel web

| ID | User Story | Critério de aceitação | Prioridade | Pontos |
|---|---|---|---|---|
| US-601 | Como gestora, quero um dashboard com métricas-chave, para acompanhar a operação | Cards de tempo médio de resposta, % auto-resolução, tickets abertos | M | 5 |
| US-602 | Como atendente, quero filtrar e buscar tickets, para encontrar casos específicos rápido | Busca por status, prioridade, cliente, com resposta < 300ms em base de teste | S | 3 |

### Epic 7 — App mobile do atendente

| ID | User Story | Critério de aceitação | Prioridade | Pontos |
|---|---|---|---|---|
| US-701 | Como atendente, quero receber push notification de ticket escalado, para responder mesmo fora do computador | Notificação chega em até 10s após escalonamento | M | 8 |
| US-702 | Como atendente, quero responder um ticket pelo celular, para não depender do desktop | Funcionalidade de resposta com paridade mínima do painel web | M | 8 |

### Epic 8 — Observabilidade e confiabilidade

| ID | User Story | Critério de aceitação | Prioridade | Pontos |
|---|---|---|---|---|
| US-801 | Como desenvolvedor, quero métricas de latência e erro de cada serviço, para identificar gargalos | Dashboards Grafana com p50/p95/p99 por serviço | M | 5 |
| US-802 | Como desenvolvedor, quero logs centralizados e correlacionáveis por request, para depurar incidentes | Trace ID propagado entre serviços e visível no Loki/Grafana | S | 5 |
| US-803 | Como desenvolvedor, quero alertas automáticos quando a taxa de erro passar de um limiar, para reagir antes do cliente notar | Alerta disparado via webhook em até 1 min após o limiar ser ultrapassado | C | 3 |

### Epic 9 — Segurança e compliance

| ID | User Story | Critério de aceitação | Prioridade | Pontos |
|---|---|---|---|---|
| US-901 | Como gestora, quero garantir que dados de um tenant nunca vazem para outro, para confiança do cliente | Testes automatizados de isolamento (row-level security) cobrindo todas as rotas sensíveis | M | 8 |
| US-902 | Como gestora, quero exportar e excluir os dados da minha empresa, para conformidade com LGPD | Exportação completa em JSON e exclusão lógica/física conforme política | S | 5 |
| US-903 | Como desenvolvedor, quero rate limiting por tenant e por IP, para mitigar abuso e ataques de força bruta | Requisições acima do limite retornam 429 com header de retry | M | 3 |
| US-904 | Como gestora, quero um log de auditoria de ações administrativas, para rastrear mudanças sensíveis | Toda ação de admin (criar/remover atendente, mudar plano) é registrada de forma imutável | S | 3 |

### Epic 10 — CI/CD e infraestrutura

| ID | User Story | Critério de aceitação | Prioridade | Pontos |
|---|---|---|---|---|
| US-1001 | Como desenvolvedor, quero pipeline de CI que rode testes a cada push, para evitar regressões | Pipeline Jenkins/GitHub Actions roda lint + testes + build em < 10 min | M | 5 |
| US-1002 | Como desenvolvedor, quero deploy automatizado para ambiente de staging, para validar antes de produção | Merge na branch develop dispara deploy automático em staging | S | 5 |
| US-1003 | Como desenvolvedor, quero infraestrutura como código, para recriar o ambiente de forma reprodutível | `terraform apply` provisiona toda a infra base sem passos manuais | C | 8 |

---

## 6. Matriz de rastreabilidade

A rastreabilidade liga **necessidade de negócio → epic → user story → implementação técnica → teste**.
Use esta tabela (ou uma planilha derivada dela) como referência ao abrir Pull Requests.

| Epic | User Story | Componente técnico | Tipo de teste de cobertura |
|---|---|---|---|
| E1 | US-101, US-102, US-103 | API Gateway, módulo `auth` | Testes unitários (Jest) + E2E de isolamento de tenant |
| E2 | US-201, US-202, US-203 | Serviço `tickets`, WebSocket gateway | Testes de integração (Supertest) + teste de carga (k6) |
| E3 | US-301, US-302, US-303 | Serviço `ai-agent`, integração RAG | Testes de contrato com mocks do LLM + avaliação de qualidade de resposta |
| E4 | US-401, US-402 | Job de embeddings, pgvector | Testes unitários do pipeline de ingestão |
| E5 | US-501, US-502 | Serviço `billing`, webhook Stripe | Testes de integração com Stripe (modo sandbox) |
| E8 | US-801, US-802 | Stack Prometheus/Grafana/Loki | Validação manual de dashboards + teste de alerta sintético |
| E9 | US-901, US-903 | Row-level security, middleware de rate limit | Testes de segurança automatizados (isolamento, brute force) |
| E10 | US-1001, US-1003 | Jenkinsfile, GitHub Actions, Terraform | Pipeline validado em ambiente de staging |

**Convenção de rastreabilidade no código:**
- Branch: `feature/US-301-agente-rag-resposta-automatica`
- Commit: `feat(ai-agent): implementa resposta automática via RAG [US-301]`
- Pull Request: título referencia o ID da story; descrição lista critérios de aceitação como checklist
- Issue no GitHub Projects: campo customizado `Epic` + `Story ID` para permitir filtros e relatórios

---

## 7. Metodologia ágil — Kanban

### 7.1 Colunas do board

| Coluna | WIP limit | Critério de entrada |
|---|---|---|
| Backlog | — | Story escrita, sem priorização definida |
| Refinamento | 5 | Critérios de aceitação definidos, story estimada |
| A Fazer | 3 | Story priorizada para o ciclo atual |
| Em Progresso | 2 | Branch criada, desenvolvimento ativo |
| Code Review / QA | 3 | PR aberto, aguardando revisão própria ou testes automatizados |
| Done | — | Mergeado, testado, sem pendência de documentação |

WIP limits baixos fazem sentido especialmente em projeto solo: o objetivo é evitar
abrir 6 frentes ao mesmo tempo e não terminar nenhuma — uma prática que você pode
citar em entrevista como decisão consciente, não só "regra do Kanban".

### 7.2 Definition of Ready (DoR)
Uma story só entra em "A Fazer" se:
- Tem critérios de aceitação escritos (Gherkin ou checklist)
- Está vinculada a um epic
- Tem estimativa de pontos
- Não depende de outra story ainda não concluída

### 7.3 Definition of Done (DoD)
Uma story só vai para "Done" se:
- Código mergeado na branch principal
- Testes automatizados cobrindo o critério de aceitação, passando no CI
- Documentação técnica atualizada (se aplicável)
- Sem pendência de segurança conhecida (ex.: rota sem RBAC)

### 7.4 Cadência (adaptada para projeto solo)
Sem time, as cerimônias tradicionais viram checkpoints pessoais — mas vale manter o
hábito porque é exatamente isso que se espera demonstrar em entrevista:
- **Planejamento semanal** (30 min): revisar backlog, mover 3–5 stories para "A Fazer"
- **Revisão de meio de semana** (15 min): checar WIP, destravar bloqueios
- **Retrospectiva quinzenal** (20 min): registrar no `CHANGELOG.md` ou em um `docs/retro.md`
  o que funcionou, o que não funcionou, e um ajuste de processo para o próximo ciclo

### 7.5 Setup recomendado no GitHub Projects
- Criar um **GitHub Project (board)** vinculado ao repositório
- Labels: `epic:E1` ... `epic:E10`, `priority:must`, `priority:should`, `priority:could`,
  `type:feature`, `type:bug`, `type:security`, `type:infra`
- Issue template (`.github/ISSUE_TEMPLATE/user-story.md`) com campos: persona, ação,
  benefício, critérios de aceitação, story points, epic relacionado
- Automação: PR vinculado a uma issue move o card automaticamente para "Code Review"
  ao abrir, e para "Done" ao ser mergeado

---

## 8. Próximos passos sugeridos

1. Criar o board no GitHub Projects com as colunas e labels acima
2. Importar as user stories deste documento como issues (posso gerar um script ou CSV
   para importação em lote, se quiser)
3. Priorizar o primeiro ciclo: recomendo começar pelas stories `M` (Must) dos Epics 1, 2 e 9 —
   autenticação, tickets e segurança são a base sobre a qual tudo mais se apoia
4. Criar o `CONTRIBUTING.md` documentando a convenção de branches/commits da seção 6
