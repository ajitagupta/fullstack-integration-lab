import { useState } from "react";
import { SPORTS } from "../api/workout-types";
import { validateWorkout, toNewWorkout, type WorkoutFormValues, type FieldErrors } from "./validate-workout";
import { createWorkout, updateWorkout } from "../api/workout-api";
import { ApiError, NetworkError } from "../api/api-error";
import { errorMessage } from "../api/error-message";
import {Link, useNavigate } from "react-router-dom";

const EMPTY: WorkoutFormValues = { sport: "", distance: "", duration: "" };

// API field name → form field name
const API_TO_FORM: Record<string, keyof WorkoutFormValues> = {
  sport: "sport",
  distance_km: "distance",
  duration_min: "duration",
};

type Props = {
  workoutId?: number;
  initialValues?: WorkoutFormValues;
};

export function WorkoutForm({ workoutId, initialValues = EMPTY }: Props) {
  const isEdit = workoutId !== undefined;
  const [values, setValues] = useState<WorkoutFormValues>(initialValues);
  const [submitted, setSubmitted] = useState(false);   // show errors only after the first submit
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  const navigate = useNavigate();         
  const errors = validateWorkout(values);              // recomputed on every render
  const show = (field: keyof WorkoutFormValues) =>
  submitted ? errors[field] ?? serverErrors[field] : undefined;
  // One handler for all fields: the input's `name` says which field to update
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setSuccess(null);
    setValues({ ...values, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (saving) return;                 // a second click while saving does nothing
  setSubmitted(true);
  setServerErrors({});
  setFormError(null);
  setSuccess(null);
  setUnconfirmed(false);
  if (Object.keys(errors).length > 0) return;

  setSaving(true);
  try {
    const payload = toNewWorkout(values);
    const created = isEdit
      ? await updateWorkout(workoutId, payload)
      : await createWorkout(payload);
    if (isEdit) {
      navigate(`/workouts/${created.id}`);
    } else {
      setValues(EMPTY);
      setSubmitted(false);
      setSuccess(`Workout #${created.id} saved.`);
  }

  } catch (err) {
    if (err instanceof ApiError) {
      const fields: FieldErrors = {};
      let general: string | null = null;
      for (const fieldError of err.errors) {                       
        const formField = fieldError.field ? API_TO_FORM[fieldError.field] : undefined;
        if (formField) {
          fields[formField] = fieldError.error;                    
        } else {
          general = fieldError.error;                              
        }
      }
      setServerErrors(fields);
      if (Object.keys(fields).length === 0) {                      
        setFormError(general ?? errorMessage(err));
      }
    } else if (err instanceof NetworkError) {
      setUnconfirmed(true)
    } else {
      setFormError(errorMessage(err));
    }
  } finally {
      setSaving(false);                 // runs after success AND after failure
  }
}

  return (
    <div className="row justify-content-center">
      <div className="col-lg-6">
        <h1 className="page-title mb-1">{isEdit ? "Edit workout" : "Add workout"}</h1>
        <p className="text-muted mb-4">Distance is needed for runs, rides and swims; duration for everything except rest days.</p>

        <form onSubmit={handleSubmit} noValidate className="card shadow-sm">
          <div className="card-body p-4">
            <div className="mb-3">
              <label htmlFor="sport" className="form-label">Sport</label>
              <select
                id="sport" name="sport" value={values.sport} onChange={handleChange}
                className={`form-select ${show("sport") ? "is-invalid" : ""}`}
                aria-invalid={show("sport") ? true : undefined}
                aria-describedby={show("sport") ? "sport-error" : undefined}
              >
                <option value="">Choose a sport…</option>
                {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {show("sport") && <div id="sport-error" className="invalid-feedback">{show("sport")}</div>}
            </div>

            <div className="row g-3 mb-3">
              <div className="col-sm-6">
              <label htmlFor="distance" className="form-label">Distance</label>
                <div className="input-group has-validation">
                  <input
                    type="number" step="any" min="0" placeholder="e.g. 5.2"
                    id="distance" name="distance" value={values.distance} onChange={handleChange}
                    className={`form-control ${show("distance") ? "is-invalid" : ""}`}
                    aria-invalid={show("distance") ? true : undefined}
                    aria-describedby={show("distance") ? "distance-error" : undefined}
                  />
                  <span className="input-group-text">km</span>
                  {show("distance") && <div id="distance-error" className="invalid-feedback">{show("distance")}</div>}
                </div>
              </div>
              <div className="col-sm-6">
                <label htmlFor="duration" className="form-label">Duration (min)</label>
                <div className="input-group has-validation">
                  <input
                    type="number" step="1" min="0" placeholder="e.g. 33"
                    id="duration" name="duration" value={values.duration} onChange={handleChange}
                    className={`form-control ${show("duration") ? "is-invalid" : ""}`}
                    aria-invalid={show("duration") ? true : undefined}
                    aria-describedby={show("duration") ? "duration-error" : undefined}
                  />
                  <span className="input-group-text">min</span>
                  {show("duration") && <div id="duration-error" className="invalid-feedback">{show("duration")}</div>}
                </div>
              </div>
            </div>

            {formError && <div role="alert" className="alert alert-danger">{formError}</div>}
            {unconfirmed && (
              <div role="alert" className="alert alert-warning">
                We couldn't confirm the save. It may have gone through.{" "}
                <Link to="/workouts" className="alert-link">Check your workouts</Link> before trying again.
              </div>
            )}
            {success && <div role="status" className="alert alert-success">{success}</div>}

            <button type="submit" className="btn btn-primary w-100" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add workout"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}