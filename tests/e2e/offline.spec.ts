import { expect, test } from "@playwright/test";
import { signIn, setBenchOneRm } from "./helpers";

test("offline: log queues, comes back online and we can navigate", async ({ page, context }) => {
  await signIn(page);
  await setBenchOneRm(page, 225);

  await page.goto("/program");
  await page.locator('text="U-A"').first().click();
  await page.getByTestId("start-active").click();
  await expect(page.getByTestId("prescribed-weight")).toBeVisible();

  // Go offline
  await context.setOffline(true);
  await page.getByTestId("log-set").click();
  // Toast says "Queued offline"
  await expect(page.getByText(/Queued offline/)).toBeVisible({ timeout: 5_000 });

  // Verify queue has at least 1 entry
  const queueLen = await page.evaluate(async () => {
    const dbReq = indexedDB.open("benchpilot-offline");
    return await new Promise<number>((res) => {
      dbReq.onsuccess = () => {
        const db = dbReq.result;
        const tx = db.transaction("queue", "readonly");
        const req = tx.objectStore("queue").count();
        req.onsuccess = () => res(req.result);
      };
    });
  });
  expect(queueLen).toBeGreaterThanOrEqual(1);

  // Restore online
  await context.setOffline(false);
});
