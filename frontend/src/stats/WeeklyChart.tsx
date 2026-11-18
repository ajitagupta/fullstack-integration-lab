import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SPORTS, type Sport } from "../api/workout-types";
import type { WeekRow } from "./to-weekly-chart";

const COLORS: Record<Sport, string> = {
  run: "#0f766e", cycle: "#e8735a", swim: "#3b82f6",
  badminton: "#a855f7", strength: "#f59e0b", rest: "#94a3b8",
};

type Props = { data: WeekRow[]; unit: string };

export function WeeklyChart({ data, unit }: Props) {
  const sports = SPORTS.filter((s) => s !== "rest" && data.some((row) => row[s] !== undefined));   // only sports that appear

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" />
        <YAxis unit={` ${unit}`} width={70} />
        <Tooltip />
        <Legend />
        {sports.map((s) => (
          <Bar key={s} dataKey={s} stackId="week" fill={COLORS[s]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}