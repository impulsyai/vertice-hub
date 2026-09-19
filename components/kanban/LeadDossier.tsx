"use client";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import Link from "next/link";
import { Buildings, User, Calendar, Plus } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLeadTimeline } from "@/hooks/leads/useLeadTimeline";
import { useTasks } from "@/hooks/tasks/useTasks";
import { FormularioDeTarefa } from "@/app/app/tasks/_components/FormularioDeTarefa";
import type { Lead } from "@/lib/types/leads";
import { ConversaNoDossie } from "./ConversaNoDossie";
import { LeadFieldsForm } from "./LeadFieldsForm";
import { ScoreSlot } from "./ScoreSlot";
import { LeadTimeline } from "./LeadTimeline";
import { OwnerBadge } from "./OwnerBadge";
import { resolveLeadOwner } from "@/lib/kanban/owner";
import type { CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead;
  pipelineId: string;
  fieldDefs?: CustomFieldDef[];
  stageName: string;
  ownerNames?: Map<string, string | null>;
}

function formatBRL(cents: number | null, currency: string | null): string {
  if (cents === null) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency ?? "BRL",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `R$ ${(cents / 100).toFixed(0)}`;
  }
}

/**
 * O dossiê do negócio: cabeçalho vivo → timeline → campos.
 *
 * A ORDEM É a mudança em relação ao diálogo de edição: quem abre um lead quer
 * primeiro saber O QUE ACONTECEU, e só depois mexer. O formulário íntegro fica
 * por último, e o cabeçalho tem um atalho para ele — ordem preservada, custo de
 * rolagem resolvido.
 *
 * SALVAR NÃO FECHA. Quem edita precisa ver a atividade que acabou de gerar
 * entrar na timeline; fechar esconderia o registro justamente de quem o
 * produziu, e a funcionalidade que prova "sua ação fica registrada" provaria
 * isso para todo mundo menos para o autor.
 */
