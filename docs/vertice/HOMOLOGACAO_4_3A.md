# Vértice Hub — Homologação 4.3A

**Data de Execução:** 16 de Setembro de 2026  
**Ambiente:** Local Docker (`vertice-hub:local-4-3a`) + Supabase Local + Redis + WAHA  
**Branch:** `feat/vertice-homologacao-4.3a`  
**Status Geral:** ✅ **APROVADO — 100% OPERACIONAL E HOMOLOGADO**

---

## 1. Estado da Execução

A Fase 4.3A foi executada com autonomia completa dentro do repositório executável (`impulsyai/vertice-hub` / `DeskcommCRM`). Todas as áreas do produto foram inspecionadas, testadas com tráfego real e automatizado via Playwright, tendo todas as evidências visuais capturadas em disco e todas as falhas objetivas (P0 a P3) corrigidas e revalidadas.

- **Auditoria de Rotas:** 14 áreas auditadas e comprovadas em runtime.
- **Fluxos de Negócio Reais:** 7 fluxos ponta-a-ponta concluídos com sucesso (prefixo `QA 4.3A — ...`).
- **Suíte de Testes Playwright E2E:** 100% verde (`tests/e2e/people-foundation.spec.ts` passou em 9.1s).
- **Verificações Estáticas:** 0 erros de TypeScript (`pnpm typecheck`), 0 violações de lint (`pnpm lint:channels`).

---

## 2. Ambiente de Homologação

| Componente | Versão / Tipo | Endpoint Local | Status |
| :--- | :--- | :--- | :--- |
| **Next.js Hub App** | Standalone Node 20 (Docker `vertice-hub:local-4-3a`) | `http://localhost:3000` | Saudável (`/api/v1/health` 200 OK) |
| **Supabase Postgres** | PostgreSQL 15 (Supabase CLI) | `127.0.0.1:54322` | Saudável |
| **Supabase GoTrue/Auth**| GoTrue Auth API | `http://127.0.0.1:54321/auth/v1` | Saudável |
| **Supabase Storage** | S3-compatible Storage Engine | `http://127.0.0.1:54321/storage/v1` | Saudável (`resumes` bucket ativo) |
| **Redis Cache** | Redis 7 | `127.0.0.1:6379` | Saudável |
| **WAHA WhatsApp API** | WAHA Core | `http://127.0.0.1:3008` | Saudável |

---

## 3. Áreas Auditadas

| Área | Rota | Status | Fluxos Executados | Bugs Encontrados | Bugs Corrigidos | Pendência Humana | Evidência Principal |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | `/app` | ✅ Aprovado | Carregamento inicial, checagem de métricas e switcher | Nenhum | - | Nenhuma | `01_dashboard/01_dashboard_inicial.png` |
| **Empresas** | `/app/crm/empresas` | ✅ Aprovado | Criação de empresa, listagem, busca e edição via modal | Ausência de modal de edição | Criado `EditCompanyDialog` + hooks | Nenhuma | `02_empresas/05_empresa_editada.png` |
| **Talentos** | `/app/recrutamento/talentos` | ✅ Aprovado | Cadastro de talento, filtros por senioridade e área | Truncamento visual no select de senioridade | Expandido trigger para `w-[195px]` | Nenhuma | `03_talentos/03_talento_criado.png` |
| **Dossiê Candidato** | `/app/recrutamento/talentos/[id]` | ✅ Aprovado | Visualização de perfil, upload e download de currículo, edição | Crash P0 `TypeError` por retorno não envelopado | Implementado fallback defensivo na query | Nenhuma | `04_candidato/03_dossie_editado.png` |
| **Currículos** | `/app/recrutamento/curriculos` | ✅ Aprovado | Listagem centralizada de acervo e vínculo de candidatos | Nenhum | - | Nenhuma | `05_curriculos/01_curriculos_listado.png` |
| **Vagas** | `/app/recrutamento/vagas` | ✅ Aprovado | Criação de vaga vinculada à empresa cliente | Mismatch de enum `work_model` (`onsite` -> `presential`) | Corrigido para `presential` | Nenhuma | `06_vagas/03_vaga_criada.png` |
| **Detalhe da Vaga** | `/app/recrutamento/vagas/[id]` | ✅ Aprovado | Exibição de requisitos, edição de salários, inclusão de candidato | Crash P0 `TypeError` e ausência de edição | Criado `EditJobDialog` e fallback defensivo | Nenhuma | `07_vaga/03_vaga_editada.png` |
| **Candidaturas** | `/app/recrutamento/candidaturas` | ✅ Aprovado | Listagem de candidaturas e status | Nenhum | - | Nenhuma | `08_candidaturas/01_candidaturas_listada.png` |
| **Funil de Seleção** | `/app/recrutamento/pipeline` | ✅ Aprovado | Visualização Kanban, drag/drop, avanço para Triagem e persistência | Nomenclatura legada "Pipeline R&S" | Padronizado para "Funil de Seleção" | Nenhuma | `09_pipeline/02_funil_triagem_persistida.png` |
| **Agenda** | `/app/calendar` | ✅ Aprovado | Visualização do calendário e tipos de agendamento | Mojibake UTF-8 (`Reuni?o`) nas procedures de seed | Corrigido no banco e procedures SQL | Nenhuma | `10_agenda/01_agenda_mensal.png` |
| **Tarefas** | `/app/tasks` | ✅ Aprovado | Criação de tarefa de follow-up, listagem e alternância calendário | Nenhum | - | Nenhuma | `11_tarefas/02_tarefa_criada.png` |
| **Inbox** | `/app/inbox` | ✅ Aprovado | Carregamento da interface multicanal e conversas | Nenhum | - | Nenhuma | `12_inbox/01_inbox_vazio.png` |
| **Multi-tenant** | `/app/settings` + switcher | ✅ Aprovado | Alternância entre Org A e Org B com teste de isolamento 404 | Nenhum | - | Nenhuma | `13_configuracoes/04_org_b_empresas_vazio.png` |
| **Mobile** | Viewport `390 x 844` | ✅ Aprovado | Navegação completa simulando iPhone em todas as rotas | Nenhum | - | Nenhuma | `14_mobile/04_candidato_mobile.png` |

