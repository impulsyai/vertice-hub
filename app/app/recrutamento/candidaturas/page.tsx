import type { Metadata } from "next";
import { CandidaturasClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Candidaturas" };

export default function CandidaturasPage() {
  return <CandidaturasClient />;
}
