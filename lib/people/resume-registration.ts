import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import type { CandidateResume } from "@/lib/people/types";

const BUCKET = "candidate-resumes";

export type ResumeRegistrationErrorCode =
  | "database_error"
  | "storage_conflict"
  | "cleanup_failed";

export class ResumeRegistrationError extends Error {
  constructor(
    readonly code: ResumeRegistrationErrorCode,
    readonly status: 409 | 500,
  ) {
    super(code);
    this.name = "ResumeRegistrationError";
  }
}

export interface RegisterCandidateResumeInput {
  organizationId: string;
  candidateId: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256: string;
  bytes: Buffer;
  sourceType?: string;
}

export interface RegisterCandidateResumeOptions {
  /** Client administrativo usado somente para remover o object key desta tentativa. */
  cleanupClient?: SupabaseClient;
}

export interface RegisterCandidateResumeResult {
  resume: CandidateResume;
  deduplicated: boolean;
  recoveredAfterRpc: boolean;
  storage: "created" | "skipped";
}

interface RegisterResumeRpcResult {
  resume: CandidateResume;
  deduplicated: boolean;
}

type ExistingResume = Pick<
  CandidateResume,
  | "id"
  | "organization_id"
  | "candidate_id"
  | "storage_path"
  | "original_filename"
  | "mime_type"
  | "file_size_bytes"
  | "sha256"
>;

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { message?: unknown; status?: unknown; statusCode?: unknown };
  const message = typeof value.message === "string" ? value.message.toLowerCase() : "";
  return (
    value.status === 409 ||
    value.statusCode === 409 ||
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("resource already exists")
  );
}

async function findResume(
  supabase: SupabaseClient,
  input: Pick<RegisterCandidateResumeInput, "organizationId" | "candidateId" | "sha256">,
): Promise<ExistingResume | null> {
  const { data, error } = await supabase
    .from("vertice_candidate_resumes")
    .select(
      "id, organization_id, candidate_id, storage_path, original_filename, mime_type, file_size_bytes, sha256",
    )
    .eq("organization_id", input.organizationId)
    .eq("candidate_id", input.candidateId)
    .eq("sha256", input.sha256)
    .maybeSingle();

  if (error) throw new ResumeRegistrationError("database_error", 500);
  return data as ExistingResume | null;
}

async function callRegistrationRpc(
  supabase: SupabaseClient,
  input: RegisterCandidateResumeInput,
  storagePath: string,
  metadata?: ExistingResume,
): Promise<{ data: RegisterResumeRpcResult | null; error: unknown }> {
  const { data, error } = await supabase.rpc("fn_register_candidate_resume", {
    p_org_id: input.organizationId,
    p_candidate_id: input.candidateId,
    p_storage_path: metadata?.storage_path ?? storagePath,
    p_original_filename: metadata?.original_filename ?? input.originalFilename,
    p_mime_type: metadata?.mime_type ?? input.mimeType,
    p_file_size_bytes: metadata?.file_size_bytes ?? input.fileSizeBytes,
    p_sha256: input.sha256,
    p_source_type: input.sourceType ?? "manual",
    p_source_mailbox: null,
    p_source_message_id: null,
  });

  return { data: data as RegisterResumeRpcResult | null, error };
}

async function removeOwnedObject(
  supabase: SupabaseClient,
  cleanupClient: SupabaseClient,
  storagePath: string,
  input: RegisterCandidateResumeInput,
): Promise<{ removed: boolean; owned: boolean }> {
  const expectedPrefix = `${input.organizationId}/${input.candidateId}/`;
  const isOwnedAttemptPath =
    storagePath.startsWith(expectedPrefix) &&
    /^.+\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|doc|docx)$/.test(
      storagePath,
    );
  if (!isOwnedAttemptPath) return { removed: false, owned: false };

  const { data: reference, error: referenceError } = await supabase
    .from("vertice_candidate_resumes")
    .select("id")
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (referenceError || reference) return { removed: false, owned: false };

  const { error } = await cleanupClient.storage.from(BUCKET).remove([storagePath]);
  return { removed: !error, owned: true };
}

