# Vértice People — Segurança, RLS e Isolamento

Este documento detalha as garantias de isolamento entre organizações, controle de acesso baseado em papéis (RBAC) e proteção de arquivos confidenciais do módulo **Vértice People**.

---

## 1. Isolamento Multi-Tenant (RLS)

1. **Predicado Obrigatório**:
   Todas as 6 tabelas de People possuem RLS habilitada (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) e revogação de privilégios de `anon` (`REVOKE ALL ON ... FROM anon`).
   - Leitura (`SELECT`): Restrita a membros ativos da organização via `organization_id IN (SELECT public.fn_user_org_ids())` ou superadministradores da plataforma (`public.fn_is_platform_admin()`).
   - Escrita (`INSERT`, `UPDATE`, `DELETE`): Exige ao menos o papel de `agent` na organização (`public.fn_role_at_least(organization_id, 'agent')`).
   - `WITH CHECK`: Impede que um usuário da Org A tente inserir ou alterar registros apontando para a Org B.

2. **Invariantes Provados em Testes**:
   O arquivo `tests/invariants/people-rls-isolation.test.ts` e a varredura `tests/invariants/rls-completude-varredura.test.ts` comprovam que:
   - Usuário de Org B com papel de `agent` recebe contagem `0` para qualquer leitura ou escrita nas tabelas da Org A.
   - O `ALTER DEFAULT PRIVILEGES` não expõe funções de sincronização a `anon` (conferido por `tests/unit/varredura-anon-e-o-ultimo-bloco.test.ts`).

---

## 2. Proteção de Arquivos de Currículos (`candidate-resumes`)

1. **Bucket Privado**:
   O bucket do Supabase Storage `candidate-resumes` é configurado com `public = false`. Nenhuma URL pública ou sem autenticação consegue ler os arquivos.

2. **Caminho de Armazenamento**:
   Os arquivos são organizados com o prefixo do tenant:
   `candidate-resumes/<organization_id>/<candidate_id>/<sha256>/<filename>`

3. **Políticas de Storage**:
   - Leitura de objetos: Apenas usuários autenticados pertencentes à organização indicada na primeira parte do caminho (`(split_part(name, '/', 1))::uuid`).
   - Inserção de objetos: Apenas usuários autenticados pertencentes à organização indicada com papel de ao menos `agent`.

4. **Download Seguro via Signed URL**:
   O endpoint `/api/v1/people/resumes/:id/download` valida a posse do registro no tenant do usuário ativo e emite uma Signed URL temporária com expiração em **60 segundos**. O arquivo nunca é trafegado publicamente.

---

## 3. Guarda de Suporte (Impersonation Protection)

Em conformidade com a Doutrina Deskcomm, todo handler mutante do Next.js App Router (`POST`, `PATCH`, `DELETE`) em `/api/v1/people/*` executa a guarda:
```ts
const supportDenied = await requireSupportWrite();
if (supportDenied) return supportDenied;
```
Isso impede que sessões temporárias de suporte técnico façam alterações não autorizadas em dados confidenciais de clientes ou candidatos.

---

## 4. Auditoria Append-Only

Todas as operações sensíveis de People registram eventos imutáveis em `api_audit_log` via helper `audit()`:
- `people.candidate_created` / `people.candidate_updated`
- `people.resume_uploaded`
- `people.company_created` / `people.company_updated`
- `people.job_created` / `people.job_updated`
- `people.application_created` / `people.application_stage_changed`
