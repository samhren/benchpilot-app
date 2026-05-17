import { expect, test } from "@playwright/test";
import { signIn, setBenchOneRm } from "./helpers";

test("AMRAP +10 bump: 12 reps at 80% TM → TM 205 → 215", async ({ page }) => {
  await signIn(page);
  await setBenchOneRm(page, 225); // TM = 205

  // Navigate to Wk3 Fri (U-C, AMRAP day) via program
  await page.goto("/program");
  // Wk3 row → 3rd "U-C" - actually U-C is only on Fri. Pick the 3rd U-C row (Wk1, Wk2, Wk3).
  const ucChips = page.locator('text="U-C"');
  // Wk3 = index 2 (zero-based)
  await ucChips.nth(2).click();
  await page.getByTestId("start-active").click();

  // Should be AMRAP set at 80% × 205 = 164 → 165
  await expect(page.getByTestId("prescribed-weight")).toHaveText("165");

  // Set reps to 12 via stepper (start null → click +12)
  for (let i = 0; i < 12; i++) await page.getByTestId("reps-plus").click();
  await expect(page.getByTestId("reps-value")).toHaveText("12");

  await page.getByTestId("log-set").click();

  // AMRAP bump modal
  await expect(page.getByTestId("amrap-bump-modal")).toBeVisible();
  await expect(page.getByTestId("bump-pill")).toContainText("+10");
  await expect(page.getByTestId("new-tm")).toHaveText("215");

  await page.getByTestId("apply-bump").click();
  // Wait for the toast confirmation that bump applied
  await expect(page.getByText(/Bench TM → 215 lb/)).toBeVisible({ timeout: 10_000 });

  // Verify TM updated on the settings page
  await page.goto("/settings");
  await expect(page.getByTestId("tm-bench_press")).toHaveText("215", { timeout: 10_000 });
});

test("AMRAP hold: 6 reps → no bump, TM stays 205", async ({ page }) => {
  await signIn(page);
  // Reset to 1RM=225 so TM goes back to 205. setBenchOneRm overwrites both.
  await setBenchOneRm(page, 225);

  await page.goto("/program");
  // Pick another U-C — Wk1 since previous test may have completed Wk3.
  const ucChips = page.locator('text="U-C"');
  await ucChips.first().click();
  await page.getByTestId("start-active").click();

  for (let i = 0; i < 6; i++) await page.getByTestId("reps-plus").click();
  await page.getByTestId("log-set").click();

  await expect(page.getByTestId("amrap-bump-modal")).toBeVisible();
  await expect(page.getByTestId("bump-pill")).toContainText("Hold");
  await page.getByTestId("apply-bump").click();
  // Wait for toast confirming TM held (no bump)
  await expect(page.getByText(/TM held/)).toBeVisible({ timeout: 10_000 });

  await page.goto("/settings");
  await expect(page.getByTestId("tm-bench_press")).toHaveText("205", { timeout: 10_000 });
});
