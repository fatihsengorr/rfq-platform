export type DeadlineUrgency = "overdue" | "critical" | "warning" | "ok";

export function getDeadlineUrgency(deadline: string): DeadlineUrgency {
  const diffMs = new Date(deadline).getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs <= 0) return "overdue";
  if (diffHours <= 24) return "critical";
  if (diffHours <= 72) return "warning";
  return "ok";
}

export function getDeadlineLabel(deadline: string): string {
  const diffMs = new Date(deadline).getTime() - Date.now();

  if (diffMs <= 0) {
    const days = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    return days === 1 ? "1 day overdue" : `${days}d overdue`;
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days === 0) return `${hours}h left`;
  return `${days}d ${hours}h left`;
}
