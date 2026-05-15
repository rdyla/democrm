"use client";

export function CallButton({
  phoneNumber,
  contactId,
  name,
  email,
}: {
  phoneNumber: string;
  contactId: string;
  name?: string;
  email?: string;
}) {
  function dial() {
    window.dispatchEvent(
      new CustomEvent("democrm:dial", {
        detail: { phoneNumber, contactId, name, email },
      }),
    );
  }
  return (
    <button
      type="button"
      onClick={dial}
      className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
      title="Place call via Zoom Contact Center"
    >
      <span aria-hidden>☎</span>
      <span>Call</span>
    </button>
  );
}
