"use client";

export function DeleteContactButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm("Delete this contact? Call activity will remain in the log.")
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
      >
        Delete contact
      </button>
    </form>
  );
}
