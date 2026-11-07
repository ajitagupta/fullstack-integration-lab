import { test, expect } from '@playwright/test';

test('user can navigate from home to workouts', async ({ page }) => {
  await page.goto('/');                                    // open the app at baseURL

  await page.getByRole('link', { name: 'Workouts' }).click();  // click the nav link

  await expect(page).toHaveURL('/workouts');               // routing worked — URL changed
});

test('user can navigate to a workout detail page', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Workouts' }).click();
  await expect(page).toHaveURL('/workouts');

  await page.getByRole('link', { name: 'swim' }).click();   // adjust to your actual workout name

  await expect(page).toHaveURL('/workouts/1');              // adjust to that workout's id
  await expect(page.getByText('Workout #1')).toBeVisible(); // adjust to your detail page's text
});