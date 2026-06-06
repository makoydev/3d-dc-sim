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

  const openSnapshot = await page.evaluate(() => window.__simTest.snapshot());
  const pduDisplay = openSnapshot.displayChoices.find((ticket) => ticket.id === "pdu-load");
  const pduProcedureOrder = pduDisplay.choices
    .filter((choice) => choice.kind === "procedure")
    .map((choice) => choice.index);
  expect(pduDisplay.variant).toBeTruthy();
  expect(pduDisplay.distractors).toHaveLength(1);
  expect(pduProcedureOrder).not.toEqual([0, 1, 2]);
  const visibleActions = await page.locator("#task-actions .task-action").evaluateAll((buttons) =>
    buttons.map((button) => button.textContent.trim()),
  );
  expect(visibleActions).toEqual(pduDisplay.choices.map((choice) => choice.label));

  const beforeWrongStep = await page.evaluate(() => window.__simTest.snapshot());
  const attemptedWrongStep = await page.evaluate(() => window.__simTest.attemptStep("pdu-load", 2));
  expect(attemptedWrongStep).toBe(true);
  await expect(page.locator(".procedure-alert")).toContainText("Procedure sequence mismatch");
  await expect(page.locator(".task-action.error")).toContainText(pduDisplay.actions[2]);
  await expect(page.locator("#journal-entries")).toContainText("Procedure error");
  await expect(page.locator("#journal-entries")).toContainText("attempted before");
  const afterWrongStep = await page.evaluate(() => window.__simTest.snapshot());
  expect(afterWrongStep.health).toBeLessThan(beforeWrongStep.health - 4);
  expect(afterWrongStep.procedureErrors.find((ticket) => ticket.id === "pdu-load").errors).toBe(1);

  const attemptedDistractor = await page.evaluate(() => window.__simTest.attemptDistractor("pdu-load"));
  expect(attemptedDistractor).toBe(true);
  await expect(page.locator(".procedure-alert")).toContainText("Unsafe response choice");
  await expect(page.locator(".task-action.error")).toContainText(pduDisplay.distractors[0]);

  const attemptedCorrectStep = await page.evaluate(() => window.__simTest.attemptStep("pdu-load", 0));
  expect(attemptedCorrectStep).toBe(true);
  await expect(page.locator("#journal-entries")).toContainText(pduDisplay.actions[0]);

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
