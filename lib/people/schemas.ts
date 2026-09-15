import { z } from "zod";

export const companyStatusEnum = z.enum(["active", "prospect", "inactive"]);
export const candidateStatusEnum = z.enum([
  "active",
  "in_process",
  "hired",
  "inactive",
  "do_not_contact",
]);
export const jobStatusEnum = z.enum(["draft", "open", "paused", "closed", "cancelled"]);
export const workModelEnum = z.enum(["presential", "hybrid", "remote"]);
export const employmentTypeEnum = z.enum(["clt", "pj", "internship", "temporary"]);
export const jobPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);
export const applicationStageEnum = z.enum([
  "received",
  "screening",
  "vertice_interview",
  "assessment",
  "shortlist",
  "client_interview",
  "finalist",
  "approved",
  "rejected",
  "withdrawn",
]);

// ─── Company Schemas ───

export const createCompanySchema = z.object({
  legal_name: z.string().trim().min(1, "Razão social é obrigatória").max(255),
  trade_name: z.string().trim().max(255).nullable().optional(),
  cnpj: z.string().trim().max(20).nullable().optional(),
  industry: z.string().trim().max(100).nullable().optional(),
  website: z.string().trim().url("URL inválida").max(255).nullable().optional().or(z.literal("")),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(50).nullable().optional(),
  status: companyStatusEnum.default("active"),
  notes: z.string().max(5000).nullable().optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

// ─── Candidate Schemas ───

export const createCandidateSchema = z.object({
  full_name: z.string().trim().min(1, "Nome é obrigatório").max(255),
  email: z.string().trim().email("E-mail inválido").max(255).nullable().optional().or(z.literal("")),
  phone_e164: z.string().trim().regex(/^\+\d{8,15}$/, "Formato deve ser E.164 (+55...)").nullable().optional().or(z.literal("")),
  linkedin_url: z.string().trim().url("URL inválida").max(255).nullable().optional().or(z.literal("")),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(50).nullable().optional(),
  current_job_title: z.string().trim().max(150).nullable().optional(),
  current_role: z.string().trim().max(150).nullable().optional(),
  current_company: z.string().trim().max(150).nullable().optional(),
  area: z.string().trim().max(100).nullable().optional(),
  seniority: z.string().trim().max(50).nullable().optional(),
  expected_salary: z.coerce.number().positive().nullable().optional(),
  availability: z.string().trim().max(100).nullable().optional(),
  status: candidateStatusEnum.default("active"),
  source: z.string().trim().max(50).default("manual"),
  contact_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const updateCandidateSchema = createCandidateSchema.partial();

// ─── Job Schemas ───

export const createJobSchema = z.object({
  client_company_id: z.string().uuid("ID da empresa cliente é obrigatório"),
  title: z.string().trim().min(1, "Título da vaga é obrigatório").max(255),
  department: z.string().trim().max(100).nullable().optional(),
  location: z.string().trim().max(150).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(50).nullable().optional(),
  work_model: workModelEnum.default("presential"),
  employment_type: employmentTypeEnum.default("clt"),
  description: z.string().max(10000).nullable().optional(),
  requirements: z.string().max(10000).nullable().optional(),
  responsibilities: z.string().max(10000).nullable().optional(),
  salary_min: z.coerce.number().positive().nullable().optional(),
  salary_max: z.coerce.number().positive().nullable().optional(),
  benefits: z.string().max(5000).nullable().optional(),
  openings_count: z.coerce.number().int().min(1).default(1),
  priority: jobPriorityEnum.default("medium"),
  recruiter_id: z.string().uuid().nullable().optional(),
  status: jobStatusEnum.default("open"),
  closing_date: z.string().date().nullable().optional(),
});

export const updateJobSchema = createJobSchema.partial();

// ─── Application Schemas ───

export const createApplicationSchema = z.object({
  job_opening_id: z.string().uuid("ID da vaga é obrigatório"),
  candidate_id: z.string().uuid("ID do candidato é obrigatório"),
  resume_id: z.string().uuid().nullable().optional(),
  stage: applicationStageEnum.default("received"),
  source: z.string().trim().max(50).default("manual"),
  recruiter_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const updateApplicationStageSchema = z.object({
  stage: applicationStageEnum,
  rejection_reason: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