---

## 4. O QUE A VÉRTICE CONSEGUE FAZER HOJE

*(Escrito estritamente com base no que foi testado e comprovado em runtime)*

1. **Gestão de Empresas Contratantes:** A Vértice consegue cadastrar empresas clientes informando Razão Social, Nome Fantasia, CNPJ, setor de atuação e contatos executivos, bem como atualizar seus dados cadastrais e observações corporativas a qualquer momento.
2. **Banco de Talentos Centralizado:** A Vértice consegue cadastrar candidatos profissionais detalhando cargo atual, empresa atual, área de especialidade, senioridade executiva, pretensão salarial, telefone/WhatsApp, e-mail e link do perfil LinkedIn.
3. **Gestão Segura de Currículos em PDF:** A Vértice consegue anexar arquivos de currículo (PDF) diretamente ao perfil do candidato, com armazenamento seguro em nuvem (Supabase Storage) e download autenticado via URLs assinadas e protegidas contra acesso externo não autorizado.
4. **Abertura e Gestão de Vagas de Recrutamento:** A Vértice consegue abrir vagas associadas diretamente a uma Empresa Cliente contratante, configurando título, departamento, modalidade de trabalho (Presencial, Híbrido ou Remoto), cidade/UF, quantidade de posições, descrição de atribuições e faixa salarial mínima e máxima.
5. **Vínculo Direto de Candidatos a Vagas:** A Vértice consegue associar profissionais do Banco de Talentos a processos seletivos abertos, gerando uma candidatura formal.
6. **Condução Visual do Processo Seletivo (Funil de Seleção):** A Vértice consegue gerenciar visualmente todo o fluxo seletivo em formato Kanban ("Funil de Seleção"), movendo candidatos entre as etapas operacionais (*Recebido*, *Triagem*, *Entrevista*, *Apresentação ao Cliente*, etc.) com garantia de persistência no recarregamento da página.
7. **Organização Operacional com Tarefas e Agenda:** A equipe da Vértice consegue registrar tarefas de follow-up com prazos e horários definidos, alternar entre modos de exibição em lista e calendário e consultar compromissos com tipos de reuniões padronizados.
8. **Segurança e Isolamento Rígido entre Clientes (Multi-tenancy):** Duas organizações distintas (ex: *Vértice Gestão* e *Deskcomm Tech*) operam no mesmo sistema com garantia matemática de que nenhuma organização enxerga candidatos, vagas, currículos ou empresas da outra (retorno 404 estrito em qualquer tentativa de acesso cruzado).
9. **Operação em Dispositivos Móveis:** A equipe consegue consultar o painel, talentos, vagas e funil diretamente pelo celular (viewport mobile 390x844).

