import type {
  BookingPath,
  BookingPathTrackerRecord,
  UpsertBookingPathStatusInput,
} from '../../lib/booking-paths/types';

/**
 * Booking path tracker scaffold service.
 *
 * Intended behavior in implementation phase:
 * - Ensure one tracker row exists per candidate/path (resy, opentable, manual_outreach)
 * - Record status transitions with timestamp/note updates
 * - Keep candidate `last_activity_at` in sync
 */
export async function listBookingPathTrackers(
  candidateId: string,
): Promise<BookingPathTrackerRecord[]> {
  void candidateId;
  throw new Error('TODO: listBookingPathTrackers not implemented');
}

export async function initializeBookingPathTrackers(
  candidateId: string,
): Promise<void> {
  void candidateId;
  throw new Error('TODO: initializeBookingPathTrackers not implemented');
}

export async function upsertBookingPathStatus(
  input: UpsertBookingPathStatusInput,
): Promise<BookingPathTrackerRecord> {
  void input;
  throw new Error('TODO: upsertBookingPathStatus not implemented');
}

export async function getBookingPathTracker(
  candidateId: string,
  path: BookingPath,
): Promise<BookingPathTrackerRecord | null> {
  void candidateId;
  void path;
  throw new Error('TODO: getBookingPathTracker not implemented');
}
