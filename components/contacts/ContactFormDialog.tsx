"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { contactCreateSchema, contactPatchSchema, type ContactCreate, type ContactPatch } from "@/lib/schemas/contacts";
import type { Contact } from "@/lib/types/contacts";
import type { CreateContactResult } from "@/app/api/v1/contacts/_handler";
import { useCreateContact } from "@/hooks/contacts/useCreateContact";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { useCompanyList } from "@/lib/people/client-hooks";
import { maskCpf, maskPhoneBR, normalizePhoneBR } from "@/lib/ui/form-masks";
import { phoneForDisplay } from "@/lib/channels/phone-variants";
import { CustomFieldsEditor, type CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";

interface FormShape {
  name?: string;
  display_name?: string;
  email?: string;
  phone_number?: string;
  cpf?: string;
  birthdate?: string;
  tagsRaw?: string;
  custom_fields?: Record<string, unknown>;
  client_company_id?: string;
  role_in_company?: string;
  is_primary?: boolean;
}

export interface ContactFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
  nomeInicial?: string;
  empresaInicialId?: string | null;
  customFieldDefs?: CustomFieldDef[];
  onCriado?: (contato: Contact) => void;
}

function valuesFromContact(
  contact: Contact | undefined,
  nomeInicial?: string,
  empresaInicialId?: string | null,
): FormShape {
  return {
    name: contact?.name ?? nomeInicial ?? "",
    display_name: contact?.display_name ?? "",
    email: contact?.email ?? "",
    phone_number: contact?.phone_number ? phoneForDisplay(contact.phone_number) : "",
    cpf: "",
    birthdate: contact?.birthdate ?? "",
    tagsRaw: contact?.tags.join(", ") ?? "",
    custom_fields: contact?.custom_fields ?? {},
    client_company_id: contact?.company_link?.client_company_id ?? empresaInicialId ?? "none",
    role_in_company: contact?.company_link?.role_in_company ?? "",
    is_primary: contact?.company_link?.is_primary ?? false,
  };
}

