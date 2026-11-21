import { useState } from "react";
import { Link } from "react-router-dom";
import { importText, previewText, type ImportResult } from "./api/workout-api";
import type { UploadPreview } from "./api/workout-types";
import { NetworkError } from "./api/api-error";
import { errorMessage } from "./api/error-message";
import { PreviewTable, workoutCount } from "./import/PreviewTable";

const EXAMPLES = ["ran 5 km in 30 min", "swam 1.5 km 40 min", "cycled 25 km in 60 min", "badminton 90 min"];

function QuickAddPage() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function changeText(value: string) {
    setText(value);
    setPreview(null);          // the old preview no longer matches the text
    setResult(null);
    setError(null);
  }

  function addExample(example: string) {
    changeText(text.trim() === "" ? example : `${text.trimEnd()}\n${example}`);
  }

  async function handleCheck() {
    setBusy(true);
    setError(null);
    try {
      setPreview(await previewText(text));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      setResult(await importText(text));
      setPreview(null);
      setText("");
    } catch (err) {
      setError(err instanceof NetworkError
        ? "We couldn't confirm the save. Check your workouts before saving again."
        : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const newRows = preview ? preview.valid - preview.duplicates : 0;
  const canSave = preview !== null && preview.invalid === 0 && newRows > 0 && !busy;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <h1 className="page-title mb-1">Quick add</h1>
        <p className="text-muted mb-4">
          Write your workouts the way you'd note them down, one per line. Check them, then save.
        </p>

        <div className="card shadow-sm mb-4">
          <div className="card-body p-4">
            <label htmlFor="quick-text" className="form-label fw-semibold">Your workouts</label>
            <textarea
              id="quick-text"
              rows={5}
              className="form-control font-monospace mb-3"
              placeholder={"ran 5 km in 30 min\nbadminton 90 min"}
              value={text}
              onChange={(e) => changeText(e.target.value)}
            />

            <div className="mb-3">
              <span className="text-muted small me-2">Try:</span>
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="btn btn-sm btn-light border rounded-pill me-2 mb-2"
                  onClick={() => addExample(example)}
                >
                  + {example}
                </button>
              ))}
            </div>

            <button className="btn btn-outline-primary" onClick={handleCheck} disabled={busy || text.trim() === ""}>
              {busy && !preview && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              Check
            </button>
          </div>
        </div>

        {error && <div role="alert" className="alert alert-danger">{error}</div>}

        {preview && (
          <div className="card shadow-sm mb-4">
            <div className="card-body p-4">
              <p role="status" className="mb-3">
                <strong>{newRows} new</strong>
                {preview.duplicates > 0 && `, ${preview.duplicates} already saved (will be skipped)`}
                {preview.invalid > 0 && (
                  <span className="text-danger">, {preview.invalid} not understood. Change those lines and check again</span>
                )}
                .
              </p>
              <PreviewTable rows={preview.rows} />
              <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
                {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
                {busy ? "Saving…" : `Save ${workoutCount(newRows)}`}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div role="status" className="alert alert-success">
            Saved {workoutCount(result.inserted)}
            {result.skipped > 0 && `, skipped ${result.skipped} already saved`}.{" "}
            <Link to="/workouts" className="alert-link">See your workouts</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuickAddPage;