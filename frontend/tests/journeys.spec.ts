import { test, expect } from "@playwright/test";

test("the navbar leads to the workouts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Workouts", exact: true }).click();
  await expect(page).toHaveURL("/workouts");
  await expect(page.getByRole("heading", { name: "Workouts" })).toBeVisible();
});

test("add, view, edit and delete a workout", async ({ page }) => {
  // 1. Add it through the form, with distinctive values
  await page.goto("/workouts/new");
  await page.getByLabel("Sport").selectOption("swim");
  await page.getByLabel("Distance (km)").fill("1.23");
  await page.getByLabel("Duration (min)").fill("41");
  await page.getByRole("button", { name: "Add workout" }).click();

  // The success message names the new ID: "Workout #57 saved."
  const saved = page.getByRole("status").filter({ hasText: "saved" });
  await expect(saved).toBeVisible();
  const id = (await saved.textContent())!.match(/#(\d+)/)![1];

  // 2. Its details page shows what we entered
  await page.goto(`/workouts/${id}`);
  await expect(page.getByRole("heading", { name: "swim" })).toBeVisible();
  await expect(page.getByText("1.23")).toBeVisible();
  await expect(page.getByText("41", { exact: true })).toBeVisible();

  // 3. Edit the duration
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Duration (min)").fill("45");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(`/workouts/${id}`);
  await expect(page.getByText("45", { exact: true })).toBeVisible();

  // 4. Delete it, which is also the clean-up
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page).toHaveURL("/workouts");

  // 5. It's really gone
  await page.goto(`/workouts/${id}`);
  await expect(page.getByRole("alert")).toContainText("not found");
});

test("quick add: typed text is checked by the API", async ({ page }) => {
  await page.goto("/quick-add");
  await page.getByRole("textbox").fill("swam 1.5 km 40 min");
  await page.getByRole("button", { name: "Check" }).click();

  // The API parsed it, and the preview table shows the row
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("table")).toContainText("swim");
  await expect(page.getByRole("table")).toContainText("1.5");
});

test("import: a CSV file is previewed before anything is saved", async ({ page }) => {
  await page.goto("/import");

  // A file made in memory, so the test needs no file on disk
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sport,distance_km,duration_min\nrun,7.77,42\n"),
  });

  const table = page.getByRole("table");
  await expect(table).toContainText("run");
  await expect(table).toContainText("7.77");
});

test("when the API is down, the user is told so", async ({ page }) => {
  // Every request to the API fails, as if the server were off
  await page.route("http://localhost:5000/**", (route) => route.abort());

  await page.goto("/workouts");
  await expect(page.getByText("API unreachable")).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible();
});