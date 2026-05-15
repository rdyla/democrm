import Link from "next/link";
import type { CallActivity } from "@/lib/types";
import { formatPhone } from "@/lib/phone";

export function ActivityRow({
  activity,
  isFirst,
  contactNameById,
}: {
  activity: CallActivity;
  isFirst: boolean;
  contactNameById: Record<string, string>;
}) {
  const name =
    activity.contactId && contactNameById[activity.contactId]
      ? contactNameById[activity.contactId]
      : null;

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 ${
        isFirst ? "" : "border-t border-[var(--border)]"
      }`}
    >
      <DirectionIcon direction={activity.direction} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {name ? (
            <Link
              href={`/contacts/${activity.contactId}`}
              className="hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="text-[var(--muted)]">Unknown caller</span>
          )}{" "}
          <span className="font-mono text-xs text-[var(--muted)]">
            {formatPhone(activity.phoneNumber)}
          </span>
        </div>
        {activity.notes && (
          <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
            {activity.notes}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end text-xs text-[var(--muted)]">
        <div>{formatRelative(activity.startedAt)}</div>
        <div className="flex items-center gap-2">
          {activity.durationSeconds != null && (
            <span>{formatDuration(activity.durationSeconds)}</span>
          )}
          {activity.disposition && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">
              {activity.disposition}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DirectionIcon({ direction }: { direction: "inbound" | "outbound" }) {
  const isInbound = direction === "inbound";
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
        isInbound
          ? "bg-emerald-100 text-emerald-700"
          : "bg-blue-100 text-blue-700"
      }`}
      title={direction}
    >
      {isInbound ? "↓" : "↑"}
    </div>
  );
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
