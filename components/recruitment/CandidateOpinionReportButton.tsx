"use client";

import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import type { CandidateTimelineEvent } from "@/lib/people/client-hooks";
import type {
  VerticeCandidate,
  VerticeCandidateResume,
  VerticeJobApplication,
} from "@/lib/people/types";
import { Button } from "@/components/ui/button";
import { FileText } from "@/lib/ui/icons";
import { RECRUITMENT_STAGES } from "@/lib/people/types";

interface Props {
  candidate: VerticeCandidate;
  applications: VerticeJobApplication[];
  resumes: VerticeCandidateResume[];
  events: CandidateTimelineEvent[];
  includeDirectContacts?: boolean;
}

function escapeHtml(value: unknown) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br />");
}

function formatSalary(value: number | null) {
  if (value == null || value <= 0) return "Não informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function eventDescription(event: CandidateTimelineEvent, applications: VerticeJobApplication[]) {
  const metadata = event.metadata;
  const application = applications.find((item) => item.id === event.resource_id);
  const job = application?.job_opening ?? application?.job;
  const jobSuffix = job?.title ? ` · ${job.title}` : "";

  switch (event.action) {
    case "people.candidate_created":
      return "Perfil de candidato criado";
    case "people.candidate_updated":
      return "Dados cadastrais atualizados";
    case "people.candidate_contact_linked":
      return "Contato e conversa do WhatsApp vinculados";
    case "people.resume_uploaded":
      return `Currículo anexado: ${String(metadata.filename ?? "arquivo")}`;
    case "people.application_created":
      return `Candidatura recebida${jobSuffix}`;
    case "people.application_stage_changed": {
      const from = RECRUITMENT_STAGES.find((stage) => stage.id === metadata.old_stage)?.label;
      const to = RECRUITMENT_STAGES.find((stage) => stage.id === metadata.new_stage)?.label;
      return `Movido de ${from?.replace(/^\d+\s*/, "") ?? "uma etapa"} para ${to?.replace(/^\d+\s*/, "") ?? "outra etapa"}${jobSuffix}`;
    }
    default:
      return event.action;
  }
}

function fallbackTimeline(
  candidate: VerticeCandidate,
  applications: VerticeJobApplication[],
  resumes: VerticeCandidateResume[],
): CandidateTimelineEvent[] {
  return [
    {
      id: `candidate-created-${candidate.id}`,
      created_at: candidate.created_at,
      actor_user_id: null,
      actor_name: "Sistema",
      action: "people.candidate_created",
      resource_type: "vertice_candidate",
      resource_id: candidate.id,
      metadata: {},
    },
    ...resumes.map((resume) => ({
      id: `resume-${resume.id}`,
      created_at: resume.created_at,
      actor_user_id: null,
      actor_name: "Sistema",
      action: "people.resume_uploaded",
      resource_type: "vertice_candidate_resume",
      resource_id: resume.id,
      metadata: { filename: resume.original_filename },
    })),
    ...applications.map((application) => ({
      id: `application-${application.id}`,
      created_at: application.created_at,
      actor_user_id: null,
      actor_name: "Sistema",
      action: "people.application_created",
      resource_type: "vertice_job_application",
      resource_id: application.id,
      metadata: {},
    })),
  ];
}

