# Vértice People — Segurança, RLS e Isolamento

Este documento registra somente as garantias implementadas no módulo Vértice People após o hardening da Fase 4.2.2.

## 1. Isolamento multi-tenant

As tabelas People usam RLS e filtram por `organization_id`. As relações entre candidato, currículo, vaga, empresa e candidatura usam foreign keys compostas para impedir referências entre organizações.

As funções gravadoras validam a organização e o papel do usuário no banco. A rota não usa `organization_id` fornecido pelo cliente como autoridade: a organização vem do contexto autenticado.

## 2. Currículos e Storage

- O bucket `candidate-resumes` é privado.
- A validação da rota verifica extensão, MIME, tamanho e magic bytes antes do upload.
- Cada tentativa gera no backend um UUID novo no formato `organization_id/candidate_id/upload_attempt_uuid.ext`.
- `upsert:false` impede sobrescrita física.
- `candidate_id + sha256` é a identidade lógica deduplicada.
- `storage_path` é único para cada objeto físico.
- Uma colisão física retorna `409 storage_conflict`; o objeto preexistente não é removido.
- A RPC `fn_register_candidate_resume` trava o candidato, exige `agent+`, valida o objeto existente e promove/demove currículos na mesma transação.
- `authenticated` não possui `DELETE` no bucket e não possui escrita direta em `vertice_candidate_resumes`.

### Cleanup e ownership

O cleanup é executado somente pelo backend. A aplicação mantém localmente o object key UUID criado pela tentativa e, antes de chamar o client administrativo do Storage, valida:

1. organização e candidato correspondem ao request autenticado;
2. o path possui o formato canônico de tentativa;
3. nenhum registro de currículo referencia aquele `storage_path`.

Assim, dois uploads concorrentes usam objetos físicos diferentes. O vencedor mantém seu objeto; o perdedor remove somente o key gerado pela própria tentativa.

## 3. Funções `SECURITY DEFINER`

As funções definer People usam `SET search_path = public, pg_temp` e qualificam tabelas. As cinco funções usadas exclusivamente por triggers não são executáveis por `authenticated`; o grant direto fica com `service_role`.

`fn_register_candidate_resume` é a única função definer gravadora exposta a `authenticated`. Ela recusa UID nulo, exige `agent+`, trava o candidato da organização e valida SHA, tamanho, MIME, nome e object key de tentativa. `public`, `anon` e `service_role` não recebem `EXECUTE`.

## 4. Anonimização LGPD

Um trigger `AFTER UPDATE OF is_anonymized` em `contacts` cobre a transição `false → true`:

- redige os campos pessoais e profissionais do candidato;
- limpa texto livre das candidaturas e zera `resume_id`;
- enfileira os objetos de currículo em `storage_redaction_queue`;
- remove os registros de versões de currículo;
- filtra todas as operações por organização e contato.

A fila é gravável somente por produtores privilegiados. O worker valida bucket permitido, ausência de travessia e prefixo exato da organização antes de usar o client administrativo.

## 5. Guarda e auditoria

Endpoints mutantes de People respeitam `requireSupportWrite()`. Operações concluídas registram auditoria com `await audit({ ... })`, incluindo upload e deduplicação de currículos.
