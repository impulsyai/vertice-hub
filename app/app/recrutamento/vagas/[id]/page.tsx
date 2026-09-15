import type { Metadata } from "next";
import { VagaDetalheClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Detalhe da Vaga" };

export default async function VagaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VagaDetalheClient id={id} />;
}
