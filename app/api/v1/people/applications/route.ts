import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { createApplicationSchema } from "@/lib/people/schemas";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authz = await requireRole("viewer");
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const jobOpeningId = url.searchParams.get("job_opening_id")?.trim() || "";
  const candidateId = url.searchParams.get("candidate_id")?.trim() || "";
  const stage = url.searchParams.get("stage")?.trim() || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "25", 10)));
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("vertice_job_applications")
    .select(
        "*, candidate:vertice_candidates!vertice_applications_org_cand_fk(*), job:vertice_job_openings!vertice_applications_org_job_fk(*, company:client_companies!vertice_job_openings_org_company_fk(*)), resume:vertice_candidate_resumes!vertice_applications_org_cand_resume_fk(*)",
      { count: "exact" },
    )
    .eq("organization_id", authz.org.orgId)
    .order("stage_changed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (jobOpeningId) {
    query = query.eq("job_opening_id", jobOpeningId);
  }
  if (candidateId) {
    query = query.eq("candidate_id", candidateId);
  }
  if (stage) {
    query = query.eq("stage", stage);
  }

  const { data, error, count } = await query;

  if (error) {
    return fail("database_error", error.message, 500);
  }

  return ok({
    data: data || [],
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", "JSON inválido.", 400);
  }

  const parsed = createApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message || "Dados inválidos", 422);
  }

  const supabase = await createClient();

  // 1. Validar que a Vaga pertence à organização e está rigorosamente 'open'
  const { data: job } = await supabase
    .from("vertice_job_openings")
    .select("id, status")
    .eq("id", parsed.data.job_opening_id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (!job) {
    return fail("job_not_found", "Vaga não encontrada na organização.", 404);
  }

  if (job.status !== "open") {
    return fail(
      "job_not_open",
      `Candidaturas só podem ser criadas para vagas abertas (status atual: '${job.status}').`,
      422
    );
  }

  // 2. Validar que o Candidato pertence à mesma organização
  const { data: candidate } = await supabase
    .from("vertice_candidates")
    .select("id, status")
    .eq("id", parsed.data.candidate_id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (!candidate) {
    return fail("candidate_not_found", "Candidato não encontrado na organização.", 404);
  }

  // 3. Checar duplicidade (Candidate x Job)
  const { data: existingApp } = await supabase
    .from("vertice_job_applications")
    .select("id")
    .eq("job_opening_id", parsed.data.job_opening_id)
    .eq("candidate_id", parsed.data.candidate_id)
    .maybeSingle();

  if (existingApp) {
    return fail("already_applied", "Candidato já está inscrito nesta vaga.", 409);
  }

  // 4. Validar titularidade do currículo (Resume Ownership)
  let resumeId = parsed.data.resume_id || null;

  if (resumeId) {
    const { data: resumeCheck } = await supabase
      .from("vertice_candidate_resumes")
      .select("id, candidate_id, organization_id")
      .eq("id", resumeId)
      .maybeSingle();

    if (!resumeCheck) {
      return fail("resume_not_found", "Currículo informado não foi encontrado.", 404);
    }

    if (
      resumeCheck.organization_id !== authz.org.orgId ||
      resumeCheck.candidate_id !== parsed.data.candidate_id
    ) {
      return fail(
        "resume_ownership_mismatch",
        "O currículo informado não pertence a este candidato ou à mesma organização.",
        422
      );
    }
  } else {
    // Se não fornecido, puxa o currículo ativo (is_current) do candidato
    const { data: currentResume } = await supabase
      .from("vertice_candidate_resumes")
      .select("id")
      .eq("candidate_id", parsed.data.candidate_id)
      .eq("organization_id", authz.org.orgId)
      .eq("is_current", true)
      .maybeSingle();

    if (currentResume) {
      resumeId = currentResume.id;
    }
  }

  // 5. Inserir candidatura
  const { data: created, error: insertError } = await supabase
    .from("vertice_job_applications")
    .insert({
      organization_id: authz.org.orgId,
      job_opening_id: parsed.data.job_opening_id,
      candidate_id: parsed.data.candidate_id,
      resume_id: resumeId,
      stage: parsed.data.stage || "received",
      source: parsed.data.source || "manual",
      recruiter_id: parsed.data.recruiter_id || authz.user.id,
      notes: parsed.data.notes || null,
      stage_changed_at: new Date().toISOString(),
    })
    .select(
      "*, candidate:vertice_candidates!vertice_applications_org_cand_fk(*), job:vertice_job_openings!vertice_applications_org_job_fk(*)",
    )
    .single();

  if (insertError || !created) {
    return fail("database_error", insertError?.message || "Erro ao criar candidatura", 500);
  }

  await audit({
    action: "people.application_created",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "vertice_job_application",
    resourceId: created.id,
    metadata: { job_id: created.job_opening_id, candidate_id: created.candidate_id },
  });

  return ok(created, { status: 201 });
}
