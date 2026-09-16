import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerCandidateResume,
  type RegisterCandidateResumeInput,
  type ResumeRegistrationError,
} from "@/lib/people/resume-registration";
import { calculateSha256 } from "@/lib/people/services";
import type { CandidateResume } from "@/lib/people/types";

const bytes = Buffer.from("%PDF-1.7\nresume bytes");
const sha256 = calculateSha256(bytes);
const input: RegisterCandidateResumeInput = {
  organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  candidateId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  originalFilename: "curriculo.pdf",
  mimeType: "application/pdf",
  fileSizeBytes: bytes.length,
  sha256,
  bytes,
};

const legacyPath = `${input.organizationId}/${input.candidateId}/${sha256}.pdf`;

function resume(overrides: Partial<CandidateResume> = {}): CandidateResume {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    organization_id: input.organizationId,
    candidate_id: input.candidateId,
    storage_path: legacyPath,
    original_filename: input.originalFilename,
    mime_type: input.mimeType,
    file_size_bytes: input.fileSizeBytes,
    sha256: input.sha256,
    source_type: "manual",
    source_mailbox: null,
    source_message_id: null,
    received_at: "2026-09-15T23:00:00.000Z",
    parser_status: "pending",
    parsed_at: null,
    extraction_metadata: {},
    is_current: true,
    created_at: "2026-09-15T23:00:00.000Z",
    updated_at: "2026-09-15T23:00:00.000Z",
    ...overrides,
  };
}

interface HarnessOptions {
  finds?: Array<{ data: CandidateResume | null; error?: object | null }>;
  storageReferences?: Array<{ data: { id: string } | null; error?: object | null }>;
  rpcs?: Array<{ data: { resume: CandidateResume; deduplicated: boolean } | null; error?: object | null }>;
  uploadError?: object | null;
  removeErrors?: Array<object | null>;
}

function harness(options: HarnessOptions = {}) {
  const finds = [...(options.finds ?? [])];
  const storageReferences = [...(options.storageReferences ?? [])];
  const rpcs = [...(options.rpcs ?? [])];
  const removeErrors = [...(options.removeErrors ?? [])];
  let filters: Record<string, unknown> = {};
  const upload = vi.fn(async () => ({ data: null, error: options.uploadError ?? null }));
  const remove = vi.fn(async () => ({ data: null, error: removeErrors.shift() ?? null }));
  const rpc = vi.fn(async () => rpcs.shift() ?? { data: null, error: { code: "P0001" } });
  const maybeSingle = vi.fn(async () => {
    if ("storage_path" in filters) return storageReferences.shift() ?? { data: null, error: null };
    return finds.shift() ?? { data: null, error: null };
  });
  const query = {
    select: vi.fn(() => {
      filters = {};
      return query;
    }),
    eq: vi.fn((key: string, value: unknown) => {
      filters[key] = value;
      return query;
    }),
    maybeSingle,
  };
  const from = vi.fn(() => query);
  const storageFrom = vi.fn(() => ({ upload, remove }));
  const client = { from, rpc, storage: { from: storageFrom } } as unknown as SupabaseClient;
  return { client, upload, remove, rpc, maybeSingle };
}

