"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/hooks/i18n/useT";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { ROLE_RANK } from "@/lib/auth/types";
import { User, Plus, MagnifyingGlass, ArrowSquareOut, Trash } from "@/lib/ui/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCandidateList } from "@/lib/people/client-hooks";
import type { CandidateStatus, VerticeCandidate } from "@/lib/people/types";
import { CandidateFormDialog } from "@/components/recruitment/CandidateForm";
import { DeleteCandidateDialog } from "@/components/recruitment/DeleteCandidateDialog";

const STATUS_LABELS: Record<CandidateStatus, string> = {
  active: "Ativo",
  in_process: "Em Processo",
  hired: "Contratado",
  inactive: "Inativo",
  do_not_contact: "Não Contatar",
};

export function TalentosClient() {
  const t = useT();
  const { user, activeOrg } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [seniority, setSeniority] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<VerticeCandidate | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState<VerticeCandidate | null>(null);
  const canDeleteCandidates = Boolean(
    user.is_platform_admin || (activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager),
  );

  const { data, isLoading } = useCandidateList({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    seniority: seniority !== "all" ? seniority : undefined,
    page,
    limit: 25,
  });

  const candidates = data?.data ?? [];
  const pagination = data?.pagination;

  const router = useRouter();

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Banco de Talentos")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Repositório central de candidatos profissionais e executivos.")}
          </p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          {t("Novo Candidato")}
        </Button>
      </header>

      {/* Barra de Filtros Responsiva */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full flex-1 sm:max-w-sm">
          <MagnifyingGlass className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("Buscar por nome, cargo ou empresa...")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9"
          />
        </div>

        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          <Select
            value={status}
            onValueChange={(val) => {
              setStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder={t("Status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todos os status")}</SelectItem>
              <SelectItem value="active">{t("Ativo")}</SelectItem>
              <SelectItem value="in_process">{t("Em Processo")}</SelectItem>
              <SelectItem value="hired">{t("Contratado")}</SelectItem>
              <SelectItem value="inactive">{t("Inativo")}</SelectItem>
              <SelectItem value="do_not_contact">{t("Não Contatar")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={seniority}
            onValueChange={(val) => {
              setSeniority(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[195px]">
              <SelectValue placeholder={t("Senioridade")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todas as senioridades")}</SelectItem>
              <SelectItem value="junior">{t("Júnior")}</SelectItem>
              <SelectItem value="pleno">{t("Pleno")}</SelectItem>
              <SelectItem value="senior">{t("Sênior")}</SelectItem>
              <SelectItem value="especialista">{t("Especialista")}</SelectItem>
              <SelectItem value="coordenacao">{t("Coordenação")}</SelectItem>
              <SelectItem value="gerencia">{t("Gerência")}</SelectItem>
              <SelectItem value="diretoria">{t("Diretoria / C-Level")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="bg-surface-muted mb-4 rounded-full p-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">{t("Nenhum candidato encontrado")}</h3>
          <p className="mt-1 mb-4 max-w-md text-sm text-muted-foreground">
            {t(
              "Cadastre novos profissionais no banco de talentos para vinculá-los aos processos seletivos.",
            )}
          </p>
          <Button onClick={() => setIsNewOpen(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("Cadastrar Primeiro Candidato")}
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Visualização Mobile: Cards */}
          <div className="block space-y-3 md:hidden">
            {candidates.map((c) => (
              <div
                key={c.id}
                onClick={() => router.push(`/app/recrutamento/talentos/${c.id}`)}
                className="cursor-pointer space-y-2.5 rounded-lg border bg-card p-4 shadow-xs transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-foreground">
                      {c.full_name}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.email ?? c.phone_e164 ?? "—"}
                    </p>
                  </div>
                  <CandidateStatusBadge status={c.status} />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <span className="font-medium text-muted-foreground">
                      {t("Cargo / Empresa")}:
                    </span>
                    <span className="truncate">
                      {c.current_job_title ?? c.current_role ?? "—"}{" "}
                      {c.current_company ? `(${c.current_company})` : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 text-muted-foreground">
                    <span>
                      <span className="font-medium">{t("Senioridade")}:</span>{" "}
                      <span className="text-foreground capitalize">{c.seniority ?? "—"}</span>
                    </span>
                    <span>
                      <span className="font-medium">{t("Local")}:</span>{" "}
                      {c.city && c.state ? `${c.city}, ${c.state}` : (c.city ?? "—")}
                    </span>
                  </div>
                </div>

                <div
                  className="border-t border-border/60 pt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs"
                    onClick={() => setEditingCandidate(c)}
                  >
                    {t("Editar")}
                  </Button>
                  {canDeleteCandidates && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeletingCandidate(c)}
                    >
                      <Trash className="mr-1 h-3.5 w-3.5" />
                      {t("Excluir")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Visualização Desktop: Tabela */}
          <div className="hidden overflow-hidden rounded-md border bg-card shadow-xs md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/60 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="p-3.5">{t("Nome")}</th>
                  <th className="p-3.5">{t("Cargo / Empresa")}</th>
                  <th className="p-3.5">{t("Área")}</th>
                  <th className="p-3.5">{t("Localização")}</th>
                  <th className="p-3.5">{t("Senioridade")}</th>
                  <th className="p-3.5">{t("Status")}</th>
                  <th className="p-3.5 text-right">{t("Ações")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {candidates.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/app/recrutamento/talentos/${c.id}`)}
                    className="cursor-pointer transition-colors hover:bg-accent/5"
                  >
                    <td className="p-3.5">
                      <Link
                        href={`/app/recrutamento/talentos/${c.id}`}
                        className="block font-medium text-foreground transition-colors hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.full_name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {c.email ?? c.phone_e164 ?? "—"}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-medium text-foreground">
                        {c.current_job_title ?? c.current_role ?? "—"}
                      </div>
                      {c.current_company && (
                        <div className="text-xs text-muted-foreground">{c.current_company}</div>
                      )}
                    </td>
                    <td className="p-3.5 text-muted-foreground">{c.area ?? "—"}</td>
                    <td className="p-3.5 text-muted-foreground">
                      {c.city && c.state ? `${c.city}, ${c.state}` : (c.city ?? "—")}
                    </td>
                    <td className="p-3.5 text-muted-foreground capitalize">{c.seniority ?? "—"}</td>
                    <td className="p-3.5">
                      <CandidateStatusBadge status={c.status} />
                    </td>
                    <td className="p-3.5 text-right">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setEditingCandidate(c)}
                        >
                          {t("Editar")}
                        </Button>
                        <Link href={`/app/recrutamento/talentos/${c.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs hover:bg-accent/10 hover:text-primary"
                          >
                            <span>{t("Ver dossiê")}</span>
                            <ArrowSquareOut className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        {canDeleteCandidates && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeletingCandidate(c)}
                            title={t("Excluir candidato")}
                          >
                            <Trash className="h-3.5 w-3.5" />
                            {t("Excluir")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-md border bg-card p-4 text-xs text-muted-foreground">
              <span>
                {t("Página")} {pagination.page} {t("de")} {pagination.totalPages} (
                {pagination.total} {t("candidatos")})
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("Anterior")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("Próxima")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <CandidateFormDialog mode="create" open={isNewOpen} onOpenChange={setIsNewOpen} />
      {editingCandidate && (
        <CandidateFormDialog
          mode="edit"
          candidate={editingCandidate}
          open={!!editingCandidate}
          onOpenChange={(open) => {
            if (!open) setEditingCandidate(null);
          }}
        />
      )}
      <DeleteCandidateDialog
        candidate={deletingCandidate}
        open={deletingCandidate !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingCandidate(null);
        }}
      />
    </div>
  );
}

function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  const t = useT();
  const label = STATUS_LABELS[status] ?? status;

  switch (status) {
    case "active":
      return (
        <Badge
          variant="outline"
          className="border-emerald-600/30 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300"
        >
          {t(label)}
        </Badge>
      );
    case "in_process":
      return (
        <Badge
          variant="outline"
          className="border-primary/40 bg-primary/10 font-semibold text-primary dark:text-primary-foreground"
        >
          {t(label)}
        </Badge>
      );
    case "hired":
      return (
        <Badge
          variant="secondary"
          className="border-amber-600/30 bg-amber-500/15 font-medium text-amber-800 dark:text-amber-300"
        >
          {t(label)}
        </Badge>
      );
    case "do_not_contact":
      return (
        <Badge variant="destructive" className="font-medium">
          {t(label)}
        </Badge>
      );
    case "inactive":
    default:
      return (
        <Badge variant="secondary" className="font-normal text-muted-foreground">
          {t(label)}
        </Badge>
      );
  }
}
