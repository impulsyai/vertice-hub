"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useT } from "@/hooks/i18n/useT";
import { NewContactDialog } from "@/components/contacts/NewContactDialog";
import { Buildings } from "@/lib/ui/icons";

type Vinculos = {
  contacts: Array<{ id: string; name: string; email?: string | null; phone?: string | null }>;
  conversations: Array<{ id: string; created_at: string; status: string }>;
  company?: { id: string; name: string; role: string | null } | null;
  opportunities?: Array<{ id: string; title: string }>;
};

export function VinculoDaMarcacao({
  contactId,
  conversationId,
  opportunityId,
  onChange,
  onOpportunityChange,
  onContactSelected,
}: {
  contactId: string;
  conversationId: string;
  opportunityId?: string;
  onChange: (contact: string, conversation: string) => void;
  onOpportunityChange?: (opportunity: string) => void;
  onContactSelected?: (contact: { id: string; name: string | null; email?: string | null }) => void;
}) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [criando, setCriando] = useState(false);
  const query = useQuery({
    queryKey: ["agenda", "vinculos", contactId, search],
    queryFn: async () =>
      (
        await apiClient.get<{ data: Vinculos }>(
          `/api/v1/agenda/vinculos?${new URLSearchParams(contactId ? { contact_id: contactId } : { q: search })}`,
        )
      ).data,
  });

  // Auto-preencher convidado quando contato for selecionado e tiver e-mail
  useEffect(() => {
    if (contactId && query.data?.contacts) {
      const c = query.data.contacts.find((item) => item.id === contactId);
      if (c && onContactSelected) {
        onContactSelected(c);
      }
    }
  }, [contactId, query.data?.contacts, onContactSelected]);

  // Quem marca horário costuma estar com a pessoa na frente, e ela nem sempre
  // já é contato. Sem esta saída o fluxo PARA aqui: teria que abandonar a
  // marcação, ir até Contatos, criar, voltar e recomeçar. O termo já digitado
  // vira o nome, e o contato volta selecionado.
  const buscou = search.trim().length > 0 && !contactId;
  const nadaEncontrado = buscou && !query.isLoading && (query.data?.contacts.length ?? 0) === 0;

  return (
    <div className="space-y-3 rounded-lg border p-3 bg-card/50">
      <label className="block">
        <span className="text-xs font-medium text-text-muted">{t("Buscar cliente")}</span>
        <input
          className="mt-1 w-full rounded-md border bg-surface p-2 text-sm"
          value={search}
          placeholder={t("Digite para buscar...")}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange("", "");
          }}
        />
      </label>
      {nadaEncontrado ? (
        <button
          type="button"
          // Alvo de toque generoso: quem marca faz isso no celular, com o
          // cliente esperando na frente.
          className="min-h-11 w-full rounded-md border border-dashed px-3 text-left text-sm hover:border-primary/50 transition-colors"
          onClick={() => setCriando(true)}
        >
          {t("Criar")} “{search.trim()}”
        </button>
      ) : null}
      <label className="block">
        <span className="text-xs font-medium text-text-muted">{t("Quem será atendido")}</span>
        <select
          className="mt-1 w-full rounded-md border bg-surface p-2 text-sm"
          value={contactId}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val, "");
            const found = query.data?.contacts.find((c) => c.id === val);
            if (found && onContactSelected) onContactSelected(found);
          }}
        >
          <option value="">{t("Compromisso pessoal, sem cliente")}</option>
          {query.data?.contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.email ? `(${c.email})` : ""}
            </option>
          ))}
        </select>
      </label>

      {/* Empresa do Contato (auto-preenchida explicitamente) */}
      {contactId && query.data?.company && (
        <div className="flex items-center gap-2 rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground border">
          <Buildings size={14} className="text-primary shrink-0" />
          <span className="font-medium text-text-muted">{t("Empresa:")}</span>
          <span className="font-semibold text-foreground">{query.data.company.name}</span>
          {query.data.company.role && (
            <span className="text-[11px]">({query.data.company.role})</span>
          )}
        </div>
      )}

      {/* Oportunidade Relacionada (Opcional) */}
      {contactId && query.data?.opportunities && query.data.opportunities.length > 0 && (
        <label className="block">
          <span className="text-xs font-medium text-text-muted">{t("Oportunidade relacionada (opcional)")}</span>
          <select
            className="mt-1 w-full rounded-md border bg-surface p-2 text-sm"
            value={opportunityId ?? ""}
            onChange={(e) => onOpportunityChange?.(e.target.value)}
          >
            <option value="">{t("Sem oportunidade vinculada")}</option>
            {query.data.opportunities.map((opp) => (
              <option key={opp.id} value={opp.id}>
                {opp.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {contactId ? (
        <label className="block">
          <span className="text-xs font-medium text-text-muted">{t("Conversa vinculada (opcional)")}</span>
          <select
            className="mt-1 w-full rounded-md border bg-surface p-2 text-sm"
            value={conversationId}
            onChange={(e) => onChange(contactId, e.target.value)}
          >
            <option value="">{t("Sem conversa vinculada")}</option>
            {query.data?.conversations.map((c, i) => (
              <option key={c.id} value={c.id}>
                {t("Conversa")} {i + 1} · {new Date(c.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {query.isError ? (
        <p role="alert" className="text-xs text-destructive">{t("Não foi possível carregar os vínculos. Tente novamente.")}</p>
      ) : null}
      <NewContactDialog
        key={search.trim()}
        open={criando}
        onOpenChange={setCriando}
        nomeInicial={search.trim()}
        onCriado={(contato) => {
          setSearch(contato.name ?? search);
          onChange(contato.id, "");
          if (onContactSelected) onContactSelected(contato);
        }}
      />
    </div>
  );
}
