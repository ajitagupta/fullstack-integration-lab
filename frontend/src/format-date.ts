// "2026-11-22" → "22 Nov 2026". Read as local midnight, so it never shifts to the day before.
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}