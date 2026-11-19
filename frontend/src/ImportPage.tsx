import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { previewUpload, uploadWorkouts } from "./api/workout-api";
import type { UploadPreview } from "./api/workout-types";
import { ApiError, NetworkError, RequestCancelledError } from "./api/api-error";
import { errorMessage } from "./api/error-message";

const MAX_BYTES = 1024 * 1024;

function fileProblemOf(file: File | null): string | null {
  if (file === null) return null;
  if (!file.name.toLowerCase().endsWith(".csv")) return "Only .csv files are accepted.";
  if (file.size > MAX_BYTES) return "The file is larger than 1 MB.";
  return null;
}

function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inserted, setInserted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileProblem = fileProblemOf(file);

  // A new file → ask the server for a preview. Same pattern as the list: abort if the file changes.
  useEffect(() => {
    if (file === null || fileProblemOf(file) !== null) return;
    const controller = new AbortController();
    setChecking(true);
    previewUpload(file, controller.signal)
      .then((result) => setPreview(result))
      .catch((err) => {
        if (err instanceof RequestCancelledError) return;
        setError(errorMessage(err));
      })
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, [file]);

  function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setPreview(null);
    setInserted(null);
    setError(null);
  }

  async function handleImport() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setInserted(await uploadWorkouts(file));
      setPreview(null);
    } catch (err) {
      if (err instanceof NetworkError) {
        setError("We couldn't confirm the import. Check your workouts before uploading again.");
      } else if (err instanceof ApiError) {
        setError("The file changed or is no longer valid. Choose it again to see a new preview.");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setUploading(false);
    }
  }

  const canImport = preview !== null && preview.invalid === 0 && !uploading;

  return (
    <>
      <h1>Import workouts</h1>
      <p>A CSV file with the columns <code>sport</code>, <code>distance_km</code>, <code>duration_min</code>. Up to 1,000 rows, 1 MB.</p>

      <label htmlFor="csv-file">CSV file</label>
      <input id="csv-file" type="file" accept=".csv,text/csv" onChange={chooseFile} />

      {fileProblem && <p role="alert">{fileProblem}</p>}
      {error && <p role="alert">{error}</p>}
      {checking && <p role="status">Checking the file…</p>}

      {preview && (
        <>
          <p role="status">
            {preview.valid} rows ready{preview.invalid > 0 && `, ${preview.invalid} with errors. Fix them in the file and choose it again`}.
          </p>
          <table>
            <thead>
              <tr><th>Row</th><th>Sport</th><th>Distance</th><th>Duration</th><th>Status</th></tr>
            </thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.row} className={r.error ? "row-invalid" : undefined}>
                  <td>{r.row}</td>
                  <td>{r.sport ?? "—"}</td>
                  <td>{r.distance_km ?? "—"}</td>
                  <td>{r.duration_min ?? "—"}</td>
                  <td>{r.error ? `${r.error.field}: ${r.error.error}` : "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={handleImport} disabled={!canImport}>
            {uploading ? "Importing…" : `Import ${preview.valid} workouts`}
          </button>
        </>
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