import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { calculateSha256 } from "@/lib/people/services";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

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

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return fail("invalid_mime_type", "Apenas arquivos PDF, DOC e DOCX são permitidos.", 415);
  }

  const supabase = await createClient();

  // 1. Validar se o candidato pertence à organização
  const { data: candidate } = await supabase
    .from("vertice_candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (!candidate) {
    return fail("candidate_not_found", "Candidato não encontrado na organização.", 404);
  }

  // 2. Calcular SHA-256 do arquivo
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sha256 = calculateSha256(buffer);

  // 3. Verificar deduplicação por candidato + sha256
  const { data: existingResume } = await supabase
    .from("vertice_candidate_resumes")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("sha256", sha256)
    .maybeSingle();

  if (existingResume) {
    return ok({ ...existingResume, is_duplicate: true }, { status: 200 });
  }

  // 4. Determinar extensão e caminho no bucket privado
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const storagePath = `${authz.org.orgId}/${candidateId}/${sha256}.${ext}`;

  // 5. Upload para o bucket privado 'candidate-resumes'
  const { error: uploadError } = await supabase.storage
    .from("candidate-resumes")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return fail("upload_error", `Falha ao salvar no storage: ${uploadError.message}`, 500);
  }

  // 6. Desativar is_current de versões anteriores do candidato
  await supabase
    .from("vertice_candidate_resumes")
    .update({ is_current: false })
    .eq("candidate_id", candidateId);

  // 7. Criar registro de versão do currículo
  const { data: newResume, error: insertError } = await supabase
    .from("vertice_candidate_resumes")
    .insert({
      organization_id: authz.org.orgId,
      candidate_id: candidateId,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      sha256,
      source_type: "manual",
      parser_status: "pending",
      is_current: true,
    })
    .select()
    .single();

  if (insertError || !newResume) {
    return fail("database_error", insertError?.message || "Erro ao registrar currículo", 500);
  }

  audit({
    action: "people.resume_uploaded",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "vertice_candidate_resume",
    resourceId: newResume.id,
    metadata: { candidateId, filename: file.name, sha256 },
  });

  return ok(newResume, { status: 201 });
}
