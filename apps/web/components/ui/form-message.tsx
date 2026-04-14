import type { ActionResult } from "../../lib/action-result";

type FormMessageProps = {
  state: ActionResult;
  fieldName?: string;
};

/**
 * Inline form feedback component.
 *
 * Without `fieldName`: renders the top-level status banner (success/error).
 * With `fieldName`: renders per-field error text below the input.
 */
export function FormMessage({ state, fieldName }: FormMessageProps) {
  if (fieldName) {
    const fieldError = state.fieldErrors?.[fieldName];
    if (!fieldError) return null;
    return <p role="alert" className="text-xs text-danger mt-1">{fieldError}</p>;
  }

  if (state.status === "idle" || !state.message) return null;

  return (
    <div
      role="alert"
      className={`mb-4 rounded-lg border px-3 py-2 text-sm font-semibold ${
        state.status === "success"
          ? "border-success/30 bg-success/5 text-success"
          : "border-danger/30 bg-danger/5 text-danger"
      }`}
    >
      {state.message}
    </div>
  );
}
