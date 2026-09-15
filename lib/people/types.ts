/**
-- ============================================================================
-- VÉRTICE PEOPLE FOUNDATION — TIPOS DO DOMÍNIO
-- ============================================================================
*/

export type CompanyStatus = "active" | "prospect" | "inactive";

export interface ClientCompany {
  id: string;
  organization_id: string;
  legal_name: string;
  trade_name: string | null;
  cnpj: string | null;
  industry: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  status: CompanyStatus;
  owner_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientCompanyContact {
  id: string;
  organization_id: string;
  client_company_id: string;
  contact_id: string;
  role_in_company: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export type CandidateStatus =
  | "active"
  | "in_process"
  | "hired"
  | "inactive"
  | "do_not_contact";

export interface Candidate {
  id: string;
  organization_id: string;
  contact_id: string | null;
  full_name: string;
  email: string | null;
  email_normalized: string | null;
  phone_e164: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  current_role: string | null;
  current_company: string | null;
  area: string | null;
  seniority: string | null;
  expected_salary: number | null;
  availability: string | null;
  status: CandidateStatus;
  source: string;
  owner_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  current_resume?: CandidateResume | null;
}

export type ResumeParserStatus = "pending" | "parsed" | "failed" | "unsupported";

export interface CandidateResume {
  id: string;
  organization_id: string;
  candidate_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  sha256: string;
  source_type: string;
  source_mailbox: string | null;
  source_message_id: string | null;
  received_at: string;
  parser_status: ResumeParserStatus;
  parsed_at: string | null;
  extraction_metadata: Record<string, unknown>;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export type JobStatus = "draft" | "open" | "paused" | "closed" | "cancelled";
export type WorkModel = "presential" | "hybrid" | "remote";
export type EmploymentType = "clt" | "pj" | "internship" | "temporary";
export type JobPriority = "low" | "medium" | "high" | "urgent";

export interface JobOpening {
  id: string;
  organization_id: string;
  client_company_id: string;
  title: string;
  department: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  work_model: WorkModel;
  employment_type: EmploymentType;
  description: string | null;
  requirements: string | null;
  responsibilities: string | null;
  salary_min: number | null;
  salary_max: number | null;
  benefits: string | null;
  openings_count: number;
  priority: JobPriority;
  recruiter_id: string | null;
  status: JobStatus;
  opened_at: string | null;
  closing_date: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  company?: ClientCompany | null;
  client_company?: ClientCompany | null;
  applications_count?: number;
}

export type ApplicationStage =
  | "received"
  | "screening"
  | "vertice_interview"
  | "assessment"
  | "shortlist"
  | "client_interview"
  | "finalist"
  | "approved"
  | "rejected"
  | "withdrawn";

export interface JobApplication {
  id: string;
  organization_id: string;
  job_opening_id: string;
  candidate_id: string;
  resume_id: string | null;
  stage: ApplicationStage;
  source: string;
  recruiter_id: string | null;
  rejection_reason: string | null;
  notes: string | null;
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
  candidate?: Candidate | null;
  job?: JobOpening | null;
  job_opening?: JobOpening | null;
  resume?: CandidateResume | null;
}

export const APPLICATION_STAGES: { id: ApplicationStage; label: string; order: number }[] = [
  { id: "received", label: "01 RECEBIDO", order: 1 },
  { id: "screening", label: "02 TRIAGEM", order: 2 },
  { id: "vertice_interview", label: "03 ENTREVISTA VÉRTICE", order: 3 },
  { id: "assessment", label: "04 AVALIAÇÃO", order: 4 },
  { id: "shortlist", label: "05 SHORTLIST", order: 5 },
  { id: "client_interview", label: "06 ENTREVISTA CLIENTE", order: 6 },
  { id: "finalist", label: "07 FINALISTA", order: 7 },
  { id: "approved", label: "08 APROVADO", order: 8 },
  { id: "rejected", label: "09 REPROVADO", order: 9 },
  { id: "withdrawn", label: "10 DESISTIU", order: 10 },
];

export type VerticeCandidate = Candidate;
export type VerticeCandidateResume = CandidateResume;
export type VerticeJobOpening = JobOpening;
export type VerticeJobApplication = JobApplication;
export type RecruitmentStage = ApplicationStage;
export const RECRUITMENT_STAGES = APPLICATION_STAGES;
