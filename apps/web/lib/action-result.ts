export type ActionResult = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
};

export const IDLE_RESULT: ActionResult = { status: "idle", message: "" };
