"use client";

import { ContactFormDialog, type ContactFormDialogProps } from "@/components/contacts/ContactFormDialog";
import type { Contact } from "@/lib/types/contacts";

type Props = Omit<ContactFormDialogProps, "mode" | "contact"> & {
  contact: Contact;
};

export function EditContactDialog(props: Props) {
  return <ContactFormDialog {...props} contact={props.contact} mode="edit" />;
}
