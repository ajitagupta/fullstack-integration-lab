import { useState } from "react";
import { SPORTS } from "../api/workout-types";
import { validateWorkout, toNewWorkout, type WorkoutFormValues, type FieldErrors } from "./validate-workout";
import { createWorkout } from "../api/workout-api";
import { ApiError, NetworkError } from "../api/api-error";
import { errorMessage } from "../api/error-message";
import {Link} from "react-router-dom";

const EMPTY: WorkoutFormValues = { sport: "", distance: "", duration: "" };

// API field name → form field name
const API_TO_FORM: Record<string, keyof WorkoutFormValues> = {
  sport: "sport",
  distance_km: "distance",
  duration_min: "duration",
};

export function WorkoutForm() {
  const [values, setValues] = useState<WorkoutFormValues>(EMPTY);
  const [submitted, setSubmitted] = useState(false);   // show errors only after the first submit
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

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
    const created = await createWorkout(toNewWorkout(values));
    setValues(EMPTY);
    setSubmitted(false);
    setSuccess(`Workout #${created.id} saved.`);
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
    <>
    <h1>Add workout</h1>
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="sport">Sport</label>
        <select
          id="sport"
          name="sport"
          value={values.sport}
          onChange={handleChange}
          aria-invalid={show("sport") ? true : undefined}
          aria-describedby={show("sport") ? "sport-error" : undefined}
        >
          <option value="">Choose a sport...</option>
          {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {show("sport") && <p id="sport-error" className="field-error">{show("sport")}</p>}
      </div>

      <div>
        <label htmlFor="distance">Distance (km)</label>
        <input
            type="number"
            step="any"
            min="0"
            placeholder="e.g. 5.2"
            id="distance"
            name="distance"
            value={values.distance}
            onChange={handleChange}
            aria-invalid={show("distance") ? true : undefined}
            aria-describedby={show("distance") ? "distance-error" : undefined}
        />
        {show("distance") && <p id="distance-error" className="field-error">{show("distance")}</p>}
       </div>            

       <div>
        <label htmlFor="duration">Duration (min)</label>
        <input
            type="number"
            step="1"
            min="0"
            placeholder="e.g. 33"
            id="duration"
            name="duration"
            value={values.duration}
            onChange={handleChange}
            aria-invalid={show("duration") ? true : undefined}
            aria-describedby={show("duration") ? "duration-error" : undefined}
        />
        {show("duration") && <p id="duration-error" className="field-error">{show("duration")}</p>}
        </div> 
        {formError && <p role="alert" className="field-error">{formError}</p>}
        {unconfirmed && (
          <p role="alert" className="field-error">
            We couldn't confirm the save. It may have gone through.{" "}
            <Link to="/workouts">Check your workouts</Link> before trying again.
          </p>
        )}
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Add workout"}</button>
      {success && <p role="status">{success}</p>}
    </form>
    </>
  );
}