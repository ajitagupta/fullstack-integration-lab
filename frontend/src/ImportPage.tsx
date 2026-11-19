import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { uploadWorkouts } from "./api/workout-api";
import { ApiError, NetworkError } from "./api/api-error";
import { errorMessage } from "./api/error-message";


const MAX_BYTES = 1024 * 1024;   // the same 1 MB limit as the server

function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [inserted, setInserted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<{ row?: number; field?: string; error: string }[]>([]);

  function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    setFile(chosen);
    setInserted(null);
    setRowErrors([]);
    setError(null);
    if (chosen && !chosen.name.toLowerCase().endsWith(".csv")) setError("Only .csv files are accepted.");
    else if (chosen && chosen.size > MAX_BYTES) setError("The file is larger than 1 MB.");
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setRowErrors([]);
    try {
      setInserted(await uploadWorkouts(file));
    } catch (err) {
      if (err instanceof ApiError && err.errors.some((e) => e.row !== undefined)) {
        setRowErrors(err.errors);
        setError("Nothing was imported. Fix these rows and upload again:");
      } else if (err instanceof NetworkError) {
        setError("We couldn't confirm the import. Check your workouts before uploading again.");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setUploading(false);
    }
  }

  const fileProblem = file !== null && (!file.name.toLowerCase().endsWith(".csv") || file.size > MAX_BYTES);

  return (
    <>
      <h1>Import workouts</h1>
      <p>A CSV file with the columns <code>sport</code>, <code>distance_km</code>, <code>duration_min</code>. Up to 1,000 rows, 1 MB.</p>

      <label htmlFor="csv-file">CSV file</label>
      <input id="csv-file" type="file" accept=".csv,text/csv" onChange={chooseFile} />
      <button onClick={handleUpload} disabled={!file || fileProblem || uploading}>
        {uploading ? "Importing…" : "Import"}
      </button>

      {error && (
        <div role="alert">
          <p>{error}</p>
          {rowErrors.length > 0 && (
            <ul>
              {rowErrors.map((e, i) => (
                <li key={i}>Row {e.row}{e.field && ` · ${e.field}`}: {e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {inserted !== null && (
        <p role="status">
          Imported {inserted} workouts. <Link to="/workouts">See your workouts</Link>
        </p>
      )}
    </>
  );
}

export default ImportPage;