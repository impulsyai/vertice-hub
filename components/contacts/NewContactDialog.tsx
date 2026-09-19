"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { contactCreateSchema, type ContactCreate } from "@/lib/schemas/contacts";
import type { Contact } from "@/lib/types/contacts";
import { useCreateContact } from "@/hooks/contacts/useCreateContact";
import { useCompanyList } from "@/lib/people/client-hooks";
import { maskPhoneBR, maskCpf, normalizePhoneBR } from "@/lib/ui/form-masks";

interface FormShape {
  name?: string;
  email?: string;
  phone_number?: string;
  cpf?: string;
  tagsRaw?: string;
  role_in_company?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * Nome já digitado por quem chamou, para não redigitar. Quem abre com um termo
   * de busca em mãos passa aqui; o resto continua abrindo vazio.
   *
   * É `defaultValue` do formulário, então só vale na montagem — quem precisa
   * trocar o termo com o diálogo já montado remonta com `key`.
   */
  nomeInicial?: string;
  /**
   * Recebe o contato recém-criado. Existe para quem abriu o diálogo NO MEIO de
   * outro fluxo (marcar um horário, por exemplo) poder seguir com ele já
   * selecionado, em vez de mandar a pessoa procurar de novo o que acabou de criar.
   */
  onCriado?: (contato: Contact) => void;
}

export function NewContactDialog({ open, onOpenChange, nomeInicial, onCriado }: Props) {
  const t = useT();
  const create = useCreateContact();
  const { data: companiesData } = useCompanyList({ limit: 100 });
  const companies = companiesData?.data ?? [];
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("none");
  const [isPrimary, setIsPrimary] = useState<boolean>(false);

  const form = useForm<FormShape>({
    defaultValues: {
      name: nomeInicial ?? "",
      email: "",
      phone_number: "",
      cpf: "",
      tagsRaw: "",
      role_in_company: "",
    },
  });

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      form.reset();
      setSelectedCompanyId("none");
      setIsPrimary(false);
      setServerError(null);
    }
    onOpenChange(v);
  };

  async function onSubmit(values: FormShape) {
    setServerError(null);
    const tags = (values.tagsRaw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = { source: "manual" };
    if (values.name?.trim()) payload.name = values.name.trim();
    if (values.email?.trim()) payload.email = values.email.trim();
    const phone = normalizePhoneBR(values.phone_number);
    if (phone) payload.phone_number = phone;
    if (values.cpf?.trim()) payload.cpf = values.cpf.trim();
    if (tags.length) payload.tags = tags;

    if (selectedCompanyId && selectedCompanyId !== "none") {
      payload.client_company_id = selectedCompanyId;
      if (values.role_in_company?.trim()) {
        payload.role_in_company = values.role_in_company.trim();
      }
      payload.is_primary = isPrimary;
    }

    const parsed = contactCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setServerError(first?.message ?? t("Dados inválidos"));
      return;
    }

    try {
      const resposta = await create.mutateAsync(parsed.data as ContactCreate);
      toast.success(t("Contato criado"));
      form.reset();
      setSelectedCompanyId("none");
      setIsPrimary(false);
      onOpenChange(false);
      // `.data` é o envelope do `ok()`, e dentro dele mora `{ contact, action }`.
      // Entregar `resposta.data` aqui devolveria esse envelope como se fosse o
      // contato: o `id` sairia `undefined` e a marcação ficaria sem ninguém, em
      // silêncio. Quem garante que este caminho não volta a errar é o tipo do
      // hook, ligado ao retorno da rota.
      if (resposta?.data?.contact) onCriado?.(resposta.data.contact);
    } catch {
      // error toast already handled by hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Novo contato")}</DialogTitle>
          <DialogDescription>
            {t("Preencha pelo menos um identificador (email ou telefone).")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("Nome")}</Label>
            <Input id="name" {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone_number">{t("Telefone / WhatsApp")}</Label>
            <Input
              id="phone_number"
              placeholder="(81) 99584-8588"
              {...form.register("phone_number", {
                onChange: (e) => {
                  e.target.value = maskPhoneBR(e.target.value);
                },
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf">{t("CPF (opcional)")}</Label>
            <Input
              id="cpf"
              placeholder="000.000.000-00"
              {...form.register("cpf", {
                onChange: (e) => {
                  e.target.value = maskCpf(e.target.value);
                },
              })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">{t("Empresa (opcional)")}</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger id="company">
                <SelectValue placeholder={t("Selecione uma empresa")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("Nenhuma empresa")}</SelectItem>
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
                <Label htmlFor="role_in_company">{t("Cargo / Função")}</Label>
                <Input
                  id="role_in_company"
                  placeholder={t("ex: Diretor de RH, Gerente de Pessoas, CEO")}
                  {...form.register("role_in_company")}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="space-y-0.5">
                  <Label htmlFor="is_primary" className="text-sm font-medium cursor-pointer">
                    {t("Contato Principal")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("Marcar como decisor principal desta empresa")}
                  </p>
                </div>
                <Switch
                  id="is_primary"
                  checked={isPrimary}
                  onCheckedChange={setIsPrimary}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tagsRaw">{t("Tags (separadas por vírgula)")}</Label>
            <Input id="tagsRaw" placeholder="vip, decisor, executivo" {...form.register("tagsRaw")} />
          </div>
          {serverError && (
            <p className="text-sm text-error-fg">{serverError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={create.isPending}
            >
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t("Criando…") : t("Criar contato")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
