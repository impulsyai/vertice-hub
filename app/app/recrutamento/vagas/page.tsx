import type { Metadata } from "next";
import { VagasClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vagas de Recrutamento" };

export default function VagasPage() {
  return <VagasClient />;
}
