import { useState } from "react";
import { Link } from "react-router-dom";
import { importText, previewText, type ImportResult } from "./api/workout-api";
import type { UploadPreview } from "./api/workout-types";
import { NetworkError } from "./api/api-error";
import { errorMessage } from "./api/error-message";
import { PreviewTable, workoutCount } from "./import/PreviewTable";

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
    <>
      <h1>Quick add</h1>
      <p>One workout per line, e.g. <em>ran 5 km in 30 min</em> or <em>badminton 90 min</em>.</p>

      <label htmlFor="quick-text">Workouts</label>
      <textarea id="quick-text" rows={5} value={text} onChange={(e) => changeText(e.target.value)} />

      <button onClick={handleCheck} disabled={busy || text.trim() === ""}>Check</button>

      {error && <p role="alert">{error}</p>}

      {preview && (
        <>
          <PreviewTable rows={preview.rows} />
          <button onClick={handleSave} disabled={!canSave}>
            {busy ? "Saving…" : `Save ${workoutCount(newRows)}`}
          </button>
        </>
      )}

      {result && (
        <p role="status">
          Saved {workoutCount(result.inserted)}
          {result.skipped > 0 && `, skipped ${result.skipped} already saved`}.{" "}
          <Link to="/workouts">See your workouts</Link>
        </p>
      )}
    </>
  );
}

export default QuickAddPage;