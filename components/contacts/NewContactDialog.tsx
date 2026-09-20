"use client";

import { ContactFormDialog, type ContactFormDialogProps } from "@/components/contacts/ContactFormDialog";

type Props = Omit<ContactFormDialogProps, "mode" | "contact"> & {
  nomeInicial?: string;
};

export function NewContactDialog(props: Props) {
  return <ContactFormDialog {...props} mode="create" />;
}
