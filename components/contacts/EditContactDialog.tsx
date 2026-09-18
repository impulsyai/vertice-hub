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
import { contactPatchSchema, type ContactPatch } from "@/lib/schemas/contacts";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { CustomFieldsEditor, type CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import type { Contact } from "@/lib/types/contacts";
import { phoneForDisplay } from "@/lib/channels/phone-variants";
import { useCompanyList } from "@/lib/people/client-hooks";

interface FormShape {
  name?: string;
  email?: string;
  phone_number?: string;
  tagsRaw?: string;
  custom_fields?: Record<string, unknown>;
  client_company_id?: string;
  role_in_company?: string;
  is_primary?: boolean;
}

interface Props {
  contact: Contact;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Definições vindas de `crm_pipelines.settings.fields[]`. Vazio = a seção some. */
  customFieldDefs?: CustomFieldDef[];
}

export function EditContactDialog({ contact, open, onOpenChange, customFieldDefs = [] }: Props) {
  const t = useT();
  const update = useUpdateContact(contact.id);
  const { data: companiesData } = useCompanyList({ limit: 100 });
  const companies = companiesData?.data ?? [];
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormShape>({
    defaultValues: {
      name: contact.name ?? "",
      email: contact.email ?? "",
      phone_number: contact.phone_number ? phoneForDisplay(contact.phone_number) : "",
      tagsRaw: contact.tags.join(", "),
      custom_fields: contact.custom_fields ?? {},
      client_company_id: contact.company_link?.client_company_id ?? "none",
      role_in_company: contact.company_link?.role_in_company ?? "",
      is_primary: contact.company_link?.is_primary ?? false,
    },
  });

  const customFields = useWatch({ control: form.control, name: "custom_fields" });
  const selectedCompanyId = useWatch({ control: form.control, name: "client_company_id" }) ?? "none";
  const isPrimary = useWatch({ control: form.control, name: "is_primary" }) ?? false;

  useEffect(() => {
    if (open) {
      form.reset({
        name: contact.name ?? "",
        email: contact.email ?? "",
        phone_number: contact.phone_number ? phoneForDisplay(contact.phone_number) : "",
        tagsRaw: contact.tags.join(", "),
        custom_fields: contact.custom_fields ?? {},
        client_company_id: contact.company_link?.client_company_id ?? "none",
        role_in_company: contact.company_link?.role_in_company ?? "",
        is_primary: contact.company_link?.is_primary ?? false,
      });
    }
  }, [open, contact, form]);

  async function onSubmit(values: FormShape) {
    setServerError(null);
    const tags = (values.tagsRaw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {};
    if (values.name?.trim()) payload.name = values.name.trim();
    if (values.email?.trim()) payload.email = values.email.trim();
    if (values.phone_number?.trim()) payload.phone_number = values.phone_number.trim();
    payload.tags = tags;
    // Sempre no payload, mesmo vazio: o PATCH SUBSTITUI, e é assim que apagar um
    // campo pela tela chega ao banco.
    payload.custom_fields = values.custom_fields ?? {};

    const compId = values.client_company_id;
    if (compId && compId !== "none") {
      payload.client_company_id = compId;
      payload.role_in_company = values.role_in_company?.trim() ? values.role_in_company.trim() : null;
      payload.is_primary = !!values.is_primary;
    } else {
      if (contact.company_link?.client_company_id) {
        payload.client_company_id = null;
        payload.role_in_company = null;
        payload.is_primary = false;
      }
    }

    const parsed = contactPatchSchema.safeParse(payload);
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? t("Dados inválidos"));
      return;
    }
    try {
      await update.mutateAsync(parsed.data as ContactPatch);
      toast.success(t("Contato atualizado"));
      onOpenChange(false);
    } catch {
      // hook handles toast
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Editar contato")}</DialogTitle>
          <DialogDescription>{t("Atualize os dados deste contato.")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ec-name">{t("Nome")}</Label>
            <Input id="ec-name" {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec-email">Email</Label>
            <Input id="ec-email" type="email" {...form.register("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec-phone">{t("Telefone (E.164)")}</Label>
            <Input id="ec-phone" {...form.register("phone_number")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ec-company">{t("Empresa vinculada")}</Label>
            <Select
              value={selectedCompanyId}
              onValueChange={(val) => form.setValue("client_company_id", val, { shouldDirty: true })}
            >
              <SelectTrigger id="ec-company">
                <SelectValue placeholder={t("Selecione uma empresa")} />
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

          {selectedCompanyId !== "none" && (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="space-y-2">
                <Label htmlFor="ec-role">{t("Cargo / Função")}</Label>
                <Input
                  id="ec-role"
                  placeholder={t("ex: Diretor de RH, Gerente de Pessoas, CEO")}
                  {...form.register("role_in_company")}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="space-y-0.5">
                  <Label htmlFor="ec-is-primary" className="text-sm font-medium cursor-pointer">
                    {t("Contato Principal")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("Marcar como decisor principal desta empresa")}
                  </p>
                </div>
                <Switch
                  id="ec-is-primary"
                  checked={isPrimary}
                  onCheckedChange={(val) => form.setValue("is_primary", val, { shouldDirty: true })}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ec-tags">Tags</Label>
            <Input id="ec-tags" {...form.register("tagsRaw")} />
          </div>
          {customFieldDefs.length > 0 && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div>
                <h3 className="text-sm font-medium">{t("Campos personalizados")}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("Campos definidos no funil padrão da organização.")}
                </p>
              </div>
              <CustomFieldsEditor
                fields={customFieldDefs}
                mode="contact"
                value={customFields ?? {}}
                onChange={(next) => form.setValue("custom_fields", next, { shouldDirty: true })}
              />
            </div>
          )}
          {serverError && <p className="text-sm text-error-fg">{serverError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={update.isPending}
            >
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? t("Salvando…") : t("Salvar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
