import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { partesNoFuso, instanteDe } from "@/lib/agenda/fuso";
import { APPLICATION_STAGES } from "@/lib/people/types";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarBlank,
  ListChecks,
  Kanban,
  UsersThree,
  Buildings,
  User,
  Plus,
  ArrowRight,
  ClipboardText,
  ClockCountdown,
} from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard — Vértice Hub" };

function formatCurrency(cents: number | null | undefined): string {
  if (cents == null || isNaN(cents)) return "R$ 0,00";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

// `fuso` é obrigatório: sem ele, Node.js interpreta o instante em UTC e exibe
// horário errado em servidores com TZ=UTC (o padrão do Docker). Default
// defensivo — o chamador SEMPRE deve passar o fuso lido da org.
function formatTime(iso: string | null | undefined, fuso = "America/Sao_Paulo"): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: fuso,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

// Fonte única de verdade: os ids reais do banco (received, screening,
// vertice_interview, assessment, ...) e os rótulos de lib/people/types.ts.
// A versão anterior mapeava keys inventadas (01_recebido) que nunca
// existiram no DB — toda candidatura mostrava o slug cru.
const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  APPLICATION_STAGES.map((s) => [s.id, s.label]),
);

export default async function DashboardPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  const orgId = activeOrg.orgId;
  const supabase = await createClient();

  // ── TIMEZONE FIX (hotfix 4.3B #1) ───────────────────────────────────────────
  // Docker roda TZ=UTC. `new Date().setHours(0,0,0,0)` zeroa em UTC — um
  // compromisso às 22:00 BRT (= 01:00 UTC do dia seguinte) aparecia no Dashboard
  // como 01:00 de outro dia. Lemos o fuso da org e usamos `partesNoFuso` +
  // `instanteDe` (lib/agenda/fuso.ts) para obter os limites UTC do dia LOCAL.
  const FUSO_PADRAO = "America/Sao_Paulo";
  const { data: orgTimezoneRow } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", orgId)
    .maybeSingle();
  const fusoOrg = (() => {
    const tz = orgTimezoneRow?.timezone as string | undefined;
    if (!tz) return FUSO_PADRAO;
    try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return tz; } catch { return FUSO_PADRAO; }
  })();

  const agora = new Date();
  const localHoje = partesNoFuso(agora, fusoOrg);
  // `instanteDe` sem hora/minuto/segundo = meia-noite local em UTC.
  const hojeInicio = instanteDe(
    { ano: localHoje.ano, mes: localHoje.mes, dia: localHoje.dia },
    fusoOrg,
  );
  const hojeFim = instanteDe(
    { ano: localHoje.ano, mes: localHoje.mes, dia: localHoje.dia, hora: 23, minuto: 59, segundo: 59 },
    fusoOrg,
  );
  const dataSeteDias = new Date(hojeInicio);
  dataSeteDias.setDate(dataSeteDias.getDate() - 7);
  const seteDiasAtras = dataSeteDias.toISOString();

  // Queries paralelas otimizadas
  const [
    { data: appointments },
    { data: tasks },
    { data: leads },
    { data: companies },
    { data: contacts },
    { data: jobOpenings },
    { data: candidates },
    { data: applications },
  ] = await Promise.all([
    // Compromissos hoje
    supabase
      .from("calendar_appointments")
      .select("id, title, starts_at, ends_at, status, contact_id")
      .eq("organization_id", orgId)
      .gte("starts_at", hojeInicio.toISOString())
      .lte("starts_at", hojeFim.toISOString())
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true })
      .limit(6),

    // Tarefas pendentes
    supabase
      .from("crm_tasks")
      .select("id, title, due_date, priority, status, contact_id, client_company_id")
      .eq("organization_id", orgId)
      .neq("status", "completed")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(6),

    // Oportunidades comerciais
    supabase
      .from("crm_leads")
      .select("id, title, value_cents, currency, status, last_activity_at, created_at, client_company_id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),

    // Empresas clientes para mapeamento
    supabase
      .from("client_companies")
      .select("id, trade_name, legal_name")
      .eq("organization_id", orgId),

    // Contatos para mapeamento
    supabase
      .from("contacts")
      .select("id, name, display_name")
      .eq("organization_id", orgId),

    // Vagas abertas
    supabase
      .from("vertice_job_openings")
      .select("id, title, status, openings_count, work_model, client_company_id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),

    // Candidatos
    supabase
      .from("vertice_candidates")
      .select("id, full_name, status, seniority, current_job_title")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),

    // Candidaturas recentes
    supabase
      .from("vertice_job_applications")
      .select("id, candidate_id, job_opening_id, stage, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  // Mapas em memória para resolução instantânea sem sobrecarga de JOIN
  const companyMap = new Map(
    (companies ?? []).map((c) => [c.id, c.trade_name || c.legal_name]),
  );
  const contactMap = new Map(
    (contacts ?? []).map((c) => [c.id, c.display_name || c.name]),
  );
  const candidateMap = new Map(
    (candidates ?? []).map((c) => [c.id, c.full_name]),
  );
  const jobMap = new Map(
    (jobOpenings ?? []).map((j) => [j.id, j.title]),
  );

  // Métricas Comerciais
  const openLeads = (leads ?? []).filter((l) => l.status !== "won" && l.status !== "lost");
  const totalPipelineCents = openLeads.reduce((acc, l) => acc + (l.value_cents ?? 0), 0);
  const staleLeads = openLeads.filter((l) => {
    const lastDate = l.last_activity_at || l.created_at;
    return lastDate && lastDate < seteDiasAtras;
  });

  // Métricas Recrutamento
  const openJobs = (jobOpenings ?? []).filter((j) => j.status === "open");
  const candidatesInProcess = (candidates ?? []).filter(
    (c) => c.status === "in_process" || c.status === "active",
  );

  const firstName = user.email?.split("@")[0] || "Gestor";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Top Header & Boas-Vindas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Painel Executivo & Operacional
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Olá, {firstName}! Visão unificada do seu dia, funil comercial e recrutamento executivo.
          </p>
        </div>

        {/* Barra de Atalhos Rápidos */}
        <div className="flex items-center flex-wrap gap-2">
          <Link href="/app/crm/empresas">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs font-medium">
              <Plus size={14} /> Nova Empresa
            </Button>
          </Link>
          <Link href="/app/contacts">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs font-medium">
              <Plus size={14} /> Novo Contato
            </Button>
          </Link>
          <Link href="/app/kanban">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs font-medium">
              <Plus size={14} /> Nova Oportunidade
            </Button>
          </Link>
          <Link href="/app/tasks">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs font-medium">
              <Plus size={14} /> Nova Tarefa
            </Button>
          </Link>
          <Link href="/app/recrutamento/vagas">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs font-medium">
              <Plus size={14} /> Nova Vaga
            </Button>
          </Link>
          <Link href="/app/recrutamento/talentos">
            <Button size="sm" variant="default" className="gap-1.5 text-xs font-semibold">
              <Plus size={14} /> Novo Candidato
            </Button>
          </Link>
        </div>
      </div>

      {/* BLOCO 1: HOJE (Compromissos + Tarefas) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
            <ClockCountdown size={16} className="text-primary" />
            Hoje na Operação
          </h2>
          <span className="text-xs text-muted-foreground capitalize">
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              timeZone: fusoOrg,
            }).format(new Date())}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Compromissos de Hoje */}
          <Card className="flex flex-col border shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarBlank size={18} className="text-primary" />
                <CardTitle className="text-sm font-semibold">Compromissos de Hoje</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs">
                {(appointments ?? []).length} agendado{((appointments ?? []).length !== 1 ? "s" : "")}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-2 flex-1">
              {(appointments ?? []).length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Nenhum compromisso agendado para hoje.
                  <div className="mt-2">
                    <Link href="/app/agenda">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
                        Abrir Agenda <ArrowRight size={12} className="ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(appointments ?? []).map((app) => {
                    const contactName = app.contact_id ? contactMap.get(app.contact_id) : null;
                    return (
                      <Link
                        key={app.id}
                        href="/app/agenda"
                        className="py-2.5 flex items-center justify-between hover:bg-muted/40 px-2 rounded-md transition-colors group"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {app.title}
                          </p>
                          {contactName && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <User size={12} /> {contactName}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-semibold text-foreground">
                            {formatTime(app.starts_at, fusoOrg)}
                            {app.ends_at ? ` - ${formatTime(app.ends_at, fusoOrg)}` : ""}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tarefas para Hoje / Atrasadas */}
          <Card className="flex flex-col border shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks size={18} className="text-primary" />
                <CardTitle className="text-sm font-semibold">Tarefas para Hoje / Atrasadas</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs">
                {(tasks ?? []).length} pendente{((tasks ?? []).length !== 1 ? "s" : "")}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-2 flex-1">
              {(tasks ?? []).length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Nenhuma tarefa pendente com prazo imediato.
                  <div className="mt-2">
                    <Link href="/app/tasks">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
                        Ver todas as Tarefas <ArrowRight size={12} className="ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(tasks ?? []).map((t) => {
                    const company = t.client_company_id ? companyMap.get(t.client_company_id) : null;
                    const contact = t.contact_id ? contactMap.get(t.contact_id) : null;
                    return (
                      <Link
                        key={t.id}
                        href="/app/tasks"
                        className="py-2.5 flex items-center justify-between hover:bg-muted/40 px-2 rounded-md transition-colors group"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {t.title}
                          </p>
                          {(company || contact) && (
                            <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                              {company && <span className="flex items-center gap-1"><Buildings size={12} /> {company}</span>}
                              {contact && <span className="flex items-center gap-1"><User size={12} /> {contact}</span>}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          {t.priority === "high" && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">Alta</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(t.due_date)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* BLOCO 2: COMERCIAL */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
            <Kanban size={16} className="text-primary" />
            Comercial B2B & Oportunidades
          </h2>
          <Link href="/app/kanban" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
            Abrir Funil <ArrowRight size={12} />
          </Link>
        </div>

        {/* Métricas Comerciais */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4 border shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">Oportunidades Abertas</p>
            <p className="text-2xl font-bold text-foreground mt-1">{openLeads.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Em negociação ativa</p>
          </Card>

          <Card className="p-4 border shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">Valor Estimado no Funil</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(totalPipelineCents)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Soma dos valores em aberto</p>
          </Card>

          <Card className="p-4 border shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">Paradas / Em Risco</p>
            <div className="flex items-center gap-2 mt-1">
              <p className={`text-2xl font-bold ${staleLeads.length > 0 ? "text-amber-500" : "text-foreground"}`}>
                {staleLeads.length}
              </p>
              {staleLeads.length > 0 && (
                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                  Atenção
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">&gt; 7 dias sem interação</p>
          </Card>
        </div>

        {/* Oportunidades Recentes */}
        <Card className="border shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">Oportunidades Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            {openLeads.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma oportunidade comercial aberta.</p>
            ) : (
              <div className="divide-y divide-border">
                {openLeads.slice(0, 5).map((l) => {
                  const company = l.client_company_id ? companyMap.get(l.client_company_id) : null;
                  return (
                    <Link
                      key={l.id}
                      href="/app/kanban"
                      className="py-2.5 flex items-center justify-between hover:bg-muted/40 px-2 rounded-md transition-colors group"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {l.title}
                        </p>
                        {company && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Buildings size={12} /> {company}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(l.value_cents)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatDate(l.created_at)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* BLOCO 3: RECRUTAMENTO */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
            <UsersThree size={16} className="text-primary" />
            Recrutamento & Seleção Executiva
          </h2>
          <Link href="/app/recrutamento" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
            Ver Hub de Recrutamento <ArrowRight size={12} />
          </Link>
        </div>

        {/* Métricas Recrutamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="p-4 border shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Vagas Abertas</p>
                <p className="text-2xl font-bold text-foreground mt-1">{openJobs.length}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Posições em andamento</p>
              </div>
              <ClipboardText size={32} className="text-primary" aria-hidden="true" />
            </div>
          </Card>

          <Card className="p-4 border shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Candidatos no Processo</p>
                <p className="text-2xl font-bold text-foreground mt-1">{candidatesInProcess.length}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Talentos ativos ou em triagem</p>
              </div>
              <UsersThree size={32} className="text-primary" aria-hidden="true" />
            </div>
          </Card>
        </div>

        {/* Grid de Vagas Abertas e Candidaturas Recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Vagas Abertas */}
          <Card className="border shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Vagas Abertas</CardTitle>
              <Link href="/app/recrutamento/vagas">
                <Button variant="ghost" size="sm" className="h-6 text-xs text-primary px-2">
                  Ver todas
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {openJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma vaga aberta no momento.</p>
              ) : (
                <div className="divide-y divide-border">
                  {openJobs.slice(0, 4).map((j) => {
                    const company = j.client_company_id ? companyMap.get(j.client_company_id) : null;
                    return (
                      <Link
                        key={j.id}
                        href={`/app/recrutamento/vagas`}
                        className="py-2.5 flex items-center justify-between hover:bg-muted/40 px-2 rounded-md transition-colors group"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {j.title}
                          </p>
                          {company && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Buildings size={12} /> {company}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant="outline" className="text-[10px]">
                            {j.work_model === "remote" ? "Remoto" : j.work_model === "hybrid" ? "Híbrido" : "Presencial"}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Candidaturas Recentes & Movimentações */}
          <Card className="border shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Candidaturas Recentes</CardTitle>
              <Link href="/app/recrutamento/pipeline">
                <Button variant="ghost" size="sm" className="h-6 text-xs text-primary px-2">
                  Ver Funil
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {(applications ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma candidatura registrada.</p>
              ) : (
                <div className="divide-y divide-border">
                  {(applications ?? []).slice(0, 4).map((app) => {
                    const candName = candidateMap.get(app.candidate_id) || "Candidato";
                    const jobTitle = jobMap.get(app.job_opening_id) || "Vaga";
                    const stageLabel = STAGE_LABELS[app.stage] || app.stage;
                    return (
                      <Link
                        key={app.id}
                        href="/app/recrutamento/pipeline"
                        className="py-2.5 flex items-center justify-between hover:bg-muted/40 px-2 rounded-md transition-colors group"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {candName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {jobTitle}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {stageLabel}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDate(app.created_at)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
