"use client";

import { useMemo } from "react";
import { useT } from "@/hooks/i18n/useT";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VerticeJobOpening } from "@/lib/people/types";

export interface JobGroup {
  label: string;
  jobs: VerticeJobOpening[];
}

export function groupJobsByCompany(
  jobs: VerticeJobOpening[],
  emptyCompanyLabel = "Sem empresa",
): JobGroup[] {
  const groups = new Map<string, VerticeJobOpening[]>();

  for (const job of jobs) {
    const company = job.client_company ?? job.company;
    const label = company?.trade_name || company?.legal_name || emptyCompanyLabel;
    const current = groups.get(label) ?? [];
    current.push(job);
    groups.set(label, current);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "pt-BR"))
    .map(([label, groupedJobs]) => ({
      label,
      jobs: [...groupedJobs].sort((left, right) => left.title.localeCompare(right.title, "pt-BR")),
    }));
}

interface GroupedJobSelectProps {
  jobs: VerticeJobOpening[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  allOption?: { value: string; label: string };
  countLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function GroupedJobSelect({
  jobs,
  value,
  onValueChange,
  placeholder,
  allOption,
  countLabel = "vagas",
  disabled,
  id,
  className,
}: GroupedJobSelectProps) {
  const t = useT();
  const groups = useMemo(() => groupJobsByCompany(jobs, t("Sem empresa")), [jobs, t]);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={className} data-testid="grouped-job-select">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allOption && <SelectItem value={allOption.value}>{allOption.label}</SelectItem>}
        {groups.map((group, index) => (
          <SelectGroup key={group.label}>
            {(allOption || index > 0) && <SelectSeparator />}
            <SelectLabel className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{group.label}</span>
              <span className="font-normal">
                {group.jobs.length} {countLabel}
              </span>
            </SelectLabel>
            {group.jobs.map((job) => (
              <SelectItem key={job.id} value={job.id}>
                {job.title}
                {job.department ? ` · ${job.department}` : ""}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
