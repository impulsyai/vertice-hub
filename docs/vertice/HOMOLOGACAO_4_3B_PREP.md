# Vértice Hub — Homologação 4.3B PREP

**Data de Execução:** 16 de Setembro de 2026  
**Ambiente:** Local Docker (`vertice-hub:local-4-3a`) + Supabase Local + Redis + WAHA  
**Branch Base (PR #4):** `feat/vertice-homologacao-4.3a` (`306b65b2433412e7e021b2ea18f8ac299d22ee62`)  
**Branch Atual:** `feat/vertice-ux-4.3b-prep`  
**Status Geral:** ✅ **4.3B PREP READY FOR HUMAN REVIEW**

---

## 1. Objetivo

A **Fase 4.3B-PREP** teve como objetivo central transformar visual e operacionalmente a experiência do usuário do **Vértice Hub**, distanciando o produto da aparência genérica do Deskcomm upstream e alinhando-o com a identidade visual institucional, sóbria e high-ticket da **VÉRTICE — PESSOAS & ESTRATÉGIA** (Recife, 2014).

A execução foi conduzida de forma autônoma, 100% reversível, não destrutiva e sem decisões de negócio precipitadas, criando evidências comparativas completas (**Before / After**) em todas as áreas do sistema, preservando integralmente a fundação técnica e os contratos de segurança homologados na Fase 4.3A.

---

## 2. Estado Inicial

No início da missão:
- A aplicação operava sob a branch `feat/vertice-homologacao-4.3a` com todos os gates verdes (CI, Docker, E2E, Verify).
- O produto exibia em diversos pontos elementos visuais genéricos da marca Deskcomm (cores padrão, favicon, logo genérica, badges azul-elétrico chamativos, títulos de páginas genéricos e contrastes desbalanceados).
- A logo oficial da Vértice e seu símbolo institucional não estavam integrados ao shell do produto.
- Em termos de UX, tabelas e cabeçalhos de recrutamento e empresas utilizavam linguagem mista (inglês/português, termos como "Pipeline R&S" e badges de status pouco sóbrios).

---

## 3. Identidade Aplicada

A identidade corporativa aplicada foi rigorosamente guiada pelos princípios de design da Vértice:

- **Direção de Design:** Institucional, estratégica, B2B high-ticket, clean, software-first, sóbria e moderna.
- **Abordagem:** **Light-first estrito**. Fundo limpo, respiração visual, tipografia refinada e sem saturação.
- **Paleta de Cores Oficial:**
  - **Vinho (#4D1021):** Utilizado estrategicamente como cor de acento primário, estado ativo selecionado na navegação, anéis de foco e elementos de destaque executivo.
  - **Marfim (#EFE7DF):** Utilizado em superfícies de destaque sutil e fundos institucionais quentes.
  - **Grafite (#505253):** Textos secundários, metadados, bordas de componentes e hierarquia tipográfica intermediária.
  - **Preto (#010101):** Títulos principais, dados de alto contraste e legibilidade primária.
- **Assets Oficiais Integrados:**
  - `public/brand/vertice-logo.png` — Logomarca horizontal oficial no topo da barra lateral.
  - `public/brand/vertice-symbol.png` — Símbolo corporativo minimalista para a Sidebar em estado colapsado.
  - Configuração via banco (`platform_branding`): `app_name: 'Vértice Hub'`, `accent_hex: '#4d1021'`, `show_powered_by: false`.

---

## 4. Shell do Produto

- **Barra Lateral (Sidebar):**
  - Integração da logomarca oficial da Vértice com contenção visual e proporção equilibrada (`h-9`, `max-w-[14rem]`).
  - Em modo colapsado, exibição automática do monograma/símbolo oficial da Vértice.
  - Navegação do Hub de Recrutamento refinada: reconhecimento de rotas ativas aninhadas (`isHubActive = pathname === hubDireto.href || pathname.startsWith(hubDireto.href + "/")`).
  - Hover states elegantes com `hover:bg-accent/10 hover:text-foreground` e ativação em tom Vinho institucional.
  - Preservação estrita dos testes de regressão de tema escuro (`tests/unit/logo-nao-some-no-tema-escuro.test.ts`).
- **Cabeçalho Global e Metadados:**
  - Atualização do título global do aplicativo em `app/layout.tsx` para `Vértice Hub — Pessoas & Estratégia`.
  - Descrição institucional atualizada para refletir consultoria B2B, recrutamento executivo e desenvolvimento humano.
- **Hub de Navegação (`NavHub`):**
  - Subtítulo do Hub de Recrutamento padronizado para *"Gestão estratégica de vagas, talentos e processos seletivos"*.
  - Elevação e feedback tátil sutil nos cards de acesso rápido (`hover:border-primary/40 hover:shadow-xs`).

---

## 5. Recrutamento

### Talentos (`/app/recrutamento/talentos`)
- **Cabeçalho e Ações:** Título institucional "Banco de Talentos", subtítulo objetivo e botão "Novo Talento" com styling Vinho corporativo.
- **Tabela e Tipografia:**
  - Cabeçalho com fundo suave (`bg-muted/60`), tipografia `text-xs font-semibold uppercase tracking-wider`.
  - Remoção de badges chamativos em azul saturado (`bg-blue-600`), substituídos por oval sóbrio institucional com acento Vinho (`border-primary/40 bg-primary/10 text-primary font-semibold`).
  - Efeito de hover suave nas linhas (`hover:bg-accent/5`).
  - Botão de ação direta na linha padronizado para "Ver dossiê".

### Dossiê do Candidato (`/app/recrutamento/talentos/[id]`)
- **Transformação em Dossiê Profissional:**
  - Inclusão do badge institucional *"Dossiê Profissional"* no topo do perfil.
  - Tradução e padronização dos status cadastrais (ex: `Ativo`, `Inativo`, `Em Processo`, `Banco de Reserva`).
  - Padronização das candidaturas vinculadas com exibição amigável do estágio atual (ex: `Recebido`, `Triagem`, `Entrevista`, `Proposta`).
  - Botão de ação rápida atualizado de *"Ver no Pipeline"* para *"Ver no Funil de Seleção"*.
  - Cards de informações profissionais, contatos e pretensão salarial organizados com bordas nítidas e hierarquia visual clara.

### Currículos (`/app/recrutamento/curriculos`)
- Tabela de acervo documental padronizada com cabeçalhos estruturados e visualização do status ativo em verde esmeralda institucional.
- Manutenção rigorosa de toda a infraestrutura de segurança do Supabase Storage e URLs assinadas (sem alterações em RLS/RPC).

### Vagas (`/app/recrutamento/vagas`)
- Cabeçalho institucional "Vagas & Posições", com status padronizados (*Aberta*, *Em Pausa*, *Encerrada*, *Cancelada*).
- Ações na linha da tabela refinadas para *"Funil"* (acesso direto ao Funil de Seleção da vaga) e *"Detalhes"*.
- Modal de criação e edição com layout limpo e campos alinhados à paleta corporativa.

### Detalhe da Vaga (`/app/recrutamento/vagas/[id]`)
- Tag superior *"Posição Corporativa"* identificando o departamento e a empresa contratante.
- CTA principal destacado: *"Abrir Funil de Seleção"* com ícone e redirecionamento direto para a esteira seletiva da respectiva posição.
- Seções de requisitos, atribuições e faixa salarial com tipografia de leitura confortável.

### Candidaturas (`/app/recrutamento/candidaturas`)
- Tabela operacional limpa, relacionando profissional, vaga, estágio seletivo e data de candidatura.
- Padronização das referências ao "Funil de Seleção".

### Funil de Seleção (`/app/recrutamento/pipeline`)
- **Preservação de Workflow:** Os 10 estágios operacionais oficiais foram 100% mantidos sem qualquer quebra de fluxo ou banco de dados.
- **Refinamento Visual:**
  - Remoção de numeração redundante nos cabeçalhos das colunas (ex: `01 1 Recebido` corrigido para badge numérico circular `01` e rótulo limpo `Recebido`).
  - Indicador numérico de candidatos por coluna com badge circular suave.
  - Cards de candidatos com sutis acentos de borda Vinho institucional ao hover e feedback tátil aprimorado durante o arrasto (drag & drop).

---

## 6. CRM — Empresas (`/app/crm/empresas`)

- **Conceito Fortalecido:** A área representa estritamente **Empresas Clientes / Prospects Corporativos B2B** da consultoria Vértice, separada categoricamente do Banco de Talentos.
- **Aprimoramentos:**
  - Tabela institucional com dados de contato, setor e responsável com contrastes equilibrados.
  - Badges de status corporativo padronizados.
  - Modais de criação e edição com acabamento sóbrio.

---

## 7. Agenda (`/app/agenda`)

- Shell perfeitamente integrado à identidade Vértice, com cores de seleção e navegação entre modos dia/semana/mês em harmonia com a paleta institucional.
- Preservação da lógica de compromissos e ausência de dependências externas não autorizadas.

---

## 8. Tarefas (`/app/tasks`)

- Alinhamento visual da barra de filtros, alternância entre modos de exibição (lista e calendário) e botões de ação em tom Vinho.
- Clareza na visualização de prazos e prioridades de follow-up.

---

## 9. Inbox (`/app/inbox`)

- Interface multicanal com remoção de menções residuais à marca anterior.
- Cabeçalhos de conversas, badges de canal e estados vazios harmonizados com a identidade corporativa.
- Nenhuma ativação externa ou QR Code foi disparado, respeitando a autonomia e segurança do ambiente.

---

## 10. Mobile (Viewport 390 × 844)

- Testado e validado em 10 telas críticas (Dashboard, Empresas, Talentos, Candidato, Vagas, Detalhes da Vaga, Funil de Seleção, Agenda, Tarefas e Inbox).
- Sidebar retrátil com comportamento fluido e touch targets adequados.
- Tabelas e dossiê com rolagem responsiva e sem quebras horizontais não intencionais.

---

## 11. Deskcomm Ainda Visível

Durante a varredura visual e técnica da interface:
- **Removido:** Menções ao nome "Deskcomm" nos cabeçalhos visíveis de Talentos, Vagas, Dossiê, Empresas e no `<title>` global.
- **Removido:** Identidade visual genérica, logos e favicons não pertencentes à Vértice.
- **Mantido Intencionalmente sob Governança:** Módulos legados de vendas Deskcomm (Leads, Negócios/Deals, Catálogo de Produtos, Campanhas e Helpdesk/Tickets) permanecem acessíveis no código e no menu, aguardando deliberação de Juca na lista de decisões estratégicas abaixo.

---

## 12. Decisões Humanas Restantes (DECISÕES PARA JUCA)

Para homologação executiva e direcionamento das próximas fases, foram isoladas **6 decisões estratégicas de produto** (sem necessidade de opinar sobre micro-detalhes de UI):

1. **Governança do Menu Lateral (Módulos de CRM Comercial Deskcomm):**
   - *Decisão:* Deseja ocultar do menu principal os módulos de CRM voltados a produtos de varejo (Leads, Negócios/Deals, Catálogo de Produtos, Campanhas, Tickets/Helpdesk) para focar a interface 100% em **Recrutamento, Empresas Clientes, Mensagens e Produtividade**?
   - *Status Atual:* Todos os módulos continuam presentes no código e menu sem exclusão destrutiva.

2. **Nomenclatura Oficial do Módulo de Mensageria:**
   - *Decisão:* Padronizar o módulo `/app/inbox` como **"Mensagens & WhatsApp"**, **"Atendimento"** ou manter o termo técnico **"Inbox"**?

3. **Confidencialidade da Faixa Salarial de Vagas e Pretensão de Talentos:**
   - *Decisão:* Os campos de remuneração devem ser visíveis para todos os operadores com acesso a Recrutamento ou restritos a perfis gerenciais (Admin/Gerente)?

4. **Painel Inicial (Dashboard Executivo da Vértice):**
   - *Decisão:* Substituir os gráficos legados de volume de tickets e leads por métricas específicas de Consultoria e R&S (ex: *Total de Vagas Abertas*, *Talentos no Banco*, *Candidatos em Processo Seletivo*, *Vagas por Empresa Cliente*)?

5. **Exibição do Funil de Seleção no Mobile:**
   - *Decisão:* Manter a visualização Kanban com rolagem lateral horizontal ou implementar um modo alternativo em lista agrupada por estágio seletivo para telas de smartphones?

6. **Fluxo e Consentimento LGPD para Acervo de Currículos:**
   - *Decisão:* Definir o prazo padrão de retenção de dados cadastrais de candidatos no Banco de Talentos (ex: 12 ou 24 meses) para disparo automático de solicitação de renovação de consentimento.

---

## 13. Before / After (Registro de Evidências)

Todas as capturas comparativas foram realizadas no sistema real rodando na porta 3000 (resoluções 1440×900 desktop e 390×844 mobile):

- **Diretório Geral de Evidências:** `C:\dev\vertice-4.3b-prep\`
  - `01_shell/` (before / after)
  - `02_dashboard/` (before / after)
  - `03_empresas/` (before / after)
  - `04_talentos/` (before / after)
  - `05_candidato/` (before / after)
  - `06_vagas/` (before / after)
  - `07_vaga/` (before / after)
  - `08_candidaturas/` (before / after)
  - `09_funil/` (before / after)
  - `10_agenda/` (before / after)
  - `11_tarefas/` (before / after)
  - `12_inbox/` (before / after)
  - `13_settings/` (before / after)
  - `14_mobile/` (before / after - 10 telas)
- **Diretório de Revisão Rápida para o Usuário:** `C:\dev\vertice-4.3b-prep\00_REVIEW\`
  - Contém 15 pares comparativos diretos numerados (`01_shell` a `15_mobile_funil`).

---

## 14. Riscos

- **Risco Zero de Quebra de Contrato:** Nenhuma tabela do banco de dados, função RPC, migration ou bucket de storage foi alterado.
- **Risco de Merge Acidental:** Branch base da Stacked PR aponta rigorosamente para `feat/vertice-homologacao-4.3a`, garantindo que nada chegue à `main` prematuramente.
- **Isolamento e Segurança:** Teste E2E de isolamento multi-tenant (`tests/e2e/people-foundation.spec.ts`) revalidado e aprovado com 100% de sucesso.

---

## 15. Próximo Passo Recomendado

1. Revisão visual humana dos pares comparativos em `C:\dev\vertice-4.3b-prep\00_REVIEW\`.
2. Deliberação das decisões prioritárias de Juca (especialmente ocultação de módulos comerciais legados).
3. Homologação final da PR #4 e posterior merge da Stacked PR 4.3B.
