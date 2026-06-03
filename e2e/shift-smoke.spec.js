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

  await page.getByRole("button", { name: /Read A-feed and B-feed branch currents/ }).click();
  await expect(page.locator("#journal-entries time")).toHaveText(/^08:0[0-5]$/);
  await expect(page.locator("#journal-entries")).toContainText("Read A-feed and B-feed branch currents");

  const completed = await page.evaluate(() => window.__simTest.completeTicket("pdu-load"));
  expect(completed).toBe(true);
  const snapshot = await page.evaluate(() => window.__simTest.snapshot());
  expect(snapshot.cueLog).toContain("task-complete");
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
  expect(snapshot.state.journalEntries).toBe(0);
  expect(snapshot.state.minutes).toBeGreaterThanOrEqual(480);
  expect(snapshot.state.minutes).toBeLessThan(481.5);
  expect(snapshot.state.playerPosition).toEqual([0, 1.72, 13]);
});

test("difficulty presets change escalation timing", async ({ page }) => {
  await page.goto("/?test=1");

  await page.getByRole("button", { name: "Expert" }).click();
  await expect(page.getByRole("button", { name: "Expert" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Start Shift" }).click();

  await page.evaluate(() => window.__simTest.setElapsedMinutes(5));

  await expect(page.locator("#tickets")).toContainText("Degraded");
  await page.evaluate(() => window.__simTest.advanceIncidentsTo(8));

  await expect(page.locator("#tickets")).toContainText("Critical");
  const snapshot = await page.evaluate(() => window.__simTest.snapshot());
  expect(snapshot.difficulty).toBe("expert");
  expect(snapshot.cueLog).toContain("critical-escalation");
});
