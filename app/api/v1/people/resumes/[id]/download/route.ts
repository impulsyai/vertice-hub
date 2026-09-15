import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireRole("viewer");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const supabase = await createClient();

  // 1. Localizar registro do currículo e checar tenant
  const { data: resume, error } = await supabase
    .from("vertice_candidate_resumes")
    .select("*")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .single();

  if (error || !resume) {
    return fail("not_found", "Currículo não encontrado.", 404);
  }

  // 2. Gerar Signed URL válida por 60 segundos
  const { data: signed, error: signError } = await supabase.storage
    .from("candidate-resumes")
    .createSignedUrl(resume.storage_path, 60, {
      download: resume.original_filename,
    });

  if (signError || !signed?.signedUrl) {
    return fail("storage_error", signError?.message || "Erro ao gerar URL assinada.", 500);
  }

  return ok({
    url: signed.signedUrl,
    filename: resume.original_filename,
    mime_type: resume.mime_type,
    file_size_bytes: resume.file_size_bytes,
  });
}
