/**
 * Sidebar agrupado por objetivo. O que estes testes protegem:
 *
 *  - a hierarquia existe (o usuário reclamou de 17 itens no mesmo peso visual);
 *  - Funis é alcançável sem passar por Configurações — o achado que originou tudo;
 *  - agrupar não criou cabeçalho órfão (grupo cujos filhos a permissão filtrou);
 *  - colapsado não renderiza título nenhum: 6 rótulos em 64px seria ilegível.
 *
 * A regra de quem-vê-o-quê é do registro e está coberta em
 * `navegacao-registry.test.ts`; aqui é a superfície.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Sidebar } from "@/components/shell/Sidebar";
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";

const authRef: { user: Pick<AuthUser, "is_platform_admin">; activeOrg: ActiveOrg | null } = {
  user: { is_platform_admin: false },
  activeOrg: null,
};

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => authRef,
  usePermission: () => false,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/inbox",
}));
vi.mock("@/components/connections/ConnectionHealthDot", () => ({
  ConnectionHealthDot: () => null,
}));
vi.mock("@/app/actions/shell/toggleSidebar", () => ({
  toggleSidebar: vi.fn(),
}));
// Busca a versão via react-query; sem QueryClientProvider ele lança, e o
// rodapé de versão não é o que estes testes examinam.
vi.mock("@/components/shell/VersionFooter", () => ({
  VersionFooter: () => null,
}));

function comoPapel(role: ActiveOrg["role"]) {
  authRef.user = { is_platform_admin: false };
  authRef.activeOrg = { orgId: "org-1", name: "Org", role };
}

afterEach(cleanup);

describe("Sidebar agrupado", () => {
  it("renderiza os títulos de grupo na ordem de uso", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const titulos = screen
      .getAllByRole("heading")
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    // Organização não tem título aqui: seu hub (Configurações) vive no rodapé
    // fixo, fora da área que rola — medido, ele caía fora da dobra até em 1080px.
    expect(titulos).toEqual(["Início", "Atendimento", "Comercial", "Recrutamento", "Automação & IA", "Canais", "Análise"]);
  });

  it("leva às Etapas do funil pelo Comercial, e não por Configurações", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const hub = screen.getByRole("link", { name: /Ver tudo em Comercial/ });
    expect(hub).toHaveAttribute("href", "/app/crm");
    expect(screen.queryByRole("link", { name: "Etapas do funil" })).toBeNull();
  });

  it("e os dois itens de funil não disputam o mesmo nome", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expect(screen.getByRole("link", { name: "Oportunidades" })).toHaveAttribute("href", "/app/kanban");
  });

  it("desenterra Audit Log — e Nuvemshop ficou de fora, por escolha", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const hubAnalise = screen.getByRole("link", { name: /Ver tudo em Análise/ });
    expect(hubAnalise).toHaveAttribute("href", "/app/analise");
    expect(screen.queryByRole("link", { name: /Audit Log/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Nuvemshop/ })).toBeNull();
  });

  it("Configurações fica no rodapé, nunca dependendo de scroll", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const config = screen.getByRole("link", { name: /Configurações/ });
    expect(config).toHaveAttribute("href", "/app/settings");
    // Fora da <nav> que rola.
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(nav.contains(config)).toBe(false);
  });

  it("não deixa cabeçalho órfão quando a permissão esvazia o grupo", () => {
    // CANAIS é todo manager+/admin. Um agent não pode ver o título sozinho.
    comoPapel("agent");
    render(<Sidebar collapsed={false} />);
    const titulos = screen.getAllByRole("heading").map((el) => el.textContent?.trim());
    expect(titulos).not.toContain("Canais");
    expect(titulos).toContain("Atendimento");
  });

  it("oferece o hub dos grupos que têm um", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expect(screen.getByRole("link", { name: /Ver tudo em IA/ })).toHaveAttribute("href", "/app/ai");
  });

  it("Recrutamento exibe os itens diretos no sidebar e seu hub", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expect(screen.getByRole("link", { name: "Banco de Talentos" })).toHaveAttribute(
      "href",
      "/app/recrutamento/talentos",
    );
    expect(screen.getByRole("link", { name: "Ver tudo em Recrutamento" })).toHaveAttribute(
      "href",
      "/app/recrutamento",
    );
  });

  it("preserva o rótulo do hub quando a personalização esvazia outro grupo", () => {
    comoPapel("admin");
    authRef.activeOrg!.interface_settings = {
      preset: "simplificada",
      destinos: ["/app/products"],
    };
    render(<Sidebar collapsed={false} />);
    expect(screen.getByRole("link", { name: "Ver tudo em Comercial" })).toHaveAttribute(
      "href",
      "/app/crm",
    );
  });

  it("colapsado esconde os títulos mas mantém os links", () => {
    comoPapel("admin");
    render(<Sidebar collapsed />);
    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    expect(screen.getByRole("link", { name: /Conversas/ })).toBeTruthy();
  });

  it("marca a rota atual com aria-current", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expect(screen.getByRole("link", { name: /Conversas/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Oportunidades" })).not.toHaveAttribute("aria-current");
  });
});
