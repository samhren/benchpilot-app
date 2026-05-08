import { expect, test } from "@playwright/test";
import { signIn, setBenchOneRm } from "./helpers";

test("Block 1 Wk1 Mon: 5×5 @ 75% of 205 = 155 lb", async ({ page }) => {
  await signIn(page);
  await setBenchOneRm(page, 225); // → TM = 205

  await page.goto("/program");
  await page.locator('text="U-A"').first().click();
  await page.getByTestId("start-active").click();

  await expect(page.getByTestId("prescribed-weight")).toHaveText("155");

  // Log all 5 sets of bench
  for (let i = 0; i < 5; i++) {
    await page.getByTestId("log-set").click();
    // RestBanner appears between sets, doesn't block; brief settle
    await page.waitForTimeout(150);
  }

  // After bench finished, the prescribed weight changes (next exercise).
  // The bench section had 5 sets. Verify we've moved past bench by checking the first 5 logs went through.
  // Just ensure the prescribed-weight is no longer "155" or the exercise label changed.
  await expect(page.getByTestId("prescribed-weight")).not.toHaveText("155");
});
