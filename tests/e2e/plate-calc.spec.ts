import { expect, test } from "@playwright/test";
import { signIn, setBenchOneRm } from "./helpers";

test("plate calc at 215 lb shows 45 + 25 + 10 + 5 / side", async ({ page }) => {
  await signIn(page);
  // 1RM = 317 → TM = round(0.9·317 → 285.3) = 285. 75% × 285 = 213.75 → 215.
  await setBenchOneRm(page, 317);

  // Click the first U-A (Mon Wk1) chip from program
  await page.goto("/program");
  await page.locator('text="U-A"').first().click();
  await page.getByTestId("start-active").click();

  await expect(page.getByTestId("prescribed-weight")).toHaveText("215");
  await page.getByTestId("plate-chip").click();
  await expect(page.getByTestId("plate-summary")).toHaveText("45 + 25 + 10 + 5 / side");
});
