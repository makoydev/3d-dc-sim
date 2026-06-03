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

test("restarts a completed shift without reloading the page", async ({ page }) => {
  await page.goto("/?test=1&autostart=1");
  await page.evaluate(() => {
    window.__restartSentinel = "same-page";
  });

  const finished = await page.evaluate(() => window.__simTest.finishShift());
  expect(finished).toBe(true);
  await expect(page.locator("#score-modal")).toBeVisible();

  await page.getByRole("button", { name: "Restart Shift" }).click();
  const snapshot = await page.evaluate(() => ({
    sentinel: window.__restartSentinel,
    state: window.__simTest.snapshot(),
  }));

  await expect(page.locator("#score-modal")).toBeHidden();
  await expect(page.locator("#ticket-count")).toHaveText("4");
  await expect(page.locator("#health")).toHaveText("100%");

  expect(snapshot.sentinel).toBe("same-page");
  expect(snapshot.state.finished).toBe(false);
  expect(snapshot.state.openTickets).toBe(4);
  expect(snapshot.state.minutes).toBeGreaterThanOrEqual(480);
  expect(snapshot.state.minutes).toBeLessThan(481.5);
  expect(snapshot.state.playerPosition).toEqual([0, 1.72, 13]);
});
