# VÉRTICE HUB — DISTRIBUTION FOUNDATION
## Distribuição Especializada do DeskcommCRM para Vértice Pessoas & Estratégia

**Distribuição:** Vértice Hub  
**Organização:** `impulsyai/vertice-hub`  
**Upstream:** `melgarafael/DeskcommCRM`  
**Licença:** MIT License (Copyright (c) 2026 Rafael Melgaço / Impulsy.ai)  
**Versão Base Upstream:** `v1.25.0` / commit `b9bc24cf4c9568448b7108b1315836bc34abc0c6`

---

## 1. Propósito da Distribuição

O **Vértice Hub** é uma distribuição corporativa (*controlled fork*) do **DeskcommCRM**, projetada para servir como o Sistema Operacional de Negócios da consultoria **Vértice Pessoas & Estratégia**.

A distribuição herda integralmente a infraestrutura de comunicação e CRM do Deskcomm:
- Conexão WhatsApp estável via WAHA com transcrição por IA;
- Caixa de entrada multicanal (*Inbox*) com handoff humano-IA;
- Funil de vendas comercial e agendamento de reuniões (Google Calendar/Meet);
- Arquitetura multi-tenant com Row Level Security (RLS) no PostgreSQL;
- Suporte nativo ao protocolo Model Context Protocol (MCP) e Vercel AI SDK.

Sobre essa fundação, o Vértice Hub adiciona o domínio proprietário de **Recrutamento & Seleção (R&S)** em módulos isolados.

---

## 2. Estratégia de Distribuição C1 (Controlled Fork)

- **Namespace de Imagens no GHCR:** `ghcr.io/impulsyai`
- **Imagens Compiladas:**
  - `ghcr.io/impulsyai/deskcommcrm` (App Next.js 16)
  - `ghcr.io/impulsyai/deskcommcrm-worker` (Worker de background)
  - `ghcr.io/impulsyai/deskcommcrm-scheduler` (Scheduler)
- **Atualização Segura:** Utiliza os scripts nativos do kit de instalação (`update.sh`, `agent.sh`), configurados para consultar releases homologadas do repositório `impulsyai/vertice-hub`.

---

## 3. Governança & Rastreabilidade

- As decisões estratégicas, planos de produto e memória do negócio são mantidos no repositório central `impulsyai/Impulsy-OS-V2`.
- O código-fonte executável e os pipelines de compilação vivem neste repositório (`impulsyai/vertice-hub`).
- Sincronizações com o upstream seguem o protocolo estrito documentado em [UPSTREAM_SYNC.md](file:///docs/vertice/UPSTREAM_SYNC.md).
