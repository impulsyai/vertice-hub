/**
 * ============================================================================
 * VÉRTICE PEOPLE FOUNDATION — VALIDAÇÃO FORENSE DE ARQUIVOS (MIME + MAGIC BYTES)
 * ============================================================================
 *
 * Garante que arquivos enviados para o bucket privado candidate-resumes:
 * 1. Possuam extensão homologada (.pdf, .doc, .docx).
 * 2. Possuam Content-Type compatível com a extensão.
 * 3. Possuam assinatura binária (magic bytes) legítima, impedindo arquivos
 *    renomeados maliciosamente ou scripts mascarados como currículo.
 */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMime?: string;
}

export const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const EXTENSION_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * Valida o buffer do arquivo contra extensões, MIME declarado e magic bytes.
 */
export function validateResumeFile(
  filename: string,
  declaredMime: string,
  buffer: Uint8Array | Buffer
): FileValidationResult {
  if (!buffer || buffer.length < 8) {
    return { valid: false, error: "Arquivo corrompido ou vazio (tamanho insuficiente)." };
  }

  const lowerName = (filename || "").toLowerCase().trim();
  const extMatch = lowerName.match(/\.[a-z0-9]+$/);
  if (!extMatch) {
    return { valid: false, error: "Nome de arquivo sem extensão válida." };
  }

  const ext = extMatch[0];
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return { valid: false, error: `Extensão '${ext}' não permitida. Formatos aceitos: PDF, DOC e DOCX.` };
  }

  const expectedMime = EXTENSION_TO_MIME[ext];
  if (!ALLOWED_MIME_TYPES.includes(declaredMime as (typeof ALLOWED_MIME_TYPES)[number])) {
    return { valid: false, error: `Tipo MIME '${declaredMime}' não é suportado pelo sistema.` };
  }

  if (declaredMime !== expectedMime) {
    return {
      valid: false,
      error: `Incompatibilidade entre extensão '${ext}' e tipo MIME declarado '${declaredMime}'. Esperado: '${expectedMime}'.`,
    };
  }

  const header = buffer.subarray(0, 8);

  if (ext === ".pdf") {
    // Assinatura PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
    const isPdf =
      header[0] === 0x25 &&
      header[1] === 0x50 &&
      header[2] === 0x44 &&
      header[3] === 0x46 &&
      header[4] === 0x2d;

    if (!isPdf) {
      return { valid: false, error: "Arquivo não possui cabeçalho binário legítimo de PDF (%PDF-)." };
    }

    return { valid: true, detectedMime: "application/pdf" };
  }

  if (ext === ".doc") {
    // Assinatura OLE Compound File: 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1
    const isOle =
      header[0] === 0xd0 &&
      header[1] === 0xcf &&
      header[2] === 0x11 &&
      header[3] === 0xe0 &&
      header[4] === 0xa1 &&
      header[5] === 0xb1 &&
      header[6] === 0x1a &&
      header[7] === 0xe1;

    if (!isOle) {
      return { valid: false, error: "Arquivo não possui assinatura binária válida de documento DOC (OLE)." };
    }

    return { valid: true, detectedMime: "application/msword" };
  }

  if (ext === ".docx") {
    // Assinatura ZIP / OOXML: 0x50, 0x4B seguido por 0x03/0x05/0x07
    const isZip =
      header[0] === 0x50 &&
      header[1] === 0x4b &&
      (header[2] === 0x03 || header[2] === 0x05 || header[2] === 0x07);

    if (!isZip) {
      return { valid: false, error: "Arquivo não possui estrutura válida de pacote DOCX (ZIP/OOXML)." };
    }

    return {
      valid: true,
      detectedMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  return { valid: false, error: "Formato de arquivo não reconhecido." };
}
