import { expect, type Page } from "@playwright/test";
import { resolveTrainingMax } from "@/lib/programming/training-max";

export async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByTestId("password-input").fill("changeme");
  await page.getByTestId("signin-submit").click();
  await page.waitForURL("http://localhost:3000/", { timeout: 10_000 });
}

export async function setBenchOneRm(page: Page, oneRm: number) {
  await page.goto("/settings");
  await page.getByTestId("onerm-edit-bench_press").click();
  const input = page.getByTestId("onerm-bench_press");
  await input.fill("");
  await input.fill(String(oneRm));
  await page.getByTestId("onerm-save-bench_press").click();
  // Wait for the input to disappear (editing → false happens after the action completes)
  await expect(input).toBeHidden({ timeout: 10_000 });
  // Verify TM displayed on lifts page
  const expectedTm = resolveTrainingMax(oneRm);
  await page.goto("/lifts?l=bench_press");
  await expect(page.getByTestId("current-tm")).toHaveText(String(expectedTm), { timeout: 10_000 });
}
