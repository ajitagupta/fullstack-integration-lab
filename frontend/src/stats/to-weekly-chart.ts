import type { Sport, WeeklyStat } from "../api/workout-types";

// One object per week; one key per sport that has a value that week
export type WeekRow = { week: string } & Partial<Record<Sport, number>>;

export type Metric = "distance_km" | "duration_min";

export function toWeeklyChart(stats: WeeklyStat[], metric: Metric): WeekRow[] {
  const byWeek = new Map<string, WeekRow>();

  for (const stat of stats) {
    const row = byWeek.get(stat.week_start) ?? { week: stat.week_start };   // existing week, or a new one
    row[stat.sport] = stat[metric];                                         // e.g. row.run = 15
    byWeek.set(stat.week_start, row);
  }

  return [...byWeek.values()];
}