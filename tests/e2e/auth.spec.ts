import { expect, test } from "@playwright/test";

test("wrong password is blocked, right password reaches dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin/);

  await page.getByTestId("password-input").fill("WRONG");
  await page.getByTestId("signin-submit").click();
  await expect(page.getByTestId("auth-error")).toBeVisible();
  await expect(page).toHaveURL(/\/signin/);

  await page.getByTestId("password-input").fill("changeme");
  await page.getByTestId("signin-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 10_000 });
});
