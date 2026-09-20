import type { Metadata } from "next";
import { NavHub } from "@/components/shell/NavHub";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recrutamento" };

export default async function RecrutamentoHubPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  const idioma = user.idioma;

  return (
    <NavHub
      group="recrutamento"
      isPlatformAdmin={user.is_platform_admin && !user.support}
      role={activeOrg?.role ?? null}
      interfaceSettings={activeOrg?.interface_settings}
      title={traduzir("Recrutamento", idioma)}
      subtitle={traduzir(
        "Banco de talentos, vagas abertas, candidaturas e Funil de Seleção executivo.",
        idioma,
      )}
      locale={idioma}
    />
  );
}
