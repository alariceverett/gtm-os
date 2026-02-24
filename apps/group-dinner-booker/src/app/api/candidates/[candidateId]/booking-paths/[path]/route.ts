import { NextResponse } from 'next/server';

import {
  getBookingPathTracker,
  upsertBookingPathStatus,
} from '../../../../../../server/services/booking-paths.service';
import type {
  BookingPath,
  BookingPathStatus,
} from '../../../../../../lib/booking-paths/types';

interface RouteContext {
  params: {
    candidateId: string;
    path: BookingPath;
  };
}

interface PatchBody {
  status: BookingPathStatus;
  note?: string;
  attemptedAt?: string;
  completedAt?: string;
}

export async function GET(_: Request, context: RouteContext) {
  const { candidateId, path } = context.params;

  try {
    const tracker = await getBookingPathTracker(candidateId, path);

    if (!tracker) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ tracker }, { status: 200 });
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

export async function PATCH(request: Request, context: RouteContext) {
  const { candidateId, path } = context.params;
  const body = (await request.json()) as PatchBody;

  try {
    const tracker = await upsertBookingPathStatus({
      eventCandidateId: candidateId,
      path,
      status: body.status,
      note: body.note,
      attemptedAt: body.attemptedAt,
      completedAt: body.completedAt,
    });

    return NextResponse.json({ tracker }, { status: 200 });
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
