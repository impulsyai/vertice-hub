import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateSha256 } from "@/lib/people/services";
import { validateResumeFile } from "@/lib/people/file-validation";
import { registerCandidateResume, ResumeRegistrationError } from "@/lib/people/resume-registration";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(req: NextRequest) {
  const authz = await requireRole("viewer");
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const candidateId = url.searchParams.get("candidate_id")?.trim() || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "25", 10)));
  const offset = (page - 1) * limit;

  const supabase = await createClient();
  let query = supabase
    .from("vertice_candidate_resumes")
    .select("*", { count: "exact" })
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (candidateId) {
    query = query.eq("candidate_id", candidateId);
  }

  const { data, error, count } = await query;
  if (error) {
    return fail("database_error", "NÃ£o foi possÃ­vel listar os currÃ­culos.", 500);
  }

  return ok({
    data: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  });
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
    return fail("file_too_large", "O arquivo excede o limite máximo de 10MB.", 413);
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
  const { data: candidate, error: candidateError } = await supabase
    .from("vertice_candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (candidateError) {
    return fail("database_error", "Não foi possível validar o candidato.", 500);
  }

  if (!candidate) {
    return fail("candidate_not_found", "Candidato não encontrado na organização.", 404);
  }

  // 3. Calcular SHA-256 obrigatório
  const sha256 = calculateSha256(buffer);

  let result;
  try {
    result = await registerCandidateResume(
      supabase,
      {
        organizationId: authz.org.orgId,
        candidateId,
        originalFilename: file.name,
        mimeType: validation.detectedMime || file.type,
        fileSizeBytes: file.size,
        sha256,
        bytes: buffer,
      },
      { cleanupClient: createAdminClient() },
    );
  } catch (error) {
    if (error instanceof ResumeRegistrationError) {
      const messages = {
        storage_conflict: "Já existe um objeto diferente nesse caminho de currículo.",
        cleanup_failed: "O currículo não foi registrado e a limpeza do arquivo falhou.",
        database_error: "Não foi possível registrar o currículo.",
      } as const;
      return fail(error.code, messages[error.code], error.status);
    }
    return fail("database_error", "Não foi possível registrar o currículo.", 500);
  }

  await audit({
    action: "people.resume_uploaded",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "vertice_candidate_resume",
    resourceId: result.resume.id,
    metadata: {
      candidateId,
      filename: file.name,
      sha256,
      deduplicated: result.deduplicated,
      recoveredAfterRpc: result.recoveredAfterRpc,
      storage: result.storage,
    },
  });

  return ok(result.resume, { status: result.deduplicated ? 200 : 201 });
}
