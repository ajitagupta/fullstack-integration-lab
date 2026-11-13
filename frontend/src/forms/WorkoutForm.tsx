import { useState } from "react";
import { SPORTS } from "../api/workout-types";
import { validateWorkout, type WorkoutFormValues } from "./validate-workout";

const EMPTY: WorkoutFormValues = { sport: "", distance: "", duration: "" };

export function WorkoutForm() {
  const [values, setValues] = useState<WorkoutFormValues>(EMPTY);
  const [submitted, setSubmitted] = useState(false);   // show errors only after the first submit

  const errors = validateWorkout(values);              // recomputed on every render
  const show = (field: keyof WorkoutFormValues) => submitted ? errors[field] : undefined;

  // One handler for all fields: the input's `name` says which field to update
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setValues({ ...values, [e.target.name]: e.target.value });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;        // invalid → stay, errors now visible
    console.log("Valid workout:", values);             // 05.2: createWorkout(...)
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

      <button type="submit">Add workout</button>
    </form>
    </>
  );
}