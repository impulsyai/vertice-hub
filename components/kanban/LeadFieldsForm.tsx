"use client";

import { useT } from "@/hooks/i18n/useT";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { useEditLead } from "@/hooks/kanban/useUpdateLead";
import type { Lead } from "@/lib/types/leads";
import { updateLeadSchema, type UpdateLeadInput } from "@/lib/schemas/leads";
import { parseReaisToCents } from "@/lib/money";
import { CustomFieldsEditor, type CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import { useCompanyList, useCompanyDetail } from "@/lib/people/client-hooks";
import { EcoDoValor } from "./EcoDoValor";

interface FormShape {
  title: string;
  description: string;
  client_company_id: string;
  contact_id: string;
  valueReais: string;
  tagsRaw: string;
  expected_close_date: string;
}

interface Props {
  lead: Lead;
  pipelineId: string;
  fieldDefs?: CustomFieldDef[];
  /** Quando o salvamento dá certo. O dossiê NÃO fecha aqui — ver abaixo. */
  onSaved?: () => void;
  /** O dossiê não tem "cancelar"; o diálogo tem. */
  onCancel?: () => void;
}

function centsToReais(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function LeadFieldsForm({ lead, pipelineId, fieldDefs = [], onSaved, onCancel }: Props) {
  const t = useT();
  const edit = useEditLead(pipelineId);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(lead.custom_fields ?? {});

  const { data: companiesData } = useCompanyList({ limit: 100 });
  const companies = companiesData?.data ?? [];

  const form = useForm<FormShape>({
    defaultValues: {
      title: lead.title,
      description: lead.description ?? "",
      client_company_id: lead.client_company_id ?? "none",
      contact_id: lead.contact_id ?? "none",
      valueReais: centsToReais(lead.value_cents),
      tagsRaw: (lead.tags ?? []).join(", "),
      expected_close_date: lead.expected_close_date ?? "",
    },
  });

  const selectedCompanyId = form.watch("client_company_id");

  const { data: companyDetail } = useCompanyDetail(
    selectedCompanyId && selectedCompanyId !== "none" ? selectedCompanyId : null,
  );
  const companyContacts = companyDetail?.contacts ?? [];

  useEffect(() => {
    form.reset({
      title: lead.title,
      description: lead.description ?? "",
      client_company_id: lead.client_company_id ?? "none",
      contact_id: lead.contact_id ?? "none",
      valueReais: centsToReais(lead.value_cents),
      tagsRaw: (lead.tags ?? []).join(", "),
      expected_close_date: lead.expected_close_date ?? "",
    });
    setCustomFields(lead.custom_fields ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  async function onSubmit(values: FormShape) {
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

    const patch: Record<string, unknown> = {
      title: values.title.trim(),
      description: values.description.trim() ? values.description.trim() : null,
      client_company_id:
        values.client_company_id && values.client_company_id !== "none"
          ? values.client_company_id
          : null,
      contact_id:
        values.contact_id && values.contact_id !== "none" ? values.contact_id : null,
      value_cents: valueCents,
      tags,
      expected_close_date: values.expected_close_date || null,
      ...(fieldDefs.length > 0 ? { custom_fields: customFields } : {}),
    };

    const parsed = updateLeadSchema.safeParse(patch);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? t("Dados inválidos"));
      return;
    }

    try {
      await edit.mutateAsync({
        leadId: lead.id,
        patch: parsed.data as UpdateLeadInput,
      });
      toast.success(t("Oportunidade atualizada"));
      onSaved?.();
    } catch {
      // toast already shown
    }
  }

  const contactIdValue = form.watch("contact_id");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">{t("Título da Oportunidade")}</Label>
        <Input
          id="title"
          {...form.register("title", { required: true, minLength: 2 })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="client_company_id">{t("Empresa vinculada")}</Label>
        <Select
          value={selectedCompanyId}
          onValueChange={(v) => form.setValue("client_company_id", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("Selecione a empresa cliente")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("Nenhuma empresa (desvincular)")}</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.trade_name || c.legal_name || c.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact_id">{t("Decisor / Contato")}</Label>
        <Select
          value={contactIdValue}
          onValueChange={(v) => form.setValue("contact_id", v)}
          disabled={!selectedCompanyId || selectedCompanyId === "none"}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                !selectedCompanyId || selectedCompanyId === "none"
                  ? t("Selecione a empresa primeiro")
                  : companyContacts.length === 0
                  ? t("Nenhum decisor cadastrado")
                  : t("Selecione o decisor")
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("Sem decisor definido")}</SelectItem>
            {companyContacts.map((c) => {
              const name = c.contact?.display_name || c.contact?.name || t("Contato");
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

      <div className="space-y-2">
        <Label htmlFor="description">{t("Descrição")}</Label>
        <Textarea id="description" rows={3} {...form.register("description")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="valueReais">{t("Valor (R$)")}</Label>
          <Input
            id="valueReais"
            inputMode="decimal"
            placeholder="0,00"
            {...form.register("valueReais")}
          />
          <EcoDoValor control={form.control} />
          {form.formState.errors.valueReais && (
            <p className="text-xs text-error-fg">
              {t(form.formState.errors.valueReais.message ?? "")}
            </p>
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

      <div className="space-y-2">
        <Label htmlFor="tagsRaw">{t("Tags (separadas por vírgula)")}</Label>
        <Input id="tagsRaw" placeholder="vip, hunting" {...form.register("tagsRaw")} />
      </div>

      {fieldDefs.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-medium">{t("Campos do funil")}</p>
          <CustomFieldsEditor
            fields={fieldDefs}
            value={customFields}
            onChange={setCustomFields}
            mode="lead"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("Cancelar")}
          </Button>
        )}
        <Button type="submit" disabled={edit.isPending}>
          {edit.isPending ? t("Salvando…") : t("Salvar alterações")}
        </Button>
      </div>
    </form>
  );
}