export function CandidateOpinionReportButton({
  candidate,
  applications,
  resumes,
  events,
  includeDirectContacts = false,
}: Props) {
  const t = useT();

  function openReport() {
    const reportWindow = window.open("", "_blank", "noopener,noreferrer,width=960,height=800");
    if (!reportWindow) {
      toast.error(t("Permita pop-ups para gerar o parecer imprimível."));
      return;
    }

    const reportEvents =
      events.length > 0 ? events : fallbackTimeline(candidate, applications, resumes);
    const jobRows = applications
      .map((application) => {
        const job = application.job_opening ?? application.job;
        const company = job?.client_company ?? job?.company;
        const stage = RECRUITMENT_STAGES.find((item) => item.id === application.stage)?.label;
        return `<li><strong>${escapeHtml(job?.title ?? "Vaga")}</strong> · ${escapeHtml(company?.trade_name ?? company?.legal_name ?? "Empresa cliente")}<br /><span>${escapeHtml(stage?.replace(/^\d+\s*/, "") ?? application.stage)} · ${escapeHtml(new Date(application.created_at).toLocaleDateString("pt-BR"))}</span></li>`;
      })
      .join("");

    const timelineRows = reportEvents
      .slice(0, 20)
      .map(
        (event) =>
          `<li><strong>${escapeHtml(eventDescription(event, applications))}</strong><br /><span>${escapeHtml(new Date(event.created_at).toLocaleString("pt-BR"))} · ${escapeHtml(event.actor_name)}</span></li>`,
      )
      .join("");

    const directContact = includeDirectContacts
      ? `<div><dt>E-mail</dt><dd>${escapeHtml(candidate.email)}</dd></div><div><dt>Telefone</dt><dd>${escapeHtml(candidate.phone_e164)}</dd></div>`
      : `<div class="confidential"><dt>Contato direto</dt><dd>Omitido por sigilo do parecer</dd></div>`;

    reportWindow.document.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Parecer Vértice — ${escapeHtml(candidate.full_name)}</title>
          <style>
            :root { color-scheme: light; font-family: Arial, sans-serif; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #2f2730; background: #f6f1ec; }
            main { max-width: 820px; margin: 32px auto; padding: 42px 48px; background: #fff; box-shadow: 0 12px 35px rgba(77,16,33,.12); }
            header { border-bottom: 4px solid #4d1021; padding-bottom: 22px; margin-bottom: 28px; }
            .eyebrow { color: #4d1021; font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
            h1 { margin: 8px 0 4px; color: #4d1021; font-size: 30px; }
            h2 { color: #4d1021; font-size: 16px; border-bottom: 1px solid #e5d9d0; padding-bottom: 8px; margin: 28px 0 14px; }
            p, li, dd { font-size: 13px; line-height: 1.6; }
            dl { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px 24px; margin: 0; }
            dt { color: #776a70; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
            dd { margin: 2px 0 0; font-weight: 600; }
            ul { margin: 0; padding-left: 20px; }
            li { margin: 0 0 10px; }
            li span { color: #776a70; }
            .confidential { color: #776a70; }
            .opinion { white-space: pre-wrap; border-left: 3px solid #4d1021; background: #f6f1ec; padding: 14px 16px; }
            footer { border-top: 1px solid #e5d9d0; color: #776a70; font-size: 11px; margin-top: 32px; padding-top: 14px; }
            @media print { body { background: white; } main { box-shadow: none; margin: 0; max-width: none; padding: 0; } }
          </style>
        </head>
        <body>
          <main>
            <header>
              <div class="eyebrow">Vértice Pessoas &amp; Estratégia</div>
              <h1>Parecer profissional</h1>
              <p>${escapeHtml(candidate.full_name)} · ${escapeHtml(candidate.current_job_title ?? candidate.current_role ?? "Profissional")}</p>
            </header>
            <h2>Resumo profissional</h2>
            <dl>
              <div><dt>Área</dt><dd>${escapeHtml(candidate.area)}</dd></div>
              <div><dt>Senioridade</dt><dd>${escapeHtml(candidate.seniority)}</dd></div>
              <div><dt>Empresa atual</dt><dd>${escapeHtml(candidate.current_company)}</dd></div>
              <div><dt>Localização</dt><dd>${escapeHtml([candidate.city, candidate.state].filter(Boolean).join(", "))}</dd></div>
              <div><dt>Pretensão</dt><dd>${escapeHtml(formatSalary(candidate.expected_salary))}</dd></div>
              <div><dt>Disponibilidade</dt><dd>${escapeHtml(candidate.availability)}</dd></div>
              <div><dt>LinkedIn</dt><dd>${escapeHtml(candidate.linkedin_url)}</dd></div>
              ${directContact}
            </dl>
            <h2>Processos seletivos</h2>
            ${jobRows ? `<ul>${jobRows}</ul>` : "<p>Nenhum processo seletivo registrado.</p>"}
            <h2>Histórico de acompanhamento</h2>
            ${timelineRows ? `<ul>${timelineRows}</ul>` : "<p>Nenhum evento adicional registrado.</p>"}
            <h2>Parecer da consultoria</h2>
            <div class="opinion">${escapeHtml(candidate.notes || "Nenhuma anotação interna registrada.")}</div>
            <h2>Currículos considerados</h2>
            ${resumes.length ? `<ul>${resumes.map((resume) => `<li>${escapeHtml(resume.original_filename)} · ${escapeHtml(new Date(resume.created_at).toLocaleDateString("pt-BR"))}</li>`).join("")}</ul>` : "<p>Nenhum currículo anexado.</p>"}
            <footer>Documento gerado pela Vértice Pessoas &amp; Estratégia em ${escapeHtml(new Date().toLocaleString("pt-BR"))}.</footer>
          </main>
        </body>
      </html>`);
    reportWindow.document.close();
    reportWindow.focus();
    window.setTimeout(() => reportWindow.print(), 150);
  }

  return (
    <Button type="button" variant="outline" className="gap-2" onClick={openReport}>
      <FileText className="h-4 w-4" />
      {t("Exportar Parecer da Vértice")}
    </Button>
  );
}
