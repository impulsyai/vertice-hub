import { describe, expect, it } from "vitest";

/**
 * Política de Tags do Vértice Hub e Compatibilidade com o Updater do Deskcomm.
 *
 * A função `ultima_versao_publicada()` em `hostgator-setup-kit/_common.sh` executa:
 *   ref="$(git ls-remote ... | awk '{print $2}' | grep -v -- '-' | head -1)"
 *
 * Qualquer tag contendo hífen (ex: v1.26.0-vertice.1) é sumariamente DESCARTADA
 * pelo filtro `grep -v -- '-'`.
 *
 * Portanto, releases do Vértice Hub publicadas para VPS DEVEM seguir formato SemVer
 * puro sem sufixo de hífen (ex: v1.26.0, v1.26.1, v1.27.0).
 */
describe("Política de Tags e Versionamento do Vértice Hub", () => {
  const REGEX_TAG_ACEITA = /^v\d+\.\d+\.\d+$/;

  it("rejeita tags com hífen pois seriam descartadas pelo updater nativo", () => {
    const tagsComHifen = ["v1.26.0-vertice.1", "v1.25.1-patch1", "v1.26.0-rc1"];
    for (const tag of tagsComHifen) {
      // Simula o filtro nativo `grep -v -- '-'`
      const passaNoFiltro = !tag.includes("-");
      expect(passaNoFiltro).toBe(false);
    }
  });

  it("aceita tags SemVer puras que passam com sucesso no filtro nativo", () => {
    const tagsValidas = ["v1.26.0", "v1.26.1", "v1.27.0"];
    for (const tag of tagsValidas) {
      const passaNoFiltro = !tag.includes("-");
      expect(passaNoFiltro).toBe(true);
      expect(REGEX_TAG_ACEITA.test(tag)).toBe(true);
    }
  });
});
