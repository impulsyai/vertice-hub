import type { Metadata } from "next";
import { CandidatoDetalheClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dossiê do Candidato" };

export default async function CandidatoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CandidatoDetalheClient id={id} />;
}
