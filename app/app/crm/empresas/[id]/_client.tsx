"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import {
  ArrowLeft,
  Buildings,
  PencilSimple,
  Globe,
  MapPin,
  User,
  Users,
  EnvelopeSimple,
  Phone,
  Briefcase,
  Kanban,
  ArrowSquareOut,
  Note,
} from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyDetail } from "@/lib/people/client-hooks";
import { EditCompanyDialog } from "../_client";

export function EmpresaDetalheClient({ id }: { id: string }) {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const { data, isLoading, error } = useCompanyDetail(id);
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 lg:col-span-2 rounded-md" />
          <Skeleton className="h-72 lg:col-span-1 rounded-md" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-destructive font-medium">{t("Empresa cliente não encontrada.")}</div>
        <Link href="/app/crm/empresas">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("Voltar às Empresas")}
          </Button>
        </Link>
      </div>
    );
  }

  const { company, contacts = [], jobs = [], leads = [] } = data;

  const statusLabel =
    company.status === "active"
      ? t("Ativa")
      : company.status === "prospect"
      ? t("Prospect")
      : t("Inativa");

  const statusBadgeStyle =
    company.status === "active"
      ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
      : company.status === "prospect"
      ? "border-amber-600/30 bg-amber-500/15 text-amber-800 dark:text-amber-300 font-medium"
      : "border-stone-300 bg-stone-100 text-stone-700 font-normal";

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/crm/empresas">
            <Button variant="ghost" size="icon" className="h-8 w-8" title={t("Voltar")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                {t("Conta Corporativa")}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {company.trade_name}
              </h1>
              <Badge variant="outline" className={statusBadgeStyle}>
                {statusLabel}
              </Badge>
            </div>
            {company.legal_name && (
              <p className="text-xs text-muted-foreground mt-0.5">{company.legal_name}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/app/crm/empresas">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("Voltar")}
            </Button>
          </Link>
          <Button onClick={() => setIsEditOpen(true)} className="gap-2">
            <PencilSimple className="h-4 w-4" />
            {t("Editar Empresa")}
          </Button>
        </div>
      </header>

      {/* Grid Principal do Dossiê */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal: Dados da Empresa & Observações */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados da Empresa */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Buildings className="h-4 w-4 text-primary" />
                {t("Dados da Empresa")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">{t("Nome Fantasia")}</span>
                <span className="font-medium text-foreground">{company.trade_name}</span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block">{t("Razão Social")}</span>
                <span className="text-foreground">{company.legal_name || "—"}</span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block">{t("Setor de Atuação")}</span>
                <span className="text-foreground">{company.industry || "—"}</span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block">{t("Website")}</span>
                {company.website ? (
                  <a
                    href={
                      company.website.startsWith("http")
                        ? company.website
                        : `https://${company.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {company.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

              <div>
                <span className="text-xs text-muted-foreground block">{t("Cidade / UF")}</span>
                <span className="text-foreground inline-flex items-center gap-1">
                  {(company.city || company.state) && (
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  {company.city && company.state
                    ? `${company.city}, ${company.state}`
                    : company.city || company.state || "—"}
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block">{t("Status Comercial")}</span>
                <span className="font-medium">{statusLabel}</span>
              </div>

              {company.created_at && (
                <div className="sm:col-span-2 pt-2 border-t text-xs text-muted-foreground">
                  {t("Cadastrada em")}:{" "}
                  {new Date(company.created_at).toLocaleDateString(tagDoIdioma, {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Note className="h-4 w-4 text-primary" />
                {t("Observações Comerciais & Alinhamentos")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {company.notes ? (
                <div className="rounded-md bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground border border-border/50">
                  {company.notes}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {t("Nenhuma observação cadastrada para esta empresa.")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Oportunidades Comerciais (CRM B2B) */}
          <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Kanban className="h-4 w-4 text-primary" />
                  {t("Oportunidades Comerciais")}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  {t("Negócios e projetos comerciais vinculados a esta conta")}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-normal text-xs">
                {leads.length} {leads.length === 1 ? t("oportunidade") : t("oportunidades")}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {leads.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
                  <Kanban className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="font-medium text-foreground">{t("Nenhuma oportunidade comercial vinculada")}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    {t("Crie uma oportunidade no Funil Comercial associando esta empresa cliente.")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60 rounded-md border bg-card overflow-hidden">
                  {leads.map((l) => (
                    <div
                      key={l.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-accent/5 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/app/pipelines/${l.pipeline_id}?lead=${l.id}`}
                            className="font-medium text-foreground hover:text-primary hover:underline text-sm"
                          >
                            {l.title}
                          </Link>
                          {l.stage?.name && (
                            <Badge variant="outline" className="text-[11px] bg-primary/5 text-primary border-primary/30">
                              {l.stage.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                          {l.value_cents != null && (
                            <span className="font-medium text-foreground">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: l.currency ?? "BRL",
                                maximumFractionDigits: 0,
                              }).format(l.value_cents / 100)}
                            </span>
                          )}
                          <span>• {new Date(l.created_at).toLocaleDateString(tagDoIdioma)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/app/pipelines/${l.pipeline_id}?lead=${l.id}`}>
                          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                            <ArrowSquareOut className="h-3.5 w-3.5" />
                            {t("Ver no Funil")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vagas / Processos de R&S */}
          <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                {t("Vagas & Processos de R&S")}
              </CardTitle>
              <Badge variant="secondary" className="font-normal text-xs">
                {jobs.length} {jobs.length === 1 ? t("vaga") : t("vagas")}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {jobs.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
                  <Briefcase className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="font-medium text-foreground">{t("Nenhuma vaga vinculada")}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    {t(
                      "Esta empresa cliente ainda não possui processos seletivos cadastrados no módulo de Recrutamento & Seleção.",
                    )}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60 rounded-md border bg-card overflow-hidden">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-accent/5 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/app/recrutamento/vagas/${job.id}`}
                            className="font-medium text-foreground hover:text-primary hover:underline text-sm"
                          >
                            {job.title}
                          </Link>
                          <Badge
                            variant="outline"
                            className={
                              job.status === "open"
                                ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px]"
                                : "border-stone-300 bg-stone-100 text-stone-700 text-[11px]"
                            }
                          >
                            {job.status === "open" ? t("Aberta") : job.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">
                            {job.work_model === "presential"
                              ? t("Presencial")
                              : job.work_model === "hybrid"
                              ? t("Híbrido")
                              : t("Remoto")}
                          </span>
                          {job.city && (
                            <span>
                              • {job.city}
                              {job.state ? `/${job.state}` : ""}
                            </span>
                          )}
                          {job.openings_count > 1 && (
                            <span>
                              • {job.openings_count} {t("posições")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/app/recrutamento/pipeline?job_id=${job.id}`}>
                          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                            <Kanban className="h-3.5 w-3.5 text-primary" />
                            {t("Funil")}
                          </Button>
                        </Link>
                        <Link href={`/app/recrutamento/vagas/${job.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8 text-xs hover:text-primary"
                          >
                            <ArrowSquareOut className="h-3.5 w-3.5" />
                            {t("Ver Vaga")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Lateral: Contatos / Decisores Corporativos */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {t("Contatos & Decisores")}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("Decisores vinculados via CRM comercial.")}
                </p>
              </div>
              <Badge variant="secondary" className="font-normal text-xs shrink-0">
                {contacts.length}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {contacts.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
                  <User className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="font-medium text-foreground">{t("Nenhum contato vinculado")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("Não há decisores corporativos associados a esta empresa.")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map((c) => {
                    const contact = c.contact;
                    const contactName =
                      contact?.display_name || contact?.name || t("Contato sem nome");
                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-lg border bg-card hover:bg-accent/5 transition-colors space-y-2"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-semibold text-xs">
                            {contactName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link
                                href={`/app/contacts/${c.contact_id}`}
                                className="font-medium text-foreground hover:text-primary hover:underline text-sm truncate"
                              >
                                {contactName}
                              </Link>
                              {c.is_primary && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 px-1.5 border-primary/40 bg-primary/10 text-primary font-medium"
                                >
                                  {t("Principal")}
                                </Badge>
                              )}
                            </div>
                            {c.role_in_company && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Briefcase className="h-3 w-3 shrink-0" />
                                <span className="truncate">{c.role_in_company}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-border/40">
                          {contact?.phone_number && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3 text-muted-foreground/80 shrink-0" />
                              <span>{contact.phone_number}</span>
                            </div>
                          )}
                          {contact?.email && (
                            <div className="flex items-center gap-1.5">
                              <EnvelopeSimple className="h-3 w-3 text-muted-foreground/80 shrink-0" />
                              <span className="truncate">{contact.email}</span>
                            </div>
                          )}
                          {!contact?.phone_number && !contact?.email && (
                            <span className="italic text-muted-foreground/70">
                              {t("Sem dados de contato direto.")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Edição Reutilizado */}
      {isEditOpen && (
        <EditCompanyDialog
          key={company.id + (company.updated_at ?? "")}
          company={company}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
        />
      )}
    </div>
  );
}
