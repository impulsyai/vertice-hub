"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { useCompanyList, useCompanyDetail } from "@/lib/people/client-hooks";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { Buildings, User, Kanban, UserCircle } from "@/lib/ui/icons";
import type { NovaTarefa, PrioridadeDaTarefa, SituacaoDaTarefa, Tarefa } from "@/lib/tarefas/tipos";

interface Props {
  aberto: boolean;
  aoMudarAbertura: (aberto: boolean) => void;
  /** `null` = criar. */
  tarefa?: Tarefa | null;
  /** `YYYY-MM-DD` vindo do clique numa célula do calendário. */
  prazoSugerido?: string;
  aoSalvar: (entrada: NovaTarefa) => Promise<unknown>;
  leadId?: string | null;
  leadTitle?: string | null;
  clientCompanyId?: string | null;
  contactId?: string | null;
  assignedTo?: string | null;
}

interface LeadOption {
  id: string;
  title: string;
  client_company_id: string | null;
  contact_id: string | null;
  owner_user_id: string | null;
}

/**
 * ISO → os dois campos que a pessoa preenche, no fuso DELA.
 */
function separaPrazo(iso: string | null | undefined): { dia: string; hora: string } {
  if (!iso) return { dia: "", hora: "09:00" };
  const d = new Date(iso);
  const dois = (n: number) => String(n).padStart(2, "0");
  return {
    dia: `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`,
    hora: `${dois(d.getHours())}:${dois(d.getMinutes())}`,
  };
}

