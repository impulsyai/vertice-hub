"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useUpdateCandidate, type CandidateTimelineEvent } from "@/lib/people/client-hooks";
import type {
  VerticeCandidate,
  VerticeCandidateResume,
  VerticeJobApplication,
} from "@/lib/people/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ClockCounterClockwise, FileText, Note, UserCircle } from "@/lib/ui/icons";

interface Props {
  candidate: VerticeCandidate;
  resumes: VerticeCandidateResume[];
  applications: VerticeJobApplication[];
  events: CandidateTimelineEvent[];
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function stageLabel(stage: unknown, stages: Array<{ id: string; label: string }>) {
  const value = stringValue(stage);
  if (!value) return "";
  return stages.find((item) => item.id === value)?.label.replace(/^\d+\s*/, "") ?? value;
}

export function CandidateTimeline({ candidate, resumes, applications, events }: Props) {
  const t = useT();
  const locale = useTagDeIdioma();
  const updateCandidate = useUpdateCandidate(candidate.id);
  const [notes, setNotes] = useState(candidate.notes ?? "");

  const fallbackEvents = useMemo<CandidateTimelineEvent[]>(() => {
    const created: CandidateTimelineEvent = {
      id: `candidate-created-${candidate.id}`,
      created_at: candidate.created_at,
      actor_user_id: null,
      actor_name: "Sistema",
      action: "people.candidate_created",
      resource_type: "vertice_candidate",
      resource_id: candidate.id,
      metadata: {},
    };
    const resumeEvents = resumes.map((resume) => ({
      id: `resume-${resume.id}`,
      created_at: resume.created_at,
      actor_user_id: null,
      actor_name: "Sistema",
      action: "people.resume_uploaded",
      resource_type: "vertice_candidate_resume",
      resource_id: resume.id,
      metadata: { candidateId: candidate.id, filename: resume.original_filename },
    }));
    const applicationEvents = applications.map((application) => ({
      id: `application-${application.id}`,
      created_at: application.created_at,
      actor_user_id: null,
      actor_name: "Sistema",
      action: "people.application_created",
      resource_type: "vertice_job_application",
      resource_id: application.id,
      metadata: { candidate_id: candidate.id },
    }));
    return [created, ...resumeEvents, ...applicationEvents];
  }, [applications, candidate.created_at, candidate.id, resumes]);

  const visibleEvents = events.length > 0 ? events : fallbackEvents;

  function describeEvent(event: CandidateTimelineEvent) {
    const metadata = event.metadata;
    const application = applications.find((item) => item.id === event.resource_id);
    const job = application?.job_opening ?? application?.job;
    const jobLabel = job?.title ? ` · ${job.title}` : "";

    switch (event.action) {
      case "people.candidate_created":
        return `${t("Perfil de candidato criado")} · ${candidate.source === "whatsapp" ? "WhatsApp" : candidate.source || t("entrada manual")}`;
      case "people.candidate_updated":
        return t("Dados cadastrais atualizados");
      case "people.candidate_contact_linked":
        return t("Contato e conversa do WhatsApp vinculados");
      case "people.resume_uploaded":
        return `${t("Currículo anexado")}: ${stringValue(metadata.filename) ?? t("arquivo")}`;
      case "people.application_created":
        return `${t("Candidatura recebida")}${jobLabel}`;
      case "people.application_stage_changed": {
        const from = stageLabel(metadata.old_stage, [
          { id: "received", label: "01 RECEBIDO" },
          { id: "screening", label: "02 TRIAGEM" },
          { id: "vertice_interview", label: "03 ENTREVISTA VÉRTICE" },
          { id: "assessment", label: "04 AVALIAÇÃO" },
          { id: "shortlist", label: "05 SHORTLIST" },
          { id: "client_interview", label: "06 ENTREVISTA CLIENTE" },
          { id: "finalist", label: "07 FINALISTA" },
          { id: "approved", label: "08 APROVADO" },
          { id: "rejected", label: "09 REPROVADO" },
          { id: "withdrawn", label: "10 DESISTIU" },
        ]);
        const to = stageLabel(metadata.new_stage, [
          { id: "received", label: "01 RECEBIDO" },
          { id: "screening", label: "02 TRIAGEM" },
          { id: "vertice_interview", label: "03 ENTREVISTA VÉRTICE" },
          { id: "assessment", label: "04 AVALIAÇÃO" },
          { id: "shortlist", label: "05 SHORTLIST" },
          { id: "client_interview", label: "06 ENTREVISTA CLIENTE" },
          { id: "finalist", label: "07 FINALISTA" },
          { id: "approved", label: "08 APROVADO" },
          { id: "rejected", label: "09 REPROVADO" },
          { id: "withdrawn", label: "10 DESISTIU" },
        ]);
        return `${t("Movido de")} ${from || t("uma etapa")} ${t("para")} ${to || t("outra etapa")}${jobLabel}`;
      }
      default:
        return event.action;
    }
  }

  async function saveNotes() {
    try {
      await updateCandidate.mutateAsync({ notes: notes.trim() || null });
      toast.success(t("Parecer interno salvo."));
    } catch {
      // O hook já apresenta o erro da API.
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ClockCounterClockwise className="h-4 w-4 text-primary" />
          {t("Histórico / Timeline")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative space-y-4 pl-6">
          <div className="absolute top-2 bottom-2 left-2 w-px bg-border" />
          {visibleEvents.slice(0, 30).map((event) => (
            <div key={event.id} className="relative">
              <span className="absolute top-0.5 -left-[1.35rem] flex h-5 w-5 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                {event.action === "people.resume_uploaded" ? (
                  <FileText className="h-3 w-3" />
                ) : event.action === "people.candidate_updated" ? (
                  <UserCircle className="h-3 w-3" />
                ) : (
                  <ClockCounterClockwise className="h-3 w-3" />
                )}
              </span>
              <p className="text-sm font-medium text-foreground">{describeEvent(event)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(event.created_at).toLocaleString(locale)} · {event.actor_name}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-4">
          <label
            htmlFor="candidate-internal-opinion"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Note className="h-4 w-4 text-primary" />
            {t("Notas internas e parecer técnico")}
          </label>
          <Textarea
            id="candidate-internal-opinion"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder={t(
              "Registre observações de entrevista, aderência técnica e próximos passos...",
            )}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => void saveNotes()}
              disabled={updateCandidate.isPending}
            >
              {updateCandidate.isPending ? t("Salvando...") : t("Salvar parecer interno")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
