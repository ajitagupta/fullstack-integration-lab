import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { previewUpload, uploadWorkouts, type ImportResult } from "./api/workout-api";
import type { UploadPreview } from "./api/workout-types";
import { ApiError, NetworkError, RequestCancelledError } from "./api/api-error";
import { errorMessage } from "./api/error-message";
import { PreviewTable, workoutCount } from "./import/PreviewTable";

const MAX_BYTES = 1024 * 1024;
const ACCEPTED = [".csv", ".gpx", ".fit"];

function fileProblemOf(file: File | null): string | null {
  if (file === null) return null;
  if (!ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext))) return `Accepted file types: ${ACCEPTED.join(", ")}.`;
  if (file.size > MAX_BYTES) return "The file is larger than 1 MB.";
  return null;
}

function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
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
    setResult(null);
    setError(null);
  }

  async function handleImport() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setResult(await uploadWorkouts(file));
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

  const newRows = preview ? preview.valid - preview.duplicates : 0;
  const canImport = preview !== null && preview.invalid === 0 && newRows > 0 && !uploading;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <h1 className="page-title mb-1">Import workouts</h1>
        <p className="text-muted mb-4">
          From your watch or another app: <strong>GPX</strong> and <strong>FIT</strong> files from Garmin or Strava,
          Strava's <code>activities.csv</code> export, or your own CSV with <code>sport</code>, <code>distance_km</code>,{" "}
          <code>duration_min</code> and optionally <code>performed_on</code>. Up to 1,000 rows, 1 MB.
        </p>

        <div className="card shadow-sm mb-4">
          <div className="card-body p-4">
            <label htmlFor="csv-file" className="form-label fw-semibold">Choose a file</label>
            <input
              id="csv-file"
              type="file"
              accept={ACCEPTED.join(",")}
              onChange={chooseFile}
              className={`form-control ${fileProblem ? "is-invalid" : ""}`}
            />
            {fileProblem && <div role="alert" className="invalid-feedback">{fileProblem}</div>}
            {checking && (
              <div role="status" className="text-muted small mt-2">
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                Checking the file…
              </div>
            )}
          </div>
        </div>

        {error && <div role="alert" className="alert alert-danger">{error}</div>}

        {preview && (
          <div className="card shadow-sm mb-4">
            <div className="card-body p-4">
              <p role="status" className="mb-3">
                <strong>{newRows} new</strong>
                {preview.duplicates > 0 && `, ${preview.duplicates} already imported (will be skipped)`}
                {preview.invalid > 0 && (
                  <span className="text-danger">, {preview.invalid} with errors. Fix them in the file and choose it again</span>
                )}
                .
              </p>
              <PreviewTable rows={preview.rows} />
              <button className="btn btn-primary" onClick={handleImport} disabled={!canImport}>
                {uploading && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
                {uploading ? "Importing…" : `Import ${workoutCount(newRows)}`}
              </button>
            </div>
          </div>
        )}

        {result !== null && (
          <div role="status" className="alert alert-success">
            Imported {workoutCount(result.inserted)}
            {result.skipped > 0 && `, skipped ${result.skipped} already imported`}.{" "}
            <Link to="/workouts" className="alert-link">See your workouts</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportPage;