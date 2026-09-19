import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/wrappers";
export async function GET(req: Request) {
  const requestId = randomUUID();
  const auth = await requireRole("agent", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const input = z
    .object({ contact_id: z.uuid().optional(), q: z.string().max(100).optional() })
    .safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!input.success) return fail("validation_failed", "Confira o contato.", 422, { requestId });
  const db = await createClient();
  let contacts = db
    .from("contacts")
    .select("id, name, email, phone_number")
    .eq("organization_id", auth.org.orgId)
    .eq("is_anonymized", false)
    .order("name")
    .limit(30);
  if (input.data.contact_id) contacts = contacts.eq("id", input.data.contact_id);
  else if (input.data.q)
    contacts = contacts.ilike("name", `%${input.data.q.replace(/[%_]/g, "")}%`);
  const result = await contacts;
  if (result.error)
    return fail("internal_error", "Não foi possível carregar os contatos.", 500, { requestId });

  const contactId = input.data.contact_id;
  const conversations =
    contactId && result.data.length
      ? await db
          .from("conversations")
          .select("id,created_at,status")
          .eq("organization_id", auth.org.orgId)
          .eq("contact_id", contactId)
          .eq("is_group", false)
          .order("created_at", { ascending: false })
          .limit(30)
      : { data: [], error: null };
  if (conversations.error)
    return fail("internal_error", "Não foi possível carregar as conversas.", 500, { requestId });

  let company: { id: string; name: string; role: string | null } | null = null;
  let opportunities: Array<{ id: string; title: string }> = [];

  if (contactId && result.data.length) {
    const { data: links } = await db
      .from("client_company_contacts")
      .select("client_company_id, role_in_company, is_primary")
      .eq("contact_id", contactId);

    const companyId = links?.[0]?.client_company_id;
    if (companyId) {
      const { data: comp } = await db
        .from("client_companies")
        .select("id, trade_name, legal_name")
        .eq("id", companyId)
        .maybeSingle();
      if (comp) {
        company = {
          id: comp.id,
          name: comp.trade_name || comp.legal_name || "Empresa",
          role: links[0]?.role_in_company || null,
        };
      }
    }

    let oppQuery = db
      .from("crm_leads")
      .select("id, title")
      .eq("organization_id", auth.org.orgId);

    if (companyId) {
      oppQuery = oppQuery.or(`contact_id.eq.${contactId},client_company_id.eq.${companyId}`);
    } else {
      oppQuery = oppQuery.eq("contact_id", contactId);
    }

    const { data: opps } = await oppQuery.limit(20);
    opportunities = opps ?? [];
  }

  return ok(
    {
      contacts: result.data,
      conversations: conversations.data,
      company,
      opportunities,
    },
    { requestId }
  );
}