function success(
  result: RegisterResumeRpcResult,
  storage: RegisterCandidateResumeResult["storage"],
  recoveredAfterRpc = false,
): RegisterCandidateResumeResult {
  return { ...result, storage, recoveredAfterRpc };
}

async function recoverWinner(
  supabase: SupabaseClient,
  input: RegisterCandidateResumeInput,
  storagePath: string,
  storage: RegisterCandidateResumeResult["storage"],
): Promise<RegisterCandidateResumeResult | null> {
  const winner = await findResume(supabase, input);
  if (!winner) return null;

  const { data, error } = await callRegistrationRpc(supabase, input, storagePath, winner);
  if (error || !data) return null;
  return success(data, storage, true);
}

/**
 * Faz a ponte Storage -> RPC sem assumir que falha de resposta significa
 * rollback no banco. Somente o objeto criado por esta chamada pode ser removido.
 */
export async function registerCandidateResume(
  supabase: SupabaseClient,
  input: RegisterCandidateResumeInput,
  options: RegisterCandidateResumeOptions = {},
): Promise<RegisterCandidateResumeResult> {
  const extension = input.mimeType === "application/pdf" ? "pdf" : input.mimeType === "application/msword" ? "doc" : "docx";
  const storagePath = `${input.organizationId}/${input.candidateId}/${randomUUID()}.${extension}`;
  const cleanupClient = options.cleanupClient ?? supabase;
  const existing = await findResume(supabase, input);
  if (existing) {
    const { data, error } = await callRegistrationRpc(supabase, input, storagePath, existing);
    if (error || !data) {
      const recovered = await recoverWinner(supabase, input, storagePath, "skipped");
      if (recovered) return recovered;
      throw new ResumeRegistrationError("database_error", 500);
    }
    return success(data, "skipped");
  }

  let createdByRequest = false;
  const storage: RegisterCandidateResumeResult["storage"] = "created";
  const bucket = supabase.storage.from(BUCKET);
  const { error: uploadError } = await bucket.upload(storagePath, input.bytes, {
    contentType: input.mimeType,
    upsert: false,
  });

  if (uploadError) {
    if (!isAlreadyExistsError(uploadError)) {
      throw new ResumeRegistrationError("database_error", 500);
    }
    throw new ResumeRegistrationError("storage_conflict", 409);
  } else {
    createdByRequest = true;
  }

  const { data, error } = await callRegistrationRpc(supabase, input, storagePath);
  if (!error && data) {
    if (createdByRequest && data.resume.storage_path !== storagePath) {
      const cleanup = await removeOwnedObject(supabase, cleanupClient, storagePath, input);
      if (!cleanup.removed) {
        logger.error("people.resume_cleanup_failed", {
          reason: "dedupe_path_mismatch",
          organizationId: input.organizationId,
          candidateId: input.candidateId,
        });
        throw new ResumeRegistrationError("cleanup_failed", 500);
      }
    }
    return success(data, storage);
  }

  const committed = await findResume(supabase, input);
  if (committed) {
    if (createdByRequest && committed.storage_path !== storagePath) {
      const cleanup = await removeOwnedObject(supabase, cleanupClient, storagePath, input);
      if (!cleanup.removed) {
        logger.error("people.resume_cleanup_failed", {
          reason: "recovered_winner_path_mismatch",
          organizationId: input.organizationId,
          candidateId: input.candidateId,
        });
        throw new ResumeRegistrationError("cleanup_failed", 500);
      }
    }
    return success({ resume: committed as CandidateResume, deduplicated: true }, storage, true);
  }

  if (!createdByRequest) {
    throw new ResumeRegistrationError("database_error", 500);
  }

  const cleanup = await removeOwnedObject(supabase, cleanupClient, storagePath, input);
  if (cleanup.removed) {
    throw new ResumeRegistrationError("database_error", 500);
  }

  const winner = await recoverWinner(supabase, input, storagePath, storage);
  if (winner) return winner;

  logger.error("people.resume_cleanup_failed", {
    reason: "rpc_failed_and_object_not_removed",
    organizationId: input.organizationId,
    candidateId: input.candidateId,
  });
  throw new ResumeRegistrationError("cleanup_failed", 500);
}

