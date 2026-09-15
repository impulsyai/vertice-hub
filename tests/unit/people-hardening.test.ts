import { describe, expect, it } from "vitest";
import { validateResumeFile } from "@/lib/people/file-validation";
import {
  createCandidateSchema,
  createJobSchema,
  createApplicationSchema,
} from "@/lib/people/schemas";
import { normalizePhone, normalizeLinkedInUrl } from "@/lib/people/services";

describe("Vértice People Hardening — Unit Suite", () => {
  describe("Validação Forense de Arquivos (MIME + Extensão + Magic Bytes)", () => {
    it("aceita PDF válido com assinatura %PDF-", () => {
      const pdfHeader = Buffer.from("%PDF-1.7\n%corpo-sintetico-de-teste-do-curriculo");
      const result = validateResumeFile("curriculo-carlos.pdf", "application/pdf", pdfHeader);
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe("application/pdf");
    });

    it("rejeita arquivo com extensão .pdf mas conteúdo não-PDF (spoofing)", () => {
      const fakePdf = Buffer.from("<html><body>Malicious HTML disguised as PDF</body></html>");
      const result = validateResumeFile("curriculo.pdf", "application/pdf", fakePdf);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/cabeçalho binário legítimo de PDF/i);
    });

    it("aceita DOC (Word Legado) com OLE Compound File Header", () => {
      const docHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
      const result = validateResumeFile("curriculo.doc", "application/msword", docHeader);
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe("application/msword");
    });

    it("aceita DOCX (Word OOXML) com ZIP Header", () => {
      const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
      const result = validateResumeFile(
        "curriculo.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        docxHeader
      );
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    });

    it("rejeita extensão desautorizada (ex: .exe, .sh, .png)", () => {
      const exeHeader = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff");
      const result = validateResumeFile("curriculo.exe", "application/x-msdownload", exeHeader);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Extensão '\.exe' não permitida/);
    });

    it("rejeita divergência entre extensão e MIME", () => {
      const pdfHeader = Buffer.from("%PDF-1.4\ncorpo");
      const result = validateResumeFile("curriculo.docx", "application/pdf", pdfHeader);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Incompatibilidade entre extensão/i);
    });

    it("rejeita arquivo menor que 8 bytes", () => {
      const tiny = Buffer.from("hi");
      const result = validateResumeFile("curriculo.pdf", "application/pdf", tiny);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/tamanho insuficiente/);
    });
  });

  describe("Schemas e Normalização (current_job_title, LinkedIn e E.164)", () => {
    it("aceita current_job_title no schema de candidato", () => {
      const parsed = createCandidateSchema.parse({
        full_name: "Mariana Souza",
        email: "mariana.souza@exemplo.com",
        current_job_title: "Tech Lead",
      });
      expect(parsed.current_job_title).toBe("Tech Lead");
    });

    it("aceita current_role como alias retrocompatível no schema de candidato", () => {
      const parsed = createCandidateSchema.parse({
        full_name: "Mariana Souza",
        email: "mariana.souza@exemplo.com",
        current_role: "Tech Lead Senior",
      });
      expect(parsed.current_role).toBe("Tech Lead Senior");
    });

    it("normaliza telefone E.164 e LinkedIn profile nos helpers", () => {
      const phoneNorm = normalizePhone("(11) 98765-4321");
      expect(phoneNorm).toBe("+5511987654321");

      const linkedinNorm = normalizeLinkedInUrl("https://www.linkedin.com/in/pedro-alcantara/");
      expect(linkedinNorm).toBe("https://www.linkedin.com/in/pedro-alcantara");
    });

    it("createJobSchema valida campos obrigatórios", () => {
      const job = createJobSchema.parse({
        client_company_id: "a0000000-0000-4000-8000-000000000001",
        title: "Engenheiro de Dados Sênior",
        status: "open",
      });
      expect(job.title).toBe("Engenheiro de Dados Sênior");
      expect(job.status).toBe("open");
    });

    it("createApplicationSchema aceita candidate_id e job_opening_id válidos", () => {
      const app = createApplicationSchema.parse({
        candidate_id: "a0000000-0000-4000-8000-000000000002",
        job_opening_id: "a0000000-0000-4000-8000-000000000003",
        stage: "received",
      });
      expect(app.stage).toBe("received");
    });
  });
});
