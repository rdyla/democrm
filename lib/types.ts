export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  industry: string;
  email: string;
  phone: string;
  mobile: string;
  city: string;
  state: string;
  tags: string[];
  accountValue: number;
  lastContacted: string;
}

export type CallDirection = "inbound" | "outbound";

export type CallDisposition =
  | "completed"
  | "voicemail"
  | "missed"
  | "no-answer"
  | "callback-scheduled"
  | "wrong-number";

export interface CallActivity {
  id: string;
  contactId: string | null;
  direction: CallDirection;
  phoneNumber: string;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number | null;
  disposition: CallDisposition | null;
  notes: string | null;
  zoomEngagementId: string | null;
  rawEvent: string | null;
  createdAt: number;
}

export interface CallActivityInput {
  contactId?: string | null;
  direction: CallDirection;
  phoneNumber: string;
  startedAt?: number;
  endedAt?: number | null;
  durationSeconds?: number | null;
  disposition?: CallDisposition | null;
  notes?: string | null;
  zoomEngagementId?: string | null;
  rawEvent?: unknown;
}
