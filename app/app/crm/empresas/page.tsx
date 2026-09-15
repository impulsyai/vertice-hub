import type { Metadata } from "next";
import { EmpresasClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Empresas Clientes" };

export default function EmpresasPage() {
  return <EmpresasClient />;
}
