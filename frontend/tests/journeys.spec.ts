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