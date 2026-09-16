"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import type {
  ClientCompany,
  VerticeCandidate,
  VerticeCandidateResume,
  VerticeJobOpening,
  VerticeJobApplication,
  RecruitmentStage,
} from "./types";

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ApiEnvelope<T> {
  data: T;
}

type CandidateDetailRow = VerticeCandidate & {
  resumes?: VerticeCandidateResume[];
  applications?: VerticeJobApplication[];
};

type JobDetailRow = VerticeJobOpening & {
  applications?: VerticeJobApplication[];
};

function unwrap<T>(response: ApiEnvelope<T>): T {
  return response.data;
}

// ---------------------------------------------------------------------------
// Client Companies
// ---------------------------------------------------------------------------

export function useCompanyList(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));

  return useQuery({
    queryKey: ["people-companies", params],
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiEnvelope<PaginatedResponse<ClientCompany>>>(
          `/api/v1/people/companies?${qs.toString()}`,
        );
        return unwrap(response);
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await apiClient.post<ApiEnvelope<ClientCompany>>("/api/v1/people/companies", body);
      return unwrap(response);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-companies"] });
    },
    onError: (err) => showApiError(err),
  });
}

export function useUpdateCompany(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await apiClient.patch<ApiEnvelope<ClientCompany>>(`/api/v1/people/companies/${id}`, body);
      return unwrap(response);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-companies"] });
      qc.invalidateQueries({ queryKey: ["people-company-detail", id] });
    },
    onError: (err) => showApiError(err),
  });
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export function useCandidateList(params?: {
  search?: string;
  status?: string;
  seniority?: string;
  area?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  if (params?.seniority) qs.set("seniority", params.seniority);
  if (params?.area) qs.set("area", params.area);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));

  return useQuery({
    queryKey: ["people-candidates", params],
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiEnvelope<PaginatedResponse<VerticeCandidate>>>(
          `/api/v1/people/candidates?${qs.toString()}`,
        );
        return unwrap(response);
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
  });
}

export function useCandidateDetail(candidateId?: string | null) {
  return useQuery({
    queryKey: ["people-candidate-detail", candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiEnvelope<CandidateDetailRow>>(
          `/api/v1/people/candidates/${candidateId}`,
        );
        const row = unwrap(response);
        const { resumes = [], applications = [], ...candidate } = row;
        return { candidate: candidate as VerticeCandidate, resumes, applications };
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
  });
}

export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await apiClient.post<ApiEnvelope<VerticeCandidate>>("/api/v1/people/candidates", body);
      return unwrap(response);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-candidates"] });
    },
    onError: (err) => showApiError(err),
  });
}

export function useUpdateCandidate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await apiClient.patch<ApiEnvelope<VerticeCandidate>>(`/api/v1/people/candidates/${id}`, body);
      return unwrap(response);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-candidates"] });
      qc.invalidateQueries({ queryKey: ["people-candidate-detail", id] });
    },
    onError: (err) => showApiError(err),
  });
}

// ---------------------------------------------------------------------------
// Resumes
// ---------------------------------------------------------------------------

export function useResumeList(candidateId?: string) {
  const qs = new URLSearchParams();
  if (candidateId) qs.set("candidate_id", candidateId);

  return useQuery({
    queryKey: ["people-resumes", candidateId],
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiEnvelope<PaginatedResponse<VerticeCandidateResume>>>(
          `/api/v1/people/resumes?${qs.toString()}`,
        );
        return unwrap(response);
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export function useJobList(params?: {
  search?: string;
  status?: string;
  client_company_id?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  if (params?.client_company_id) qs.set("client_company_id", params.client_company_id);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));

  return useQuery({
    queryKey: ["people-jobs", params],
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiEnvelope<PaginatedResponse<VerticeJobOpening>>>(
          `/api/v1/people/jobs?${qs.toString()}`,
        );
        return unwrap(response);
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
  });
}

export function useJobDetail(jobId?: string | null) {
  return useQuery({
    queryKey: ["people-job-detail", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiEnvelope<JobDetailRow>>(
          `/api/v1/people/jobs/${jobId}`,
        );
        const row = unwrap(response);
        const { applications = [], ...job } = row;
        return { job: job as VerticeJobOpening, applications };
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await apiClient.post<ApiEnvelope<VerticeJobOpening>>("/api/v1/people/jobs", body);
      return unwrap(response);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-jobs"] });
    },
    onError: (err) => showApiError(err),
  });
}

export function useUpdateJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await apiClient.patch<ApiEnvelope<VerticeJobOpening>>(`/api/v1/people/jobs/${id}`, body);
      return unwrap(response);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-jobs"] });
      qc.invalidateQueries({ queryKey: ["people-job-detail", id] });
      qc.invalidateQueries({ queryKey: ["people-applications"] });
    },
    onError: (err) => showApiError(err),
  });
}

// ---------------------------------------------------------------------------
// Applications & Pipeline
// ---------------------------------------------------------------------------

export function useApplicationList(params?: {
  job_opening_id?: string;
  candidate_id?: string;
  stage?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.job_opening_id) qs.set("job_opening_id", params.job_opening_id);
  if (params?.candidate_id) qs.set("candidate_id", params.candidate_id);
  if (params?.stage) qs.set("stage", params.stage);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));

  return useQuery({
    queryKey: ["people-applications", params],
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiEnvelope<PaginatedResponse<VerticeJobApplication>>>(
          `/api/v1/people/applications?${qs.toString()}`,
        );
        return unwrap(response);
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
  });
}

export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await apiClient.post<ApiEnvelope<VerticeJobApplication>>(
        "/api/v1/people/applications",
        body,
      );
      return unwrap(response);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-applications"] });
      qc.invalidateQueries({ queryKey: ["people-candidates"] });
    },
    onError: (err) => showApiError(err),
  });
}

export function useUpdateApplicationStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage, notes }: { id: string; stage: RecruitmentStage; notes?: string }) => {
      const response = await apiClient.patch<ApiEnvelope<VerticeJobApplication>>(
        `/api/v1/people/applications/${id}/stage`,
        { stage, notes },
      );
      return unwrap(response);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-applications"] });
      qc.invalidateQueries({ queryKey: ["people-candidates"] });
    },
    onError: (err) => showApiError(err),
  });
}