export function FormularioDeTarefa({
  aberto,
  aoMudarAbertura,
  tarefa,
  prazoSugerido,
  aoSalvar,
  leadId,
  leadTitle,
  clientCompanyId,
  contactId,
  assignedTo,
}: Props) {
  const t = useT();
  const editando = Boolean(tarefa);

  const prazo = separaPrazo(tarefa?.due_date);
  const [titulo, setTitulo] = useState(tarefa?.title ?? "");
  const [descricao, setDescricao] = useState(tarefa?.description ?? "");
  const [dia, setDia] = useState(tarefa?.due_date ? prazo.dia : (prazoSugerido ?? ""));
  const [hora, setHora] = useState(tarefa?.due_date ? prazo.hora : "09:00");
  const [prioridade, setPrioridade] = useState<PrioridadeDaTarefa>(tarefa?.priority ?? "medium");
  const [situacao, setSituacao] = useState<SituacaoDaTarefa>(tarefa?.status ?? "pending");

  // Vínculos B2B
  const [selectedLeadId, setSelectedLeadId] = useState<string>(tarefa?.lead_id ?? leadId ?? "none");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    tarefa?.client_company_id ?? clientCompanyId ?? "none",
  );
  const [selectedContactId, setSelectedContactId] = useState<string>(
    tarefa?.contact_id ?? contactId ?? "none",
  );
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>(
    tarefa?.assigned_to ?? assignedTo ?? "none",
  );

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Lista de Empresas
  const { data: companiesData, isLoading: loadingCompanies } = useCompanyList({ limit: 100 });
  const companies = companiesData?.data ?? [];

  // Detalhe da Empresa para filtrar contatos
  const activeCompanyId =
    selectedCompanyId && selectedCompanyId !== "none" ? selectedCompanyId : null;
  const { data: companyDetail } = useCompanyDetail(activeCompanyId);
  const companyContacts = useMemo(() => companyDetail?.contacts ?? [], [companyDetail?.contacts]);

  // Lista de Membros Atribuíveis
  const { data: members = [], isLoading: loadingMembers } = useAssignableMembers(true);

  // Lista de Oportunidades
  const { data: leadsData } = useQuery<{ leads: LeadOption[] }>({
    queryKey: ["crm_leads_for_task_form"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads?status=open");
      if (!res.ok) return { leads: [] };
      const json = await res.json();
      return json.data ?? { leads: [] };
    },
    staleTime: 30_000,
  });
  const leads = leadsData?.leads ?? [];

  // Se o usuário seleciona uma oportunidade da lista, auto-preenche empresa, contato e responsável
  function handleLeadChange(newLeadId: string) {
    setSelectedLeadId(newLeadId);
    if (newLeadId !== "none") {
      const found = leads.find((l) => l.id === newLeadId);
      if (found) {
        if (found.client_company_id) {
          setSelectedCompanyId(found.client_company_id);
        }
        if (found.contact_id) {
          setSelectedContactId(found.contact_id);
        }
        if (found.owner_user_id && selectedAssignedTo === "none") {
          setSelectedAssignedTo(found.owner_user_id);
        }
      }
    }
  }

  function handleCompanyChange(newCompanyId: string) {
    setSelectedCompanyId(newCompanyId);
    if (newCompanyId === "none") {
      setSelectedContactId("none");
    } else {
      // Se o contato atual não for da nova empresa, reseta
      if (
        selectedContactId !== "none" &&
        companyContacts.length > 0 &&
        !companyContacts.some((c) => c.contact_id === selectedContactId)
      ) {
        setSelectedContactId("none");
      }
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro(t("Escreva um título para a tarefa."));
      return;
    }
    const prazoCalculado = dia ? new Date(`${dia}T${hora || "00:00"}:00`).toISOString() : null;

    setSalvando(true);
    setErro(null);
    try {
      await aoSalvar({
        title: titulo.trim(),
        description: descricao.trim() || null,
        due_date: prazoCalculado,
        priority: prioridade,
        status: situacao,
        lead_id: selectedLeadId && selectedLeadId !== "none" ? selectedLeadId : null,
        client_company_id:
          selectedCompanyId && selectedCompanyId !== "none" ? selectedCompanyId : null,
        contact_id: selectedContactId && selectedContactId !== "none" ? selectedContactId : null,
        assigned_to:
          selectedAssignedTo && selectedAssignedTo !== "none" ? selectedAssignedTo : null,
      });
      aoMudarAbertura(false);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : t("Não foi possível salvar a tarefa."));
    } finally {
      setSalvando(false);
    }
  }

  // Pre-fixado a partir do dossiê de um lead
  const travadoNoLead = Boolean(leadId);

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAbertura}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? t("Editar tarefa") : t("Nova tarefa")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={enviar} className="space-y-4 pt-1">
          {/* Vínculo de Contexto B2B */}
          {travadoNoLead ? (
            <div className="space-y-1.5 rounded-lg border border-border/70 bg-accent/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Kanban size={14} className="shrink-0 text-primary" />
                <span>{t("Oportunidade")}:</span>
                <span className="text-primary">{leadTitle || t("Negócio ativo")}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {t("Contexto B2B")}
              </p>

              {/* Oportunidade */}
              <div className="space-y-1.5">
                <Label htmlFor="tarefa-oportunidade" className="flex items-center gap-1.5 text-xs">
                  <Kanban size={13} className="shrink-0 text-primary" />
                  {t("Oportunidade comercial (opcional)")}
                </Label>
                <Select value={selectedLeadId} onValueChange={handleLeadChange}>
                  <SelectTrigger id="tarefa-oportunidade" className="h-9 text-xs">
                    <SelectValue placeholder={t("Selecione uma oportunidade...")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none">{t("Nenhuma oportunidade")}</SelectItem>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Empresa */}
                <div className="space-y-1.5">
                  <Label htmlFor="tarefa-empresa" className="flex items-center gap-1.5 text-xs">
                    <Buildings size={13} className="shrink-0 text-primary" />
                    {t("Empresa cliente")}
                  </Label>
                  <Select
                    value={selectedCompanyId}
                    onValueChange={handleCompanyChange}
                    disabled={loadingCompanies}
                  >
                    <SelectTrigger id="tarefa-empresa" className="h-9 text-xs">
                      <SelectValue placeholder={t("Selecione a empresa...")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="none">{t("Nenhuma empresa")}</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.trade_name || c.legal_name || t("Empresa sem nome")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contato / Decisor */}
                <div className="space-y-1.5">
                  <Label htmlFor="tarefa-contato" className="flex items-center gap-1.5 text-xs">
                    <User size={13} className="shrink-0 text-primary" />
                    {t("Decisor / Contato")}
                  </Label>
                  <Select
                    value={selectedContactId}
                    onValueChange={setSelectedContactId}
                    disabled={activeCompanyId ? companyContacts.length === 0 : false}
                  >
                    <SelectTrigger id="tarefa-contato" className="h-9 text-xs">
                      <SelectValue
                        placeholder={
                          activeCompanyId && companyContacts.length === 0
                            ? t("Empresa sem contatos")
                            : t("Selecione o decisor...")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="none">{t("Nenhum contato")}</SelectItem>
                      {companyContacts.map((ct) => (
                        <SelectItem key={ct.contact_id} value={ct.contact_id}>
                          {rotuloDoContato(ct.contact, t)}
                          {ct.role_in_company ? ` (${ct.role_in_company})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Responsável */}
          <div className="space-y-1.5">
            <Label htmlFor="tarefa-responsavel" className="flex items-center gap-1.5 text-xs">
              <UserCircle size={13} className="shrink-0 text-primary" />
              {t("Responsável pela tarefa")}
            </Label>
            <Select
              value={selectedAssignedTo}
              onValueChange={setSelectedAssignedTo}
              disabled={loadingMembers}
            >
              <SelectTrigger id="tarefa-responsavel" className="h-9 text-xs">
                <SelectValue placeholder={t("Atribuir a um membro...")} />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="none">{t("Sem responsável atribuído")}</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name || m.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tarefa-titulo">{t("O que precisa ser feito *")}</Label>
            <Input
              id="tarefa-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={t("Ex.: Fazer follow-up com Empresa Teste Vértice")}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tarefa-descricao">{t("Detalhes")}</Label>
            <Textarea
              id="tarefa-descricao"
              rows={2}
              className="resize-none"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={t("O que você vai querer lembrar quando chegar a hora")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tarefa-dia">{t("Prazo")}</Label>
              <Input
                id="tarefa-dia"
                type="date"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tarefa-hora">{t("Horário")}</Label>
              <Input
                id="tarefa-hora"
                type="time"
                value={hora}
                disabled={!dia}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tarefa-prioridade">{t("Prioridade")}</Label>
              <Select
                value={prioridade}
                onValueChange={(v) => setPrioridade(v as PrioridadeDaTarefa)}
              >
                <SelectTrigger id="tarefa-prioridade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("Baixa")}</SelectItem>
                  <SelectItem value="medium">{t("Média")}</SelectItem>
                  <SelectItem value="high">{t("Alta")}</SelectItem>
                  <SelectItem value="urgent">{t("Urgente")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tarefa-situacao">{t("Situação")}</Label>
              <Select value={situacao} onValueChange={(v) => setSituacao(v as SituacaoDaTarefa)}>
                <SelectTrigger id="tarefa-situacao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t("Pendente")}</SelectItem>
                  <SelectItem value="in_progress">{t("Em andamento")}</SelectItem>
                  <SelectItem value="done">{t("Concluída")}</SelectItem>
                  <SelectItem value="cancelled">{t("Cancelada")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {erro ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive"
            >
              {erro}
            </p>
          ) : null}

          <DialogFooter className="sticky bottom-0 z-10 mt-3 flex flex-row items-center justify-end gap-2 border-t bg-background/95 py-2.5 backdrop-blur-xs">
            <Button
              type="button"
              variant="ghost"
              disabled={salvando}
              onClick={() => aoMudarAbertura(false)}
            >
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? t("Salvando…") : t("Salvar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
