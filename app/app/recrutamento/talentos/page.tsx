import type { Metadata } from "next";
import { TalentosClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Banco de Talentos" };

export default function TalentosPage() {
  return <TalentosClient />;
}
