"use client";

import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteCandidate } from "@/lib/people/client-hooks";
import type { VerticeCandidate } from "@/lib/people/types";

interface Props {
  candidate: VerticeCandidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteCandidateDialog({ candidate, open, onOpenChange, onDeleted }: Props) {
  const t = useT();
  const remove = useDeleteCandidate();

  async function confirm() {
    if (!candidate) return;
    try {
      await remove.mutateAsync(candidate.id);
      toast.success(t("Candidato excluído."));
      onOpenChange(false);
      onDeleted?.();
    } catch {
      // O hook exibe o erro da API.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Excluir candidato?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "Esta ação remove o candidato, suas candidaturas e currículos anexados. Não é possível desfazer.",
            )}
            {candidate?.full_name ? ` ${candidate.full_name}` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>{t("Cancelar")}</AlertDialogCancel>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
            disabled={remove.isPending}
            onClick={() => void confirm()}
          >
            {remove.isPending ? t("Excluindo...") : t("Excluir Candidato")}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
