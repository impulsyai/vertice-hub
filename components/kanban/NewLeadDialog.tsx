"use client";

import { useT } from "@/hooks/i18n/useT";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateLead } from "@/hooks/kanban/useCreateLead";
import type { Stage } from "@/lib/kanban/types";
import { createLeadSchema, type CreateLeadInput } from "@/lib/schemas/leads";
import { parseReaisToCents } from "@/lib/money";
import { useCompanyList, useCompanyDetail } from "@/lib/people/client-hooks";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { EcoDoValor } from "./EcoDoValor";

interface FormShape {
  title: string;
  description: string;
  client_company_id: string;
  contact_id: string;
  owner_user_id: string;
  stage_id: string;
  valueReais: string;
  tagsRaw: string;
  expected_close_date: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelineId: string;
  stages: Stage[];
  /** Vincula o lead criado a este contato de origem (ex.: painel do Inbox). */
  contactId?: string | null;
  /** Empresa pré-selecionada, se houver */
  initialCompanyId?: string | null;
  /** Depois do INSERT — o inbox relê o resumo para o lead novo aparecer no formulário. */
  onCreated?: () => void;
}

function defaultStageId(stages: Stage[]): string {
  const open = stages.find((s) => !s.is_won && !s.is_lost && !s.is_archived);
  return open?.id ?? stages[0]?.id ?? "";
}

