import { useEffect, useState } from 'react';
import { checkConnection } from './api/workout-api';

function ConnectionStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);   // null = not checked yet

  useEffect(() => {
    checkConnection().then((ok) => setConnected(ok));
  }, []);

  if (connected === null) return <p>Checking API…</p>;
  return <p role="status">{connected ? "Connected" : "Not connected"}</p>;
}

export default ConnectionStatus;