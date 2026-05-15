export function ScreenPopBanner() {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
        ↓
      </span>
      <span>
        <strong>Screen pop:</strong> matched this contact from an inbound Zoom
        Contact Center call.
      </span>
    </div>
  );
}