export function LeadDossier({
  open,
  onOpenChange,
  lead,
  pipelineId,
  fieldDefs = [],
  stageName,
  ownerNames,
}: Props) {
  const tagDoIdioma = useTagDeIdioma();
  const t = useT();
  const campos = useRef<HTMLDivElement | null>(null);
  const timeline = useLeadTimeline(open ? lead.id : null, lead.contact_id);
  const owner = resolveLeadOwner(lead, ownerNames);
  const score = lead.score ?? null;

  const queryClient = useQueryClient();
  const { criarTarefa } = useTasks();
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskKey, setTaskKey] = useState(0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md"
        // Observável pelo mesmo motivo do board: "a assinatura morreu" e "nada
        // aconteceu" têm a mesma aparência, que é silêncio.
        data-realtime-status={timeline.realtimeStatus.toLowerCase()}
        // Observável como no board: "a entrega morreu" e "nada aconteceu"
        // têm a mesma aparência, e no dossiê a segunda é ainda mais crível —
        // negócio sem novidade é um estado normal.
        data-refetch-divergencias={timeline.seguranca.divergencias}
      >
        <SheetHeader className="pb-3">
          <SheetTitle className="text-base leading-6">{lead.title}</SheetTitle>
        </SheetHeader>

        {/* ① cabeçalho vivo */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border pb-3 text-xs">
          <span className="font-medium tabular-nums text-text">
            {formatBRL(lead.value_cents, lead.currency)}
          </span>
          <span className="text-text-muted">{stageName}</span>
          <OwnerBadge
            ownerKind={owner.kind}
            ownerName={owner.name}
            agentVersion={owner.agentVersion}
          />
          {score && (
            // O MESMO componente do card, não uma cópia do medidor.
            // "Superfície nova herda as decisões da antiga" só vale como
            // mecanismo: herdar por cópia é como as duas listas do evidence —
            // funciona hoje e diverge no mês em que alguém mudar um dos dois.
            // De brinde, o rótulo honesto da âncora ("registro que sustenta",
            // nunca "momento da conversa") vem junto, sem eu reescrever nada.
            <ScoreSlot
              probability={score.probability}
              band={score.band}
              reason={score.reason}
              factors={score.factors.slice(0, 3)}
            />
          )}

          <button
            type="button"
            onClick={() => campos.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="ml-auto text-text-muted underline-offset-2 hover:text-text hover:underline"
          >
            {t("Editar campos")}
          </button>
        </div>

        {/* O score NÃO aparece na timeline: recálculo é telemetria e não emite
            atividade (silêncio para telemetria, pulso para mudança de estado).
            Sem esta linha, quem visse o número mudando no cabeçalho e nunca na
            timeline concluiria que a timeline está incompleta. */}
        {score?.at && (
          <p className="pt-2 text-[11px] text-text-muted">
            {t("Probabilidade recalculada automaticamente")} ·{" "}
            {new Date(score.at).toLocaleString(tagDoIdioma)}
          </p>
        )}

        {/* Vínculos Corporativos B2B */}
        {(lead.client_company_id || lead.contact_id || lead.expected_close_date) && (
          <div className="my-3 space-y-2 rounded-lg border border-border/60 bg-accent/5 p-3 text-xs">
            {lead.client_company_id && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <Buildings size={13} className="shrink-0 text-primary" />
                  {t("Empresa vinculada")}:
                </span>
                <Link
                  href={`/app/crm/empresas/${lead.client_company_id}`}
                  className="font-medium text-primary hover:underline truncate max-w-[200px]"
                >
                  {lead.company?.trade_name || lead.company?.legal_name || t("Ver empresa")}
                </Link>
              </div>
            )}

            {lead.contact_id && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <User size={13} className="shrink-0 text-primary" />
                  {t("Decisor / Contato")}:
                </span>
                <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                  <Link
                    href={`/app/contacts/${lead.contact_id}`}
                    className="font-medium text-primary hover:underline truncate"
                  >
                    {lead.contact?.name || t("Ver contato")}
                  </Link>
                  {lead.contact?.role_in_company && (
                    <span className="text-[10px] text-text-muted truncate">
                      ({lead.contact.role_in_company})
                    </span>
                  )}
                </div>
              </div>
            )}

            {lead.expected_close_date && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <Calendar size={13} className="shrink-0 text-primary" />
                  {t("Fechamento previsto")}:
                </span>
                <span className="font-medium text-foreground">{lead.expected_close_date}</span>
              </div>
            )}

            {lead.source && (
              <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
                <span>{t("Origem")}:</span>
                <span className="capitalize">{lead.source}</span>
              </div>
            )}
          </div>
        )}

        <ConversaNoDossie conversa={lead.conversa} />

        {/* ② timeline */}
        <section className="flex-1 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {t("Linha do tempo")}
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={() => {
                setTaskKey((n) => n + 1);
                setTaskFormOpen(true);
              }}
            >
              <Plus size={12} aria-hidden />
              {t("Nova tarefa")}
            </Button>
          </div>
          <LeadTimeline
            itens={timeline.itens}
            chegouAoVivo={timeline.chegouAoVivo}
            isLoading={timeline.isLoading}
            isError={timeline.isError}
          />
        </section>

        {/* ③ campos, por último */}
        <div ref={campos} className="border-t border-border pt-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            {t("Dados do negócio")}
          </h3>
          <LeadFieldsForm lead={lead} pipelineId={pipelineId} fieldDefs={fieldDefs} />
        </div>

        <FormularioDeTarefa
          key={taskKey}
          aberto={taskFormOpen}
          aoMudarAbertura={setTaskFormOpen}
          leadId={lead.id}
          leadTitle={lead.title}
          clientCompanyId={lead.client_company_id}
          contactId={lead.contact_id}
          assignedTo={lead.owner_user_id}
          aoSalvar={async (entrada) => {
            await criarTarefa(entrada);
            await queryClient.invalidateQueries({ queryKey: ["lead_timeline", lead.id] });
            if (lead.contact_id) {
              await queryClient.invalidateQueries({ queryKey: ["lead_timeline", lead.contact_id] });
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
