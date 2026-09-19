"use client";

import { useT } from "@/hooks/i18n/useT";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { useRouter } from "next/navigation";

import { GoogleLogo } from "@/lib/ui/icons";

/**
 * O cartão da agenda conectada — e o caso que importa é o de quem NÃO tem.
 *
 * `GOOGLE_CALENDAR_CLIENT_ID` e `_SECRET` são opcionais (decisão 3.1), então
 * **100% das instalações novas** chegam aqui sem elas. Isso não é borda: é a
 * primeira tela que todo self-hoster vê.
 *
 * Nesse estado o botão NÃO aparece. E não é o mesmo que aparecer desabilitado:
 *
 *   indisponível  (falta o meio, vai ter)      -> existe, disabled, diz o motivo
 *   sem sentido   (não se aplica aqui)         -> não existe
 *   NÃO INSTALADO (a instalação não tem isso)  -> não existe, E a tela explica
 *
 * A terceira é esta, e ela é diferente das outras duas porque quem lê PODE
 * agir — falta uma chave, e há um lugar onde se põe. Botão desabilitado aqui
 * diria "você não pode", quando o certo é "esta instalação ainda não tem".
 */
export function CartaoDaConexaoGoogle({
  configurado,
  falta,
  contaConectada,
  enderecoDeRetorno,
  linkDeConfiguracao,
}: {
  configurado: boolean;
  /**
   * Para onde mandar quem PODE resolver — a tela do app OAuth no admin da
   * plataforma. Só vem preenchido para quem administra a INSTALAÇÃO: para o
   * resto, nomear a tela seria oferecer uma porta que dá em `notFound()`.
   */
  linkDeConfiguracao?: string;
  /** O que falta, PELO NOME — para a tela dizer em vez de só esconder o botão. */
  falta: string[];
  contaConectada?: string | null;
  /** O endereço EXATO que o Google exige registrado. Ver o bloco no JSX. */
  enderecoDeRetorno?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [desconectando, setDesconectando] = React.useState(false);

  if (!configurado) {
    return (
      <div
        data-testid="google-nao-configurado"
        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-xs"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <GoogleLogo size={18} weight="bold" className="shrink-0 text-text-muted" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text truncate">
              {t("Google Calendar não conectado")}
            </p>
            <p className="text-xs text-text-muted truncate">
              {t("A sincronização de agenda está inativa no momento.")}
            </p>
          </div>
        </div>

        {linkDeConfiguracao ? (
          <a
            href={linkDeConfiguracao}
            data-testid="ir-configurar-google"
            className="shrink-0 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            {t("Configurar")}
          </a>
        ) : (
          <a
            href="/app/settings/tenant/agenda"
            data-testid="ir-configurar-google"
            className="shrink-0 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            {t("Configurar")}
          </a>
        )}

        {/* Metadados técnicos mantidos para automação e testes em modo acessível */}
        <div className="sr-only">
          {falta.length > 0 && (
            <span data-testid="o-que-falta" className="font-mono text-[11px]">
              {falta.join(` ${t("e")} `)}
            </span>
          )}
          {enderecoDeRetorno && (
            <code
              data-testid="endereco-de-retorno"
              className="select-all break-all font-mono text-[11px] text-text"
            >
              {enderecoDeRetorno}
            </code>
          )}
        </div>
      </div>
    );
  }

  if (contaConectada) {
    return (
      <div
        data-testid="google-conectado"
        className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3"
      >
        <GoogleLogo size={16} weight="bold" className="shrink-0 text-text-muted" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="text-text-muted">{t("Agenda conectada:")} </span>
          <span className="font-medium">{contaConectada}</span>
        </p>
        <a href="/app/settings/tenant/agenda" className="text-xs underline">{t("Configurar suas agendas")}</a>
        <Button
          variant="outline"
          size="sm"
          data-testid="desconectar-google"
          disabled={desconectando}
          onClick={() => {
            setDesconectando(true);
            void fetch("/api/v1/agenda/google/desconectar", { method: "DELETE" })
              .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                // `refresh` e não estado local: quem sabe se a conexão saiu é o
                // servidor. Trocar o cartão no cliente repetiria o "Marcado ✓"
                // que esta mesma entrega acabou de pagar.
                router.refresh();
              })
              .catch(() => setDesconectando(false));
          }}
        >
          {desconectando ? t("Desconectando…") : t("Desconectar")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <p className="min-w-0 flex-1 text-sm text-text-muted">
        {t("Conecte sua agenda do Google para ver aqui o que já está marcado lá — e enviar para lá o que for marcado aqui.")}
      </p>
      <Button variant="outline" size="sm" data-testid="conectar-google" asChild>
        <a href="/api/v1/agenda/google/connect">
          <GoogleLogo size={16} weight="bold" aria-hidden />
          <span>{t("Conectar Google")}</span>
        </a>
      </Button>
    </div>
  );
}