/**
 * Registro usado somente por ingestões server-to-server autenticadas por
 * segredo, como o formulário institucional público.
 *
 * O RPC normal exige `auth.uid()` e deliberadamente não aceita service_role.
 * Isso é correto para o fluxo de usuário autenticado, mas não existe usuário
 * Supabase no formulário público. Este caminho mantém as mesmas invariantes
 * com o client administrativo: todos os reads/writes filtram organização e
 * candidato, há no máximo um currículo atual, e o objeto é removido se o
 * registro relacional falhar.
 */
export async function registerCandidateResumeWithServiceRole(
  supabase: SupabaseClient,
  input: RegisterCandidateResumeInput,
): Promise<RegisterCandidateResumeResult> {
  const existing = await findResume(supabase, input);
  if (existing) {
    const { error: clearError } = await supabase
      .from("vertice_candidate_resumes")
      .update({ is_current: false, updated_at: new Date().toISOString() })
      .eq("organization_id", input.organizationId)
      .eq("candidate_id", input.candidateId)
      .neq("id", existing.id)
      .eq("is_current", true);
    if (clearError) throw new ResumeRegistrationError("database_error", 500);

    const { data, error } = await supabase
      .from("vertice_candidate_resumes")
      .update({ is_current: true, updated_at: new Date().toISOString() })
      .eq("organization_id", input.organizationId)
      .eq("candidate_id", input.candidateId)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) throw new ResumeRegistrationError("database_error", 500);
    return {
      resume: data as CandidateResume,
      deduplicated: true,
      recoveredAfterRpc: false,
      storage: "skipped",
    };
  }

  const extension =
    input.mimeType === "application/pdf"
      ? "pdf"
      : input.mimeType === "application/msword"
        ? "doc"
        : "docx";
  const storagePath = `${input.organizationId}/${input.candidateId}/${randomUUID()}.${extension}`;
  const bucket = supabase.storage.from(BUCKET);
  const { error: uploadError } = await bucket.upload(storagePath, input.bytes, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (uploadError) {
    if (isAlreadyExistsError(uploadError)) {
      throw new ResumeRegistrationError("storage_conflict", 409);
    }
    throw new ResumeRegistrationError("database_error", 500);
  }

  const { data: current, error: currentError } = await supabase
    .from("vertice_candidate_resumes")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("candidate_id", input.candidateId)
    .eq("is_current", true)
    .maybeSingle();
  if (currentError) {
    await bucket.remove([storagePath]);
    throw new ResumeRegistrationError("database_error", 500);
  }

  if (current) {
    const { error: clearError } = await supabase
      .from("vertice_candidate_resumes")
      .update({ is_current: false, updated_at: new Date().toISOString() })
      .eq("organization_id", input.organizationId)
      .eq("candidate_id", input.candidateId)
      .eq("id", current.id)
      .eq("is_current", true);
    if (clearError) {
      await bucket.remove([storagePath]);
      throw new ResumeRegistrationError("database_error", 500);
    }
  }

  const { data, error } = await supabase
    .from("vertice_candidate_resumes")
    .insert({
      organization_id: input.organizationId,
      candidate_id: input.candidateId,
      storage_path: storagePath,
      original_filename: input.originalFilename,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSizeBytes,
      sha256: input.sha256,
      source_type: input.sourceType ?? "manual",
      is_current: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    const cleanup = await bucket.remove([storagePath]);
    if (current) {
      await supabase
        .from("vertice_candidate_resumes")
        .update({ is_current: true, updated_at: new Date().toISOString() })
        .eq("organization_id", input.organizationId)
        .eq("candidate_id", input.candidateId)
        .eq("id", current.id);
    }
    if (cleanup.error) throw new ResumeRegistrationError("cleanup_failed", 500);
    throw new ResumeRegistrationError("database_error", 500);
  }

  return {
    resume: data as CandidateResume,
    deduplicated: false,
    recoveredAfterRpc: false,
    storage: "created",
  };
}
