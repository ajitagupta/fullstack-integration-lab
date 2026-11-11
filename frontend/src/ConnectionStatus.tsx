import { useEffect, useState } from 'react';
import { checkConnection } from './api/workout-api';

function ConnectionStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);   // null = not checked yet

  useEffect(() => {
    checkConnection().then((ok) => setConnected(ok));          // check immediately

    const intervalId = setInterval(() => {
      checkConnection().then((ok) => setConnected(ok));        // and then every 10 s
    }, 10000);

    return () => clearInterval(intervalId);                    // cleanup
  }, []);

  if (connected === null) return <p>Checking API…</p>;
  return <p role="status">{connected ? "Connected" : "Not connected"}</p>;
}

export default ConnectionStatus;