import { expect, test } from "@playwright/test";
import { signIn, setBenchOneRm } from "./helpers";

test("Mon heavy bench shows pause chip", async ({ page }) => {
  await signIn(page);
  await setBenchOneRm(page, 225);

  await page.goto("/program");
  await page.locator('text="U-A"').first().click();
  await page.getByTestId("start-active").click();

  const chip = page.getByTestId("tempo-chip");
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("data-tempo", "pause_1s");
  await expect(chip).toContainText("PAUSE 1s every rep");
});

test("Wed wave shows mixed tempo across sets", async ({ page }) => {
  await signIn(page);
  await setBenchOneRm(page, 225);

  await page.goto("/program");
  await page.locator('text="U-B"').first().click();
  await page.getByTestId("start-active").click();

  // First wave step should be touch_and_go (50% / 60% / 70%)
  const chip = page.getByTestId("tempo-chip");
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("data-tempo", "touch_and_go");

  // Advance through sets until we land on the 80%+ paused set.
  let sawPause = false;
  for (let i = 0; i < 12 && !sawPause; i++) {
    await page.getByTestId("log-set").click();
    await page.waitForTimeout(120);
    const tempo = await page.getByTestId("tempo-chip").getAttribute("data-tempo").catch(() => null);
    if (tempo === "pause_1s") sawPause = true;
  }
  expect(sawPause).toBe(true);
});

test("Fri AMRAP set shows mixed-rep tempo chip", async ({ page }) => {
  await signIn(page);
  await setBenchOneRm(page, 225);

  await page.goto("/program");
  await page.locator('text="U-C"').first().click();
  await page.getByTestId("start-active").click();

  const chip = page.getByTestId("tempo-chip");
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("data-tempo", "pause_1s_first_rep");
  await expect(chip).toContainText("PAUSE rep 1");
});

test("Tempo info sheet opens on chip tap", async ({ page }) => {
  await signIn(page);
  await setBenchOneRm(page, 225);

  await page.goto("/program");
  await page.locator('text="U-A"').first().click();
  await page.getByTestId("start-active").click();

  await page.getByTestId("tempo-chip").click();
  const sheet = page.getByTestId("tempo-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Wilson");
});

test("Settings toggle hides chips on bench sets", async ({ page }) => {
  await signIn(page);
  await setBenchOneRm(page, 225);

  await page.goto("/settings");
  const toggle = page.getByTestId("tempo-toggle");
  await expect(toggle).toHaveAttribute("data-on", "1");
  await toggle.click();
  await expect(toggle).toHaveAttribute("data-on", "0");

  await page.goto("/program");
  await page.locator('text="U-A"').first().click();
  await page.getByTestId("start-active").click();

  await expect(page.getByTestId("tempo-chip")).toHaveCount(0);

  // Restore for other tests
  await page.goto("/settings");
  await page.getByTestId("tempo-toggle").click();
});
