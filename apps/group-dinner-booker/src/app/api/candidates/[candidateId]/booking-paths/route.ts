import { NextResponse } from 'next/server';

import {
  initializeBookingPathTrackers,
  listBookingPathTrackers,
} from '../../../../../server/services/booking-paths.service';

interface RouteContext {
  params: {
    candidateId: string;
  };
}

export async function GET(_: Request, context: RouteContext) {
  const { candidateId } = context.params;

  try {
    const trackers = await listBookingPathTrackers(candidateId);
    return NextResponse.json({ trackers }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'booking_path_tracker_not_implemented',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 501 },
    );
  }
}

export async function POST(_: Request, context: RouteContext) {
  const { candidateId } = context.params;

  try {
    await initializeBookingPathTrackers(candidateId);
    return NextResponse.json(
      { ok: true, message: 'Booking path trackers initialized' },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: 'booking_path_tracker_not_implemented',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 501 },
    );
  }
}
