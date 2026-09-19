import type { Metadata } from "next";
import { EmpresaDetalheClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dossiê da Empresa" };

export default async function EmpresaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmpresaDetalheClient id={id} />;
}
