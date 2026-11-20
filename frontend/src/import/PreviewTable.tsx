import type { PreviewRow } from "../api/workout-types";


export function workoutCount(n: number) {
  return n === 1 ? "1 workout" : `${n} workouts`;
}

export function PreviewTable({ rows }: { rows: PreviewRow[] }) {
  return (
          <table>
            <thead>
              <tr><th>Row</th><th>Sport</th><th>Distance</th><th>Duration</th><th>Date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row} className={r.error ? "row-invalid" : undefined}>
                  <td>{r.row}</td>
                  <td>{r.sport ?? "—"}</td>
                  <td>{r.distance_km ?? "—"}</td>
                  <td>{r.duration_min ?? "—"}</td>
                  <td>{r.performed_on ?? "today"}</td>
                  <td>{r.error ? `${r.error.field}: ${r.error.error}` : r.duplicate ? "Already imported" : "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
      );
}