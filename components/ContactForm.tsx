import type { Contact } from "@/lib/types";

export function ContactForm({
  action,
  initial,
  submitLabel,
  cancelHref,
  extraAction,
}: {
  action: (formData: FormData) => Promise<void>;
  initial?: Partial<Contact>;
  submitLabel: string;
  cancelHref: string;
  extraAction?: React.ReactNode;
}) {
  return (
    <form action={action} className="space-y-6">
      <FieldGroup title="Identity">
        <div className="grid grid-cols-2 gap-4">
          <Field name="firstName" label="First name" defaultValue={initial?.firstName} required />
          <Field name="lastName" label="Last name" defaultValue={initial?.lastName} required />
        </div>
        <Field name="title" label="Title" defaultValue={initial?.title} />
      </FieldGroup>

      <FieldGroup title="Company">
        <Field name="company" label="Company" defaultValue={initial?.company} />
        <Field name="industry" label="Industry" defaultValue={initial?.industry} />
        <div className="grid grid-cols-2 gap-4">
          <Field name="city" label="City" defaultValue={initial?.city} />
          <Field name="state" label="State" defaultValue={initial?.state} />
        </div>
      </FieldGroup>

      <FieldGroup
        title="Phone"
        hint="Used for screen pop matching on inbound calls and as the dial target for click-to-dial. E.164 format recommended (e.g. +14155550110)."
      >
        <Field
          name="phone"
          label="Work phone"
          defaultValue={initial?.phone}
          placeholder="+14155550110"
          mono
        />
        <Field
          name="mobile"
          label="Mobile phone"
          defaultValue={initial?.mobile}
          placeholder="+14155550111"
          mono
        />
      </FieldGroup>

      <FieldGroup title="Other">
        <Field name="email" label="Email" type="email" defaultValue={initial?.email} />
        <div className="grid grid-cols-2 gap-4">
          <Field
            name="accountValue"
            label="Account value (USD)"
            type="number"
            defaultValue={initial?.accountValue?.toString()}
          />
          <Field
            name="lastContacted"
            label="Last contacted"
            type="date"
            defaultValue={initial?.lastContacted}
          />
        </div>
        <Field
          name="tags"
          label="Tags (comma-separated)"
          defaultValue={initial?.tags?.join(", ")}
          placeholder="enterprise, champion"
        />
      </FieldGroup>

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
        {extraAction ?? <div />}
        <div className="flex items-center gap-2">
          <a
            href={cancelHref}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-slate-50"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function FieldGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </legend>
      {hint && <p className="mb-3 text-xs text-[var(--muted)]">{hint}</p>}
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
  required = false,
  mono = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className={`w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}

export function parseContactForm(formData: FormData): Omit<Contact, "id"> {
  const tagsRaw = String(formData.get("tags") ?? "");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    company: String(formData.get("company") ?? "").trim(),
    industry: String(formData.get("industry") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    mobile: String(formData.get("mobile") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    tags,
    accountValue: Number(formData.get("accountValue") ?? 0) || 0,
    lastContacted: String(formData.get("lastContacted") ?? "").trim(),
  };
}
