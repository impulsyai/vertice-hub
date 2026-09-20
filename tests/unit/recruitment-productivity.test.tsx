import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GroupedJobSelect } from "@/components/recruitment/GroupedJobSelect";
import { CandidateResumePreviewDialog } from "@/components/recruitment/CandidateResumePreviewDialog";
import type { VerticeJobOpening } from "@/lib/people/types";

const { apiGet } = vi.hoisted(() => ({
  apiGet: vi.fn().mockResolvedValue({
    data: {
      url: "https://storage.example.test/signed-resume.pdf",
      filename: "resume.pdf",
      mime_type: "application/pdf",
    },
  }),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: apiGet },
}));

afterEach(() => {
  cleanup();
  apiGet.mockClear();
});

function job(id: string, title: string, company: string): VerticeJobOpening {
  return {
    id,
    title,
    client_company: {
      trade_name: company,
      legal_name: company,
    } as VerticeJobOpening["client_company"],
  } as VerticeJobOpening;
}

describe("produtividade do recrutamento", () => {
  it("agrupa vagas por empresa e exibe o total do grupo", () => {
    render(
      <GroupedJobSelect
        jobs={[
          job("1", "Analista Fiscal", "Tramontina"),
          job("2", "Gerente de Operações", "Tramontina"),
        ]}
        value=""
        onValueChange={() => undefined}
        placeholder="Selecione uma vaga"
        countLabel="vagas abertas"
      />,
    );

    fireEvent.pointerDown(screen.getByTestId("grouped-job-select"));

    expect(screen.getByText("Tramontina")).toBeInTheDocument();
    expect(screen.getByText("2 vagas abertas")).toBeInTheDocument();
    expect(screen.getByText("Analista Fiscal")).toBeInTheDocument();
  });

  it("abre o modal de visualização e solicita uma URL assinada inline", async () => {
    render(
      <CandidateResumePreviewDialog
        open
        onOpenChange={() => undefined}
        resume={{
          id: "resume-1",
          original_filename: "resume.pdf",
          mime_type: "application/pdf",
        }}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Visualizar Currículo")).toBeInTheDocument();
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/people/resumes/resume-1/download?inline=1"),
    );
    expect((await screen.findAllByTitle("resume.pdf")).length).toBeGreaterThanOrEqual(2);
  });
});
