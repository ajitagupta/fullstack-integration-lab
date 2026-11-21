import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SPORTS } from "../api/workout-types";
import type { WeekRow } from "./to-weekly-chart";
import { SPORT_COLORS } from "../sports";

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
          <Bar key={s} dataKey={s} stackId="week" fill={SPORT_COLORS[s]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}