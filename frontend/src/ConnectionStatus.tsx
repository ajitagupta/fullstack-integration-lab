import { useEffect, useState } from "react";
import { checkReadiness, type Readiness } from "./api/workout-api";

const DISPLAY: Record<Readiness, { text: string; badge: string }> = {
  ready: { text: "Connected", badge: "text-bg-success" },
  "database-down": { text: "Database unavailable", badge: "text-bg-warning" },
  offline: { text: "API unreachable (it may be waking up)", badge: "text-bg-danger" },
};

function ConnectionStatus() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);   // null = not checked yet

  useEffect(() => {
    checkReadiness().then(setReadiness);                                 // check immediately
    const intervalId = setInterval(() => checkReadiness().then(setReadiness), 10000);   // then every 10 s
    return () => clearInterval(intervalId);
  }, []);

  if (readiness === null) {
    return <span className="badge text-bg-secondary">Checking API…</span>;
  }
  const { text, badge } = DISPLAY[readiness];
  return <span role="status" className={`badge ${badge}`}>{text}</span>;
}

export default ConnectionStatus;