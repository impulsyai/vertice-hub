import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { calculateSha256 } from "@/lib/people/services";
import { validateResumeFile } from "@/lib/people/file-validation";
import type { CandidateResume } from "@/lib/people/types";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

interface RegisterResumeRpcResult {
  resume: CandidateResume;
  deduplicated: boolean;
}

export async function POST(req: NextRequest) {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("agent");
  if (!authz.ok) return authz.response;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const candidateId = formData.get("candidate_id") as string | null;

  if (!file || !candidateId) {
    return fail("missing_fields", "Arquivo e candidate_id são obrigatórios.", 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return fail("file_too_large", "O arquivo excede o limite máximo de 15MB.", 413);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 1. Validação forense completa (extensão, MIME e magic bytes)
  const validation = validateResumeFile(file.name, file.type, buffer);
  if (!validation.valid) {
    return fail("invalid_file", validation.error || "Arquivo inválido ou não suportado.", 415);
  }

  const supabase = await createClient();

  // 2. Validar se o candidato pertence à organização ativa
  const { data: candidate } = await supabase
    .from("vertice_candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (!candidate) {
    return fail("candidate_not_found", "Candidato não encontrado na organização.", 404);
  }

  // 3. Calcular SHA-256 obrigatório
  const sha256 = calculateSha256(buffer);

  // 4. Caminho padronizado e controlado no bucket privado
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const storagePath = `${authz.org.orgId}/${candidateId}/${sha256}.${ext}`;

  // 5. Upload seguro para o Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("candidate-resumes")
    .upload(storagePath, buffer, {
      contentType: validation.detectedMime || file.type,
      upsert: true,
    });

  if (uploadError) {
    return fail("upload_error", `Falha ao salvar arquivo no storage: ${uploadError.message}`, 500);
  }

  // 6. Registro Atômico Transacional via RPC (fn_register_candidate_resume)
  // Garante row lock, troca de current atômica e proteção contra duplicatas concorrentes
  const { data: rpcRaw, error: rpcError } = await supabase.rpc(
    "fn_register_candidate_resume",
    {
      p_org_id: authz.org.orgId,
      p_candidate_id: candidateId,
      p_storage_path: storagePath,
      p_original_filename: file.name,
      p_mime_type: validation.detectedMime || file.type,
      p_file_size_bytes: file.size,
      p_sha256: sha256,
      p_source_type: "manual",
      p_source_mailbox: null,
      p_source_message_id: null,
    }
  );

  if (rpcError || !rpcRaw) {
    // Limpeza de arquivo órfão caso a transação no banco falhe
    await supabase.storage.from("candidate-resumes").remove([storagePath]);
    return fail("database_error", rpcError?.message || "Erro ao registrar versão do currículo", 500);
  }

  const rpcResult = rpcRaw as unknown as RegisterResumeRpcResult;

  // Se foi deduplicado e já existia um arquivo em outro caminho, limpa o recém-enviado
  if (rpcResult.deduplicated && rpcResult.resume.storage_path !== storagePath) {
    await supabase.storage.from("candidate-resumes").remove([storagePath]);
  }

  await audit({
    action: "people.resume_uploaded",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "vertice_candidate_resume",
    resourceId: rpcResult.resume.id,
    metadata: {
      candidateId,
      filename: file.name,
      sha256,
      deduplicated: rpcResult.deduplicated,
    },
  });

  return ok(rpcResult.resume, { status: rpcResult.deduplicated ? 200 : 201 });
}
