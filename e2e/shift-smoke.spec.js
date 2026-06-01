import { expect, test } from "@playwright/test";

test("starts a shift and opens an incident task", async ({ page }) => {
  await page.goto("/?test=1");

  await page.getByRole("button", { name: "Start Shift" }).click();
  await expect(page.locator("#objective-compass")).toBeVisible();
  await expect(page.locator("#ticket-count")).toHaveText("4");

  const movedToTarget = await page.evaluate(() => window.__simTest.moveToTicket("pdu-load"));
  expect(movedToTarget).toBe(true);

  await page.keyboard.press("KeyE");
  await expect(page.locator("#task-modal")).toBeVisible();
  await expect(page.getByRole("heading", { name: "PDU branch load imbalance" })).toBeVisible();
});