export function ContactFormDialog({
  mode,
  open,
  onOpenChange,
  contact,
  nomeInicial,
  empresaInicialId,
  customFieldDefs = [],
  onCriado,
}: ContactFormDialogProps) {
  const t = useT();
  const create = useCreateContact();
  const update = useUpdateContact(contact?.id ?? "");
  const { data: companiesData } = useCompanyList({ limit: 100 });
  const companies = companiesData?.data ?? [];
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FormShape>({
    defaultValues: valuesFromContact(contact, nomeInicial, empresaInicialId),
  });

  const customFields = useWatch({ control: form.control, name: "custom_fields" });
  const selectedCompanyId = useWatch({ control: form.control, name: "client_company_id" }) ?? "none";
  const isPrimary = useWatch({ control: form.control, name: "is_primary" }) ?? false;
  const pending = mode === "create" ? create.isPending : update.isPending;

  useEffect(() => {
    if (open) {
      form.reset(valuesFromContact(contact, nomeInicial, empresaInicialId));
      setServerError(null);
    }
  }, [contact, empresaInicialId, form, nomeInicial, open]);

  function handleOpenChange(value: boolean) {
    if (!value) {
      form.reset(valuesFromContact(contact, nomeInicial, empresaInicialId));
      setServerError(null);
    }
    onOpenChange(value);
  }

  async function onSubmit(values: FormShape) {
    setServerError(null);
    const tags = (values.tagsRaw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload: Record<string, unknown> = mode === "create" ? { source: "manual" } : {};
    if (values.name?.trim()) payload.name = values.name.trim();
    if (values.display_name?.trim()) payload.display_name = values.display_name.trim();
    if (values.email?.trim()) payload.email = values.email.trim();
    const phone = normalizePhoneBR(values.phone_number);
    if (phone) payload.phone_number = phone;
    if (values.cpf?.trim()) payload.cpf = values.cpf.trim();
    if (values.birthdate?.trim()) payload.birthdate = values.birthdate.trim();
    payload.tags = tags;
    payload.custom_fields = values.custom_fields ?? {};

    const companyId = values.client_company_id;
    if (companyId && companyId !== "none") {
      payload.client_company_id = companyId;
      payload.role_in_company = values.role_in_company?.trim() || null;
      payload.is_primary = Boolean(values.is_primary);
    } else if (mode === "edit" && contact?.company_link?.client_company_id) {
      payload.client_company_id = null;
      payload.role_in_company = null;
      payload.is_primary = false;
    }

    const parsed = mode === "create"
      ? contactCreateSchema.safeParse(payload)
      : contactPatchSchema.safeParse(payload);
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? t("Dados inválidos"));
      return;
    }

    try {
      if (mode === "create") {
        const response = await create.mutateAsync(parsed.data as ContactCreate);
        toast.success(t("Contato criado"));
        if (response?.data?.contact) onCriado?.(response.data.contact);
      } else {
        await update.mutateAsync(parsed.data as ContactPatch);
        toast.success(t("Contato atualizado"));
      }
      handleOpenChange(false);
    } catch {
      // O hook já exibe o erro da API.
    }
  }

  const prefix = mode === "create" ? "new-contact" : "edit-contact";
  const currentCompany = contact?.company_link?.client_company_id;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(mode === "create" ? "Novo contato" : "Editar contato")}</DialogTitle>
          <DialogDescription>
            {t(mode === "create" ? "Cadastre os dados completos deste contato." : "Atualize os dados completos deste contato.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-name`}>{t("Nome")}</Label>
              <Input id={`${prefix}-name`} {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-display-name`}>{t("Nome de exibição")}</Label>
              <Input id={`${prefix}-display-name`} {...form.register("display_name")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-email`}>Email</Label>
              <Input id={`${prefix}-email`} type="email" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-phone`}>{t("Telefone / WhatsApp")}</Label>
              <Input
                id={`${prefix}-phone`}
                placeholder="(81) 99584-8588"
                {...form.register("phone_number", {
                  onChange: (event) => { event.target.value = maskPhoneBR(event.target.value); },
                })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-cpf`}>{t("CPF (opcional)")}</Label>
              <Input
                id={`${prefix}-cpf`}
                placeholder={contact?.cpf_hash ? t("CPF cadastrado; informe para substituir") : "000.000.000-00"}
                {...form.register("cpf", {
                  onChange: (event) => { event.target.value = maskCpf(event.target.value); },
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-birthdate`}>{t("Data de nascimento")}</Label>
              <Input id={`${prefix}-birthdate`} type="date" {...form.register("birthdate")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}-company`}>{t("Empresa vinculada")}</Label>
            <Select
              value={selectedCompanyId}
              onValueChange={(value) => form.setValue("client_company_id", value, { shouldDirty: true })}
              disabled={Boolean(empresaInicialId)}
            >
              <SelectTrigger id={`${prefix}-company`}>
                <SelectValue placeholder={t("Selecione uma empresa")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("Nenhuma empresa")}</SelectItem>
                {currentCompany && !companies.some((company) => company.id === currentCompany) && (
                  <SelectItem value={currentCompany}>
                    {contact?.company_link?.company?.trade_name || contact?.company_link?.company?.legal_name || currentCompany}
                  </SelectItem>
                )}
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.trade_name || company.legal_name || company.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCompanyId !== "none" && (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-role`}>{t("Cargo / Função")}</Label>
                <Input id={`${prefix}-role`} {...form.register("role_in_company")} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor={`${prefix}-primary`} className="cursor-pointer text-sm font-medium">
                    {t("Contato Principal")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("Marcar como decisor principal desta empresa")}</p>
                </div>
                <Switch
                  id={`${prefix}-primary`}
                  checked={isPrimary}
                  onCheckedChange={(value) => form.setValue("is_primary", value, { shouldDirty: true })}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`${prefix}-tags`}>{t("Tags (separadas por vírgula)")}</Label>
            <Input id={`${prefix}-tags`} {...form.register("tagsRaw")} />
          </div>

          {customFieldDefs.length > 0 && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div>
                <h3 className="text-sm font-medium">{t("Campos personalizados")}</h3>
                <p className="text-xs text-muted-foreground">{t("Campos extras definidos no funil padrão da organização.")}</p>
              </div>
              <CustomFieldsEditor
                fields={customFieldDefs}
                mode="contact"
                value={customFields ?? {}}
                onChange={(value) => form.setValue("custom_fields", value, { shouldDirty: true })}
              />
            </div>
          )}

          {serverError && <p className="text-sm text-error-fg">{serverError}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={pending}>
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("Salvando…") : t(mode === "create" ? "Criar contato" : "Salvar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
