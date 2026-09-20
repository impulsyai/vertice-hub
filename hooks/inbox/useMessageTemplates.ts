"use client";
import { usePermission } from "@/hooks/auth/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface MessageTemplate {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
  owner_user_id: string | null;
}

/** Respostas essenciais de R&S disponíveis mesmo antes de uma organização criar seus próprios templates. */
export const BUILT_IN_QUICK_REPLIES: MessageTemplate[] = [
  {
    id: "builtin-rs-interview-invite",
    title: "Convite para Entrevista Inicial",
    body: "Olá, {{primeiro_nome}}! Gostaríamos de convidar você para uma entrevista inicial sobre a oportunidade em andamento. Qual horário funciona melhor para você?",
    shortcut: "entrevista",
    owner_user_id: null,
  },
  {
    id: "builtin-rs-resume-request",
    title: "Solicitação de Currículo Atualizado",
    body: "Olá, {{primeiro_nome}}! Para seguirmos com sua avaliação, você poderia nos enviar seu currículo mais atualizado por aqui?",
    shortcut: "curriculo",
    owner_user_id: null,
  },
  {
    id: "builtin-rs-application-received",
    title: "Confirmação de Recebimento de Candidatura",
    body: "Olá, {{primeiro_nome}}! Recebemos sua candidatura e ela já está em avaliação pela equipe da Vértice Pessoas & Estratégia. Retornaremos assim que houver uma próxima etapa.",
    shortcut: "recebimento",
    owner_user_id: null,
  },
  {
    id: "builtin-rs-friendly-close",
    title: "Feedback / Encerramento Amigável de Processo",
    body: "Olá, {{primeiro_nome}}! Agradecemos seu interesse e seu tempo no processo. Neste momento seguiremos com outro perfil, mas manteremos seu contato em nosso banco para futuras oportunidades alinhadas.",
    shortcut: "feedback",
    owner_user_id: null,
  },
];

function mergeTemplates(templates: MessageTemplate[]) {
  const customKeys = new Set(
    templates.flatMap((template) => [
      template.title.toLowerCase(),
      template.shortcut?.toLowerCase(),
    ]),
  );
  return [
    ...BUILT_IN_QUICK_REPLIES.filter(
      (template) =>
        !customKeys.has(template.title.toLowerCase()) &&
        !customKeys.has(template.shortcut?.toLowerCase()),
    ),
    ...templates,
  ];
}

/** Onda 5: templates de script (pessoais + compartilhados) para o slash-menu do composer. */
export function useMessageTemplates() {
  const podeConsultar = usePermission("message-templates.view");
  return useQuery({
    enabled: podeConsultar,
    queryKey: ["message-templates"],
    queryFn: async () => apiClient.get<{ data: MessageTemplate[] }>("/api/v1/message-templates"),
    initialData: { data: BUILT_IN_QUICK_REPLIES },
    staleTime: 60_000,
    select: (res) => mergeTemplates(res.data),
  });
}
