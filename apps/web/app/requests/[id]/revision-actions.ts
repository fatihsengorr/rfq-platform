"use server";

/**
 * Server actions for the RevisionsTab client component.
 *
 * These wrap the server-only api client (which reads session cookies via
 * next/headers and therefore must run in a request scope). We expose them
 * as async server functions so the client can call them directly without
 * hand-rolling an /api/... route.
 */

import { redirect } from "next/navigation";
import { compareRfqRevisions, getRfqRevisions, isApiClientError } from "../../api";
import type { RevisionTimelineItem, RfqRevisionDiff } from "@crm/shared";

export async function fetchRevisions(rfqId: string): Promise<RevisionTimelineItem[]> {
  try {
    return await getRfqRevisions(rfqId);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }
}

export async function fetchRevisionDiff(
  rfqId: string,
  a: number,
  b: number
): Promise<RfqRevisionDiff | null> {
  try {
    return await compareRfqRevisions(rfqId, a, b);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }
}
