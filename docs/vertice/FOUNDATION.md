# VÉRTICE HUB — DISTRIBUTION FOUNDATION
## Distribuição Especializada do DeskcommCRM para Vértice Pessoas & Estratégia

**Distribuição:** Vértice Hub  
**Organização:** `impulsyai/vertice-hub`  
**Upstream:** `melgarafael/DeskcommCRM`  
**Licença:** MIT License (Copyright (c) 2026 Rafael Melgaço / Impulsy.ai)  
**Versão Base Upstream:** `Release 1.25.1` / commit `b9bc24cf4c9568448b7108b1315836bc34abc0c6` (PR #870)

---

## 1. Propósito da Distribuição

O **Vértice Hub** é uma distribuição corporativa especializada do **DeskcommCRM**, projetada para servir como o Sistema Operacional de Negócios da consultoria **Vértice Pessoas & Estratégia**.

A distribuição herda integralmente a infraestrutura de comunicação e CRM do Deskcomm:
- Conexão WhatsApp estável via WAHA com transcrição por IA;
- Caixa de entrada multicanal (*Inbox*) com handoff humano-IA;
- Funil de vendas comercial e agendamento de reuniões (Google Calendar/Meet);
- Arquitetura multi-tenant com Row Level Security (RLS) no PostgreSQL;
- Suporte nativo ao protocolo Model Context Protocol (MCP) e Vercel AI SDK.

Sobre essa fundação, o Vértice Hub adiciona o domínio proprietário de **Recrutamento & Seleção (R&S)** e empresas B2B em módulos isolados.

---

## 2. Realidade Técnica do Repositório & Imagens GHCR

### 2.1. Natureza do Repositório Downstream
Na API do GitHub, o atributo do repositório é `fork: false`. Portanto, tecnicamente o `impulsyai/vertice-hub` não é um network fork formal do GitHub, mas sim um:
**Controlled Downstream Repository with Full Upstream History**.

- **Remotes Locais:**
  - `origin` → `https://github.com/impulsyai/vertice-hub.git`
  - `upstream` → `https://github.com/melgarafael/DeskcommCRM.git`

### 2.2. Namespace e Nomes Reais das Imagens
- **Namespace no GHCR:** `ghcr.io/impulsyai`
- **Imagens Oficiais Compiladas:**
  - `ghcr.io/impulsyai/deskcommcrm` (App Next.js 16)
  - `ghcr.io/impulsyai/deskcomm-worker` (Worker de background)
  - `ghcr.io/impulsyai/deskcomm-scheduler` (Scheduler)

### 2.3. Política de Versões e Tags SemVer
A função nativa `ultima_versao_publicada()` (`hostgator-setup-kit/_common.sh`) utiliza `grep -v -- '-'` para filtrar prereleases e garantir ordenação confiável de releases de produção. Tags contendo hífens (ex: `v1.26.0-vertice.1`) são descartadas por essa regra.
Portanto, as releases públicas de produção do Vértice Hub seguirão **SemVer puro sem hífens**:
- Formato: `v1.26.0`, `v1.26.1`, `v1.27.0`
- A linhagem da versão base upstream é registrada neste arquivo e em metadados de governança.

---

## 3. Automação de Release & Governança

### 3.1. Status Operacional: PRODUCTION RELEASE AUTOMATION PENDING
O workflow `.github/workflows/release.yml` utiliza a action `actions/create-github-app-token@v3` e requer obrigatoriamente:
- `secrets.RELEASE_APP_ID`
- `secrets.RELEASE_APP_PRIVATE_KEY`

Essa arquitetura é intencional: tokens de GitHub App são necessários para que eventos de criação de tag disparem automaticamente o workflow `publish-image.yml` (o `GITHUB_TOKEN` padrão do GitHub Actions possui uma restrição que impede o disparo em cadeia de workflows).

**Passos para Ativação Completa:**
1. Criar um GitHub App na organização `impulsyai` (ex: `Vertice Hub Release Bot`).
2. Conceder permissões de repositório:
   - *Contents:* Read & Write (para commit do changelog e push da tag `vX.Y.Z`).
   - *Pull Requests:* Read & Write (para criação do PR de release).
3. Instalar o GitHub App no repositório `impulsyai/vertice-hub`.
4. Coletar o **App ID** e gerar uma **Private Key** (.pem).
5. Cadastrar nos Repository Secrets do `impulsyai/vertice-hub`:
   - `RELEASE_APP_ID`
   - `RELEASE_APP_PRIVATE_KEY`

---

## 4. Governança & Rastreabilidade

- As decisões estratégicas, planos de produto e memória do negócio são mantidos no repositório central `impulsyai/Impulsy-OS-V2`.
- O código-fonte executável e os pipelines de compilação vivem neste repositório (`impulsyai/vertice-hub`).
- Sincronizações com o upstream seguem o protocolo estrito documentado em [UPSTREAM_SYNC.md](file:///docs/vertice/UPSTREAM_SYNC.md).