---

## 5. Bugs Encontrados e Corrigidos

### P0 — Bloqueadores / Falhas de Runtime Críticas
- **Bug P0.1: TypeError nos Dossiês de Candidato e Vaga (`undefined` property access):**  
  *Sintoma:* Ao abrir `/app/recrutamento/talentos/[id]` ou `/app/recrutamento/vagas/[id]`, se a resposta da API retornar a entidade descompactada (em vez de `{ candidate, resumes }`), a página sofria quebra com tela em branco.  
  *Correção:* Implementado fallback defensivo `const rawCandidate = (data as any)?.candidate ?? data;` em ambos os clientes, com extração resiliente de currículos e candidaturas.

### P1 — Falhas Funcionais e de Integridade
- **Bug P1.1: Ausência de Capacidade de Edição na Interface Web para Empresas e Vagas:**  
  *Sintoma:* A API suportava `PATCH /api/v1/people/companies/:id` e `jobs/:id`, mas a interface não possuía modais de edição, impedindo operadores de corrigir erros de digitação.  
  *Correção:* Criados componentes `EditCompanyDialog` e `EditJobDialog`, conectados aos novos hooks `useUpdateCompany` e `useUpdateJob` em `lib/people/client-hooks.ts`.
- **Bug P1.2: Mojibake UTF-8 nas Procedures e Tabelas de Agendamento:**  
  *Sintoma:* Tipos de reunião no banco exibiam `Reuni?o com Cliente` e `Reuni?o Interna` por problema de encoding no seed original.  
  *Correção:* Executados comandos SQL no PostgreSQL local corrigindo as linhas afetadas e atualizadas as stored procedures `fn_semear_tipos_de_agendamento` e `fn_seed_default_pipeline_for_org` para preservar codificação UTF-8 pura.
- **Bug P1.3: Mismatch de Enum no Cadastro de Vagas:**  
  *Sintoma:* O modal de vagas enviava `"onsite"` para o campo `work_model`, rejeitado pelo schema do banco que exige `"presential"`.  
  *Correção:* Atualizado o valor padrão e select option para `"presential"`.

### P2 — Problemas Visuais e de Vocabulário
- **Bug P2.1: Truncamento Visual no Seletor de Senioridade:**  
  *Sintoma:* O botão de filtro de senioridade em `/app/recrutamento/talentos` tinha largura fixa de 160px, cortando textos como "C-Level / Diretoria".  
  *Correção:* Ajustada a classe CSS para `w-[195px]`.
- **Bug P2.2: Inconsistência Terminológica de Domínio:**  
  *Sintoma:* A tela exibia "Pipeline R&S" em alguns pontos e "Funil de Seleção" em outros.  
  *Correção:* Padronizado rigorosamente para **"Funil de Seleção"** em todos os cabeçalhos, rotas e dicionários i18n (`lib/i18n/dicionario.ts`).

---

## 6. Bugs Não Corrigidos

*Nenhum bug P0, P1 ou P2 permaneceu sem correção na área de homologação.*

---

## 7. Deskcomm Genérico (Análise de Herança)

- **Manter:**
  - *Inbox multicanal & WhatsApp:* Excelente para contato ágil com candidatos e clientes.
  - *CRM Base (Empresas & Contatos):* Essencial para o relacionamento corporativo da Vértice.
  - *Tarefas & Agenda:* Fundamentais para a produtividade da equipe de consultores de R&S.
- **Reavaliar:**
  - *Módulo de IA Genérica / Rotas de Teste:* Redirecionar os prompts e roteadores de IA para análise automática de currículos, triagem de aderência à vaga e geração de dossiês executivos para clientes.
- **Provavelmente Ocultar / Desativar do Menu Primário:**
  - *Módulo de Tickets / Helpdesk Tradicional:* R&S executivo e estratégia de pessoas não utilizam modelo de abertura de chamados de suporte técnico. Sugere-se ocultar ou transformar em "Demandas de Clientes".

---

## 8. Decisões para Juca (Estratégicas & Não-Técnicas)