export function NewLeadDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
  contactId,
  initialCompanyId,
  onCreated,
}: Props) {
  const t = useT();
  const create = useCreateLead(pipelineId);
  const initialStage = useMemo(() => defaultStageId(stages), [stages]);

  // Listagem de empresas para seleção B2B
  const { data: companiesData } = useCompanyList({ limit: 100 });
  const companies = companiesData?.data ?? [];

  // Membros internos elegíveis como responsável
  const { data: members = [] } = useAssignableMembers(open);

  const form = useForm<FormShape>({
    defaultValues: {
      title: "",
      description: "",
      client_company_id: initialCompanyId ?? "",
      contact_id: contactId ?? "none",
      owner_user_id: "none",
      stage_id: initialStage,
      valueReais: "",
      tagsRaw: "",
      expected_close_date: "",
    },
  });

  const selectedCompanyId = form.watch("client_company_id");

  // Detalhe da empresa selecionada para listar seus contatos/decisores
  const { data: companyDetail } = useCompanyDetail(
    selectedCompanyId && selectedCompanyId !== "none" ? selectedCompanyId : null,
  );
  const companyContacts = useMemo(() => companyDetail?.contacts ?? [], [companyDetail?.contacts]);

  // Reset stage_id default if stages change while dialog mounted.
  useEffect(() => {
    if (!form.getValues("stage_id") && initialStage) {
      form.setValue("stage_id", initialStage);
    }
  }, [initialStage, form]);

  // Se a empresa mudar e o contato atual não pertencer à nova empresa, reseta o contato
  useEffect(() => {
    if (selectedCompanyId) {
      const currentContactId = form.getValues("contact_id");
      if (
        currentContactId &&
        currentContactId !== "none" &&
        companyContacts.length > 0 &&
        !companyContacts.some((c) => c.contact_id === currentContactId)
      ) {
        form.setValue("contact_id", "none");
      }
    }
  }, [selectedCompanyId, companyContacts, form]);

  async function onSubmit(values: FormShape) {
    if (!values.client_company_id || values.client_company_id === "none") {
      form.setError("client_company_id", { message: t("Selecione uma empresa cliente.") });
      return;
    }

    const tags = values.tagsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const reais = values.valueReais.trim();
    let valueCents: number | null = null;
    if (reais.length > 0) {
      valueCents = parseReaisToCents(reais);
      if (valueCents === null) {
        form.setError("valueReais", { message: t("Valor inválido") });
        return;
      }
    }

    const payload: Record<string, unknown> = {
      pipeline_id: pipelineId,
      stage_id: values.stage_id,
      title: values.title.trim(),
      client_company_id: values.client_company_id,
      currency: "BRL",
      source: "manual",
      tags,
    };

    if (values.contact_id && values.contact_id !== "none") {
      payload.contact_id = values.contact_id;
    } else if (contactId) {
      payload.contact_id = contactId;
    }

    if (values.owner_user_id && values.owner_user_id !== "none") {
      payload.owner_user_id = values.owner_user_id;
    }

    if (values.description.trim()) payload.description = values.description.trim();
    if (valueCents !== null) payload.value_cents = valueCents;
    if (values.expected_close_date) payload.expected_close_date = values.expected_close_date;

    const parsed = createLeadSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? t("Dados inválidos"));
      return;
    }

    try {
      await create.mutateAsync(parsed.data as CreateLeadInput);
      toast.success(t("Oportunidade criada"));
      onCreated?.();
      form.reset({
        title: "",
        description: "",
        client_company_id: "",
        contact_id: "none",
        owner_user_id: "none",
        stage_id: initialStage,
        valueReais: "",
        tagsRaw: "",
        expected_close_date: "",
      });
      onOpenChange(false);
    } catch {
      // toast already shown
    }
  }

  const stageId = form.watch("stage_id");
  const contactIdValue = form.watch("contact_id");
  const ownerUserIdValue = form.watch("owner_user_id");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Nova Oportunidade")}</DialogTitle>
          <DialogDescription>
            {t("Crie uma oportunidade comercial B2B vinculada a uma empresa cliente.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Título da Oportunidade */}
          <div className="space-y-2">
            <Label htmlFor="title">{t("Título da Oportunidade *")}</Label>
            <Input
              id="title"
              placeholder="Ex: Projeto de R&S — Diretoria Comercial"
              {...form.register("title", { required: true, minLength: 2 })}
            />
          </div>

          {/* Empresa Cliente (Obrigatório no modelo B2B Vértice) */}
          <div className="space-y-2">
            <Label htmlFor="client_company_id">{t("Empresa Cliente *")}</Label>
            <Select
              value={selectedCompanyId}
              onValueChange={(v) => {
                form.setValue("client_company_id", v);
                form.clearErrors("client_company_id");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Selecione a empresa cliente")} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.trade_name || c.legal_name || c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.client_company_id && (
              <p className="text-xs text-destructive">
                {form.formState.errors.client_company_id.message}
              </p>
            )}
          </div>

          {/* Decisor / Contato Comercial (Filtrado pela Empresa) */}
          <div className="space-y-2">
            <Label htmlFor="contact_id">{t("Decisor / Contato Comercial (Opcional)")}</Label>
            <Select
              value={contactIdValue}
              onValueChange={(v) => form.setValue("contact_id", v)}
              disabled={!selectedCompanyId || selectedCompanyId === "none"}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !selectedCompanyId
                      ? t("Selecione a empresa primeiro")
                      : companyContacts.length === 0
                        ? t("Nenhum decisor cadastrado nesta empresa")
                        : t("Selecione um decisor (opcional)")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("Sem decisor definido")}</SelectItem>
                {companyContacts.map((c) => {
                  const name = rotuloDoContato(c.contact, t);
                  const role = c.role_in_company ? ` (${c.role_in_company})` : "";
                  const primary = c.is_primary ? ` [${t("Principal")}]` : "";
                  return (
                    <SelectItem key={c.contact_id} value={c.contact_id}>
                      {name}
                      {role}
                      {primary}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável Interno (Membros Vértice) */}
          <div className="space-y-2">
            <Label htmlFor="owner_user_id">{t("Responsável")}</Label>
            <Select
              value={ownerUserIdValue}
              onValueChange={(v) => form.setValue("owner_user_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Selecione o responsável (opcional)")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("Sem responsável atribuído")}</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name || m.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição / Observações */}
          <div className="space-y-2">
            <Label htmlFor="description">{t("Descrição / Escopo")}</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder={t("Contexto da negociação, perfil das vagas, observações…")}
              {...form.register("description")}
            />
          </div>

          {/* Etapa do Funil */}
          <div className="space-y-2">
            <Label>{t("Etapa do Funil")}</Label>
            <Select value={stageId} onValueChange={(v) => form.setValue("stage_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("Selecione a etapa")} />
              </SelectTrigger>
              <SelectContent>
                {stages
                  .filter((s) => !s.is_archived)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor Estimado & Fechamento Previsto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="valueReais">{t("Valor Estimado (R$)")}</Label>
              <Input
                id="valueReais"
                inputMode="decimal"
                placeholder="0,00"
                {...form.register("valueReais")}
              />
              <EcoDoValor control={form.control} />
              {form.formState.errors.valueReais && (
                <p className="text-xs text-error-fg">{form.formState.errors.valueReais.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_close_date">{t("Fechamento previsto")}</Label>
              <Input
                id="expected_close_date"
                type="date"
                {...form.register("expected_close_date")}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tagsRaw">{t("Tags (separadas por vírgula)")}</Label>
            <Input
              id="tagsRaw"
              placeholder="hunting, r&s, diretoria"
              {...form.register("tagsRaw")}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={create.isPending || !stageId}>
              {create.isPending ? t("Criando…") : t("Criar oportunidade")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
