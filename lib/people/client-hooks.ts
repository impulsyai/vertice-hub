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
        return await apiClient.get<PaginatedResponse<ClientCompany>>(`/api/v1/people/companies?${qs.toString()}`);
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
      return await apiClient.post<ClientCompany>("/api/v1/people/companies", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-companies"] });
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
        return await apiClient.get<PaginatedResponse<VerticeCandidate>>(`/api/v1/people/candidates?${qs.toString()}`);
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
        return await apiClient.get<{ candidate: VerticeCandidate; resumes: VerticeCandidateResume[]; applications: VerticeJobApplication[] }>(
          `/api/v1/people/candidates/${candidateId}`,
        );
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
      return await apiClient.post<VerticeCandidate>("/api/v1/people/candidates", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-candidates"] });
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
        return await apiClient.get<PaginatedResponse<VerticeCandidateResume>>(`/api/v1/people/resumes?${qs.toString()}`);
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
        return await apiClient.get<PaginatedResponse<VerticeJobOpening>>(`/api/v1/people/jobs?${qs.toString()}`);
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
        return await apiClient.get<{ job: VerticeJobOpening; applications: VerticeJobApplication[] }>(
          `/api/v1/people/jobs/${jobId}`,
        );
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
      return await apiClient.post<VerticeJobOpening>("/api/v1/people/jobs", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-jobs"] });
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
        return await apiClient.get<PaginatedResponse<VerticeJobApplication>>(`/api/v1/people/applications?${qs.toString()}`);
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
      return await apiClient.post<VerticeJobApplication>("/api/v1/people/applications", body);
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
      return await apiClient.patch<VerticeJobApplication>(`/api/v1/people/applications/${id}/stage`, { stage, notes });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people-applications"] });
      qc.invalidateQueries({ queryKey: ["people-candidates"] });
    },
    onError: (err) => showApiError(err),
  });
}