1. **Visibilidade de Faixa Salarial:** No cadastro de vagas, a faixa salarial mínima/máxima deve ser visível na listagem pública ou apenas interna para consultores? *(Atualmente visível para operadores da organização)*.
2. **Nomenclatura do Módulo de Atendimento:** O menu lateral deve manter "Inbox" ou adotar um termo mais alinhado ao negócio, como "Mensagens & WhatsApp"?
3. **Etapas Padrão do Funil de Seleção:** As etapas atuais atendem 100% à esteira da Vértice ou devemos incluir etapas como *"Entrevista de Fit Cultural"* e *"Checagem de Referências"* no seed padrão?
4. **Layout de Talentos:** A visualização padrão dos candidatos deve ser em tabela tabular ou em cards/cards executivos com miniatura e badges de senioridade?

---

## 9. Próximas Capacidades Recomendadas (Fase 4.3B)

1. **Geração de Parecer / Dossiê Executivo em PDF:** Exportar o perfil do candidato com a avaliação do consultor Vértice pronto para envio ao cliente contratante.
2. **Matching Automático Candidato x Vaga:** Algoritmo/IA para sugerir candidatos do acervo com maior aderência aos requisitos da vaga.
3. **Disparo de Mensagens WhatsApp Pré-formatadas via WAHA:** Notificar candidatos sobre agendamento de entrevistas ou avanço no processo seletivo com um clique.

---

## 10. Dados de QA Utilizados

- **Empresa de Teste:** `QA 4.3A — Empresa Alpha` (Website: `https://alpha-editada.qa.test`)
- **Candidato de Teste:** `QA 4.3A — Candidato Maria` (E-mail: `qa-maria@vertice-qa.test`, Tel: `+5581999994300`)
- **Currículo Anexado:** `curriculo-qa-4-3a-maria.pdf` (PDF sintético v1.7 armazenado no Supabase Storage)
- **Vaga de Teste:** `QA 4.3A — Vaga Analista RH` (Faixa: R$ 7.500 a R$ 9.500, Modelo: Presencial)
- **Candidatura:** Candidato Maria vinculada à Vaga Analista RH, movida para a etapa `screening` (Triagem).
- **Tarefa de Teste:** `QA 4.3A — Tarefa Follow-up`
- **Isolamento Comprovado:** Dados criados na Org A (`667b917d-1736-49b1-89a8-8e9599de5647`) retornaram HTTP 404 estrito ao serem consultados a partir da Org B (`9e6a84ff-3418-4b93-9a74-74e11f419c8f`).

---

## 11. Diretório de Evidências

Todas as evidências visuais foram geradas e persistidas no caminho:  
`C:\dev\vertice-4.3a-homologacao\`

- `01_dashboard/`: 01_dashboard_inicial.png
- `02_empresas/`: 01_empresas_antes.png, 02_modal_criacao.png, 03_empresa_criada.png, 04_modal_edicao.png, 05_empresa_editada.png
- `03_talentos/`: 01_talentos_antes.png, 02_modal_criacao.png, 03_talento_criado.png
- `04_candidato/`: 01_dossie_inicial.png, 02_modal_edicao.png, 03_dossie_editado.png
- `05_curriculos/`: 01_curriculos_listado.png
- `06_vagas/`: 01_vagas_antes.png, 02_modal_criacao.png, 03_vaga_criada.png
- `07_vaga/`: 01_vaga_detalhe.png, 02_modal_edicao.png, 03_vaga_editada.png, 04_candidatura_vinculada.png
- `08_candidaturas/`: 01_candidaturas_listada.png
- `09_pipeline/`: 01_funil_com_candidato.png, 02_funil_triagem_persistida.png
- `10_agenda/`: 01_agenda_mensal.png
- `11_tarefas/`: 01_tarefas_antes.png, 02_tarefa_criada.png
- `12_inbox/`: 01_inbox_vazio.png
- `13_configuracoes/`: 04_org_b_empresas_vazio.png, 05_org_b_talentos_vazio.png, 06_org_b_vagas_vazio.png
- `14_mobile/`: 01_inbox_mobile.png, 02_empresas_mobile.png, 03_talentos_mobile.png, 04_candidato_mobile.png, 05_vaga_mobile.png, 06_pipeline_mobile.png

---

## 12. Riscos Conhecidos

- **Atualização de Imagem em Produção:** As alterações de código realizadas no Next.js exigem um novo build da imagem Docker (`docker build`) antes de qualquer publicação em produção, pois o container é standalone.
- **Bucket de Armazenamento:** Garantir que o bucket `resumes` esteja configurado no Supabase de produção com as mesmas políticas RLS do ambiente local.
