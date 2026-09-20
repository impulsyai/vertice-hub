import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const CLIENTE = fs.readFileSync(path.join(RAIZ, "app", "app", "agenda", "_client.tsx"), "utf8");
const PAINEL = fs.readFileSync(
  path.join(RAIZ, "components", "agenda", "PainelDeMarcacao.tsx"),
  "utf8",
);

describe("modal de novo agendamento", () => {
  it("mantém o Sheet fixo e concentra o scroll no conteúdo do modal", () => {
    const inicioDoSheet = CLIENTE.indexOf("<SheetContent");
    const fimDoSheet = CLIENTE.indexOf(">", inicioDoSheet);
    const propsDoSheet = CLIENTE.slice(inicioDoSheet, fimDoSheet);

    expect(propsDoSheet).toMatch(/h-full/);
    expect(propsDoSheet).toMatch(/max-h-\[100dvh\]/);
    expect(propsDoSheet).toMatch(/overflow-hidden/);
    expect(propsDoSheet).not.toMatch(/lg:overflow-hidden/);

    const inicioDoScroll = CLIENTE.indexOf('data-testid="novo-agendamento-scroll"');
    const trechoDoScroll = CLIENTE.slice(inicioDoScroll, inicioDoScroll + 300);
    expect(trechoDoScroll).toMatch(/min-h-0/);
    expect(trechoDoScroll).toMatch(/flex-1/);
    expect(trechoDoScroll).toMatch(/overflow-y-auto/);
    expect(trechoDoScroll).toMatch(/overscroll-contain/);
  });

  it("deixa a confirmação visível como footer sticky com superfície própria", () => {
    const inicioDaConfirmacao = PAINEL.indexOf('data-testid="confirmacao"');
    const trechoDaConfirmacao = PAINEL.slice(inicioDaConfirmacao - 220, inicioDaConfirmacao);
    const inicioDaColunaDeHorarios = PAINEL.indexOf('data-testid="coluna-de-horarios"');

    expect(trechoDaConfirmacao).toMatch(/sticky/);
    expect(trechoDaConfirmacao).toMatch(/bottom-0/);
    expect(trechoDaConfirmacao).toMatch(/bg-surface/);
    expect(trechoDaConfirmacao).toMatch(/border-t/);
    expect(inicioDaConfirmacao).toBeGreaterThan(inicioDaColunaDeHorarios);
    expect(PAINEL).toMatch(/flex min-w-0 flex-col lg:flex-row/);
  });
});
