import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import { signIn } from "./helpers";

// Regression: logged sets used to live only in a localStorage buffer until
// "Review & submit", and any page render hard-deleted a >3h-old session with no
// server-side sets — so a workout submitted late (or after the PWA's storage was
// evicted) vanished. Sets must reach the server as they're logged, and a stale
// session must be resumable, not deleted.

const psql = (q: string) =>
  execSync(
    `docker exec benchpilot-postgres-1 psql -U benchpilot -d ${process.env.E2E_DB ?? "benchpilot"} -tAc "${q}"`,
  )
    .toString()
    .trim();

// Each test starts from no open workout (test DB only).
test.beforeEach(() => {
  psql("delete from workout_sessions where completed_at is null");
});

test("logged sets persist server-side and survive a late return", async ({ page }) => {
  await signIn(page);
  await page.goto("/program");
  await page.locator('text="U-A"').first().click();
  await page.getByTestId("start-active").click();

  for (let i = 0; i < 3; i++) {
    await page.getByTestId("log-set").click();
    await page.waitForTimeout(300);
  }
  const sessionId = psql(
    "select id from workout_sessions where completed_at is null order by started_at desc limit 1",
  );
  await expect
    .poll(() => psql(`select count(*) from workout_sets where session_id='${sessionId}'`))
    .toBe("3");

  // Come back four hours later, local buffer gone.
  psql(`update workout_sessions set started_at = now() - interval '4 hours' where id='${sessionId}'`);
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByTestId("resume-workout-banner")).toContainText("3 sets");

  await page.getByTestId("resume-workout").click();
  await expect(page.locator("text=Set 4 of 5")).toBeVisible();
  expect(psql(`select count(*) from workout_sessions where id='${sessionId}'`)).toBe("1");
});

test("an old abandoned session is not revived when its day is reopened", async ({ page }) => {
  await signIn(page);
  await page.goto("/program");
  await page.locator('text="U-A"').first().click();
  await page.getByTestId("start-active").click();
  await page.getByTestId("log-set").click();
  const oldId = psql(
    "select id from workout_sessions where completed_at is null order by started_at desc limit 1",
  );
  await expect
    .poll(() => psql(`select count(*) from workout_sets where session_id='${oldId}'`))
    .toBe("1");
  psql(
    `update workout_sessions set status='abandoned', started_at = now() - interval '3 days' where id='${oldId}'`,
  );
  await page.evaluate(() => localStorage.clear());

  await page.goto("/program");
  await page.locator('text="U-A"').first().click();
  await page.getByTestId("start-active").click();
  await expect(page.locator("text=Set 1 of 5")).toBeVisible();
  const newId = psql(
    "select id from workout_sessions where completed_at is null order by started_at desc limit 1",
  );
  expect(newId).not.toBe(oldId);
  // The abandoned session and its set are kept, untouched.
  expect(psql(`select status from workout_sessions where id='${oldId}'`)).toBe("abandoned");
  expect(psql(`select count(*) from workout_sets where session_id='${oldId}'`)).toBe("1");
});
