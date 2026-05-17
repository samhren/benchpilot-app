import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("setting bench 1RM = 225 stores TM = 205 (round of 202.5)", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  await page.getByTestId("onerm-edit-bench_press").click();
  await page.getByTestId("onerm-bench_press").fill("225");
  await page.getByTestId("onerm-save-bench_press").click();

  await expect(page.getByTestId("tm-bench_press")).toHaveText("205", { timeout: 10_000 });
});
