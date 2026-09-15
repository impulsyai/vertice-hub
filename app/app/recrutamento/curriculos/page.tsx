import type { Metadata } from "next";
import { CurriculosClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Currículos" };

export default function CurriculosPage() {
  return <CurriculosClient />;
}
