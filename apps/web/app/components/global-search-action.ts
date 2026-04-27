"use server";

/**
 * Server-action wrapper for the global search palette.
 *
 * The api.ts helper uses next/headers (cookie-based auth) which only works
 * inside a request scope, so client components must go through a server
 * action. This is the same pattern as revision-actions.ts.
 */

import { redirect } from "next/navigation";
import { globalSearch, isApiClientError, type GlobalSearchInput, type GlobalSearchResults } from "../api";

export async function runGlobalSearch(input: GlobalSearchInput): Promise<GlobalSearchResults> {
  try {
    return await globalSearch(input);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
    // Empty result on transient errors so the UI stays responsive.
    return { companies: [], rfqs: [], totals: { companies: 0, rfqs: 0 } };
  }
}
