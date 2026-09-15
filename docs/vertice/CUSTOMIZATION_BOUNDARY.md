# CUSTOMIZATION BOUNDARY
## Fronteiras Arquiteturais e Isolamento de Código do Vértice Hub

---

## 1. Regra de Ouro: Mínimo Diff Core
O código upstream do DeskcommCRM deve ser mantido intacto em 95%+ da árvore.
Todo código específico de Recrutamento & Seleção (R&S) deve residir em pastas novas e isoladas.

---

## 2. Mapa de Diretórios
- **Upstream Core:** `app/(dashboard)/`, `components/`, `lib/` (preservados)
- **Infraestrutura Fork:** `hostgator-setup-kit/`, `docker-compose.prod.yml`, `.env.hostgator.example`
- **Domínio Vértice People (Fase 4.2+):** `lib/vertice-people/`
- **Rotas API Vértice (Fase 4.2+):** `app/api/v1/recrutamento/`
- **Páginas Vértice (Fase 4.2+):** `app/(dashboard)/recrutamento/`
- **Componentes Vértice (Fase 4.2+):** `components/vertice-people/`
- **Documentação da Distribuição:** `docs/vertice/`

---

## 3. Diretrizes de Banco de Dados
1. **Prefixação Estrita:** `vertice_*` para tabelas de talentos e processos seletivos; `client_*` para entidades de clientes corporativos.
2. **Multi-tenancy:** Toda tabela deve possuir `organization_id UUID NOT NULL REFERENCES organizations(id)`.
3. **RLS:** Políticas devem invocar `organization_id IN (SELECT * FROM public.fn_user_org_ids())`.
4. **Sincronização Dupla:** Toda migração deve ser versionada em `supabase/migrations/` e refletida de forma idempotente em `supabase/baseline.sql`.
