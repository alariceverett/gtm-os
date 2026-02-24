export const BOOKING_PATHS = ['resy', 'opentable', 'manual_outreach'] as const;
export type BookingPath = (typeof BOOKING_PATHS)[number];

export const BOOKING_PATH_STATUSES = [
  'not_started',
  'checking',
  'attempted',
  'contacted',
  'responded',
  'booked',
  'blocked',
] as const;
export type BookingPathStatus = (typeof BOOKING_PATH_STATUSES)[number];

export interface BookingPathTrackerRecord {
  id: string;
  eventCandidateId: string;
  path: BookingPath;
  status: BookingPathStatus;
  statusChangedAt: string;
  firstAttemptedAt?: string | null;
  lastAttemptedAt?: string | null;
  completedAt?: string | null;
  statusNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBookingPathStatusInput {
  eventCandidateId: string;
  path: BookingPath;
  status: BookingPathStatus;
  note?: string;
  attemptedAt?: string;
  completedAt?: string;
}
