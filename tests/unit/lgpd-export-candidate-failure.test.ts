import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";
import { collectExportData } from "@/lib/lgpd/export-collector";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

class Query {
  constructor(private readonly table: string) {}

  select() { return this; }
  eq() { return this; }
  order() { return this; }
  limit() { return this; }

  maybeSingle() {
    if (this.table === "organizations") {
      return Promise.resolve({ data: { legal_name: "Org", display_name: "Org", dpo_email: null }, error: null });
    }
    if (this.table === "contacts") {
      return Promise.resolve({
        data: {
          id: "contact", name: "Pessoa", display_name: "Pessoa", email: null, phone_number: null,
          cpf_encrypted: null, birthdate: null, is_blocked: false, is_anonymized: false,
          consent: null, tags: [], source: null, source_metadata: null,
          created_at: "2026-09-15T00:00:00.000Z", last_activity_at: null,
        },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: { message: "candidate query unavailable" } });
  }

  then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
    const result = this.table === "vertice_candidates"
      ? { data: null, error: { message: "candidate query unavailable" } }
      : { data: [], error: null };
    return Promise.resolve(result).then(resolve, reject);
  }
}

describe("LGPD export — falha na coleta People", () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({ from: (table: string) => new Query(table) } as never);
  });

  it("não devolve sucesso silencioso omitindo candidatos", async () => {
    await expect(
      collectExportData({ organizationId: "org", requestId: "request", contactId: "contact", externalCustomerId: null }),
    ).rejects.toThrow("lgpd_export_candidates_failed");
  });
});
