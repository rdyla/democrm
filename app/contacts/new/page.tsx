import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createContact } from "@/lib/contacts";
import { ContactForm, parseContactForm } from "@/components/ContactForm";

export default function NewContactPage() {
  async function action(formData: FormData) {
    "use server";
    const input = parseContactForm(formData);
    const contact = await createContact(input);
    revalidatePath("/contacts");
    revalidatePath("/");
    redirect(`/contacts/${contact.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">New contact</h1>
        <p className="text-sm text-[var(--muted)]">
          Add a contact so an inbound call from that number screen-pops to this record.
        </p>
      </header>
      <ContactForm
        action={action}
        submitLabel="Create contact"
        cancelHref="/contacts"
      />
    </div>
  );
}
