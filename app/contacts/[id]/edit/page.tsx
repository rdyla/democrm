import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteContact, getContactById, updateContact } from "@/lib/contacts";
import { ContactForm, parseContactForm } from "@/components/ContactForm";
import { DeleteContactButton } from "@/components/DeleteContactButton";

export default async function EditContactPage(
  props: PageProps<"/contacts/[id]/edit">,
) {
  const { id } = await props.params;
  const contact = await getContactById(id);
  if (!contact) notFound();

  async function saveAction(formData: FormData) {
    "use server";
    const input = parseContactForm(formData);
    await updateContact(id, input);
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
    revalidatePath("/");
    redirect(`/contacts/${id}`);
  }

  async function deleteAction() {
    "use server";
    await deleteContact(id);
    revalidatePath("/contacts");
    revalidatePath("/");
    redirect("/contacts");
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">
          Edit {contact.firstName} {contact.lastName}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Update phone numbers before a demo so screen pop and click-to-dial route correctly.
        </p>
      </header>
      <ContactForm
        action={saveAction}
        initial={contact}
        submitLabel="Save changes"
        cancelHref={`/contacts/${id}`}
        extraAction={<DeleteContactButton action={deleteAction} />}
      />
    </div>
  );
}