async function expectRegistrationError(
  promise: Promise<unknown>,
  code: ResumeRegistrationError["code"],
) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("People resume registration storage orchestration", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("promove dedupe existente sem fazer upload", async () => {
    const existing = resume();
    const h = harness({
      finds: [{ data: existing }],
      rpcs: [{ data: { resume: existing, deduplicated: true } }],
    });

    const result = await registerCandidateResume(h.client, input);
    expect(result).toMatchObject({ deduplicated: true, storage: "skipped" });
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.rpc).toHaveBeenCalledOnce();
  });

  it("gera um object key Ãºnico por tentativa e nunca reutiliza colisÃ£o fÃ­sica", async () => {
    const row = resume({ storage_path: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbb/attempt.pdf" });
    const h = harness({
      finds: [{ data: null }],
      rpcs: [{ data: { resume: row, deduplicated: false } }],
    });

    const result = await registerCandidateResume(h.client, input);
    const uploadedPath = h.upload.mock.calls[0]?.[0] as string;
    expect(result.storage).toBe("created");
    expect(uploadedPath).toMatch(
      new RegExp(`^${input.organizationId}/${input.candidateId}/[0-9a-f-]{36}\\.pdf$`),
    );
    expect(h.upload).toHaveBeenCalledWith(uploadedPath, bytes, expect.objectContaining({ upsert: false }));
  });

  it("converge duas chamadas candidato+SHA em object keys distintos", async () => {
    const row = resume();
    const first = harness({
      finds: [{ data: null }],
      rpcs: [{ data: { resume: { ...row, storage_path: "winner" }, deduplicated: false } }],
    });
    const second = harness({
      finds: [{ data: null }],
      rpcs: [{ data: { resume: row, deduplicated: true } }],
    });

    await Promise.all([
      registerCandidateResume(first.client, input),
      registerCandidateResume(second.client, input),
    ]);
    expect(first.upload.mock.calls[0]?.[0]).not.toBe(second.upload.mock.calls[0]?.[0]);
  });

  it("remove somente o objeto criado pelo request quando a RPC falha antes do commit", async () => {
    const h = harness({
      finds: [{ data: null }, { data: null }, { data: null }],
      rpcs: [{ data: null, error: { code: "P0001" } }],
      removeErrors: [null],
    });

    await expectRegistrationError(registerCandidateResume(h.client, input), "database_error");
    const uploadedPath = h.upload.mock.calls[0]?.[0];
    expect(h.remove).toHaveBeenCalledExactlyOnceWith([uploadedPath]);
  });

  it("trata resposta perdida apÃ³s commit como sucesso e preserva o objeto vencedor", async () => {
    const committed = resume({ storage_path: "winner-path" });
    const h = harness({
      finds: [{ data: null }, { data: committed }],
      rpcs: [{ data: null, error: { code: "network" } }],
    });

    const result = await registerCandidateResume(h.client, input);
    expect(result.recoveredAfterRpc).toBe(true);
    expect(result.resume.id).toBe(committed.id);
    expect(h.remove).toHaveBeenCalledOnce();
    expect(h.remove.mock.calls[0]?.[0][0]).not.toBe(committed.storage_path);
  });

  it("limpa somente o objeto da tentativa ao recuperar vencedor em outro path", async () => {
    const committed = resume({ storage_path: "legacy-path" });
    const h = harness({
      finds: [{ data: null }, { data: committed }],
      rpcs: [{ data: null, error: { code: "network" } }],
      removeErrors: [null],
    });

    const result = await registerCandidateResume(h.client, input);
    expect(result.recoveredAfterRpc).toBe(true);
    expect(h.remove).toHaveBeenCalledOnce();
    expect(h.remove.mock.calls[0]?.[0][0]).not.toBe(committed.storage_path);
  });

  it("nunca remove objeto preexistente quando o upload retorna colisÃ£o", async () => {
    const h = harness({
      finds: [{ data: null }],
      uploadError: { statusCode: 409, message: "already exists" },
    });

    await expectRegistrationError(registerCandidateResume(h.client, input), "storage_conflict");
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("nunca remove um object key jÃ¡ referenciado por qualquer resume", async () => {
    const h = harness({
      finds: [{ data: null }, { data: null }, { data: null }],
      storageReferences: [{ data: { id: "resume-reference" } }],
      rpcs: [{ data: null, error: { code: "P0001" } }],
    });

    await expectRegistrationError(registerCandidateResume(h.client, input), "cleanup_failed");
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("torna falha de cleanup visÃ­vel quando nÃ£o existe vencedor", async () => {
    const h = harness({
      finds: [{ data: null }, { data: null }, { data: null }],
      rpcs: [{ data: null, error: { code: "P0001" } }],
      removeErrors: [{ statusCode: 500 }],
    });

    await expectRegistrationError(registerCandidateResume(h.client, input), "cleanup_failed");
    expect(h.remove).toHaveBeenCalledOnce();
  });
});
