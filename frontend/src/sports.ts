import type { Sport } from "./api/workout-types";

export const SPORT_COLORS: Record<Sport, string> = {
  run: "#0f766e", cycle: "#e8735a", swim: "#3b82f6",
  badminton: "#a855f7", strength: "#f59e0b", rest: "#94a3b8",
};

export const SPORT_ICONS: Record<Sport, string> = {
  run: "🏃", cycle: "🚴", swim: "🏊", badminton: "🏸", strength: "🏋️", rest: "😴",
};