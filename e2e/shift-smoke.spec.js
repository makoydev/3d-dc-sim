import { expect, test } from "@playwright/test";

async function expectDomText(page, selector, expected) {
  await expect
    .poll(async () => {
      try {
        return await page.locator(selector).first().evaluate((element) => element.textContent ?? "");
      } catch {
        return "";
      }
    })
    .toContain(expected);
}

test("starts a shift and opens an incident task", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/?test=1");

  await page.getByRole("button", { name: "Start Shift" }).click();
  await expect(page.locator("#objective-compass")).toBeVisible();
  await expect(page.locator("#floor-map")).toBeVisible();
  await expect(page.locator("#floor-map-points > div")).toHaveCount(5);
  await expect(page.locator("#ticket-count")).toHaveText("4");
  await expect(page.locator("#tickets .ticket").first()).toContainText("Degraded in 6 min");

  const movedToTarget = await page.evaluate(() => window.__simTest.moveToTicket("pdu-load"));
  expect(movedToTarget).toBe(true);

  await page.keyboard.press("KeyE");
  await expect(page.locator("#task-modal")).toBeVisible();
  await expect(page.getByRole("heading", { name: "PDU branch load imbalance" })).toBeVisible();
  await expect(page.locator(".diagnostic-panel")).toBeVisible();
  await expect(page.locator(".diagnostic-clues p")).toHaveCount(3);
  await expect(page.locator("#task-actions .task-action")).toHaveCount(0);

  await page.getByRole("button", { name: "Read telemetry" }).click();
  await expect(page.locator(".diagnostic-panel")).toBeHidden();
  await expect(page.locator("#task-actions .task-action")).toHaveCount(4);

  const openSnapshot = await page.evaluate(() => window.__simTest.snapshot());
  const pduDisplay = openSnapshot.displayChoices.find((ticket) => ticket.id === "pdu-load");
  const pduProcedureOrder = pduDisplay.choices
    .filter((choice) => choice.kind === "procedure")
    .map((choice) => choice.index);
  expect(pduDisplay.variant).toBeTruthy();
  expect(pduDisplay.inspected).toBe(true);
  expect(pduDisplay.clues).toHaveLength(3);
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
  await expect(page.locator("#journal-entries")).not.toContainText("attempted before");
  const afterWrongStep = await page.evaluate(() => window.__simTest.snapshot());
  expect(afterWrongStep.health).toBeLessThan(beforeWrongStep.health - 4);
  const pduError = afterWrongStep.procedureErrors.find((ticket) => ticket.id === "pdu-load");
  expect(pduError.errors).toBe(1);
  expect(pduError.lastConsequence).toBeTruthy();
  await expectDomText(page, ".procedure-alert", pduError.lastConsequence);
  await expectDomText(page, "#journal-entries", pduError.lastConsequence);

  const attemptedDistractor = await page.evaluate(() => window.__simTest.attemptDistractor("pdu-load"));
  expect(attemptedDistractor).toBe(true);
  await expect(page.locator(".procedure-alert")).toContainText("Unsafe response choice");
  await expect(page.locator(".task-action.error")).toContainText(pduDisplay.distractors[0]);
  const afterDistractor = await page.evaluate(() => window.__simTest.snapshot());
  const pduDistractorError = afterDistractor.procedureErrors.find((ticket) => ticket.id === "pdu-load");
  expect(pduDistractorError.lastConsequence).toBeTruthy();
  await expectDomText(page, ".procedure-alert", pduDistractorError.lastConsequence);

  const attemptedCorrectStep = await page.evaluate(() => window.__simTest.attemptStep("pdu-load", 0));
  expect(attemptedCorrectStep).toBe(true);
  await expect(page.locator("#journal-entries")).toContainText(pduDisplay.actions[0]);

  const completed = await page.evaluate(() => window.__simTest.completeTicket("pdu-load"));
  expect(completed).toBe(true);
  await expect(page.locator(".debrief-panel")).toBeVisible();
  await expect(page.locator(".debrief-panel")).toContainText("Resolution review");
  await expect(page.locator(".debrief-sequence li")).toHaveCount(3);
  await expect(page.locator(".debrief-sequence li").first()).toHaveText(pduDisplay.actions[0]);
  await expectDomText(page, ".debrief-consequences", pduDistractorError.lastConsequence);
  const snapshot = await page.evaluate(() => window.__simTest.snapshot());
  expect(snapshot.cueLog).toContain("task-complete");
  expect(snapshot.floorMap.incidents).toHaveLength(3);
  expect(snapshot.procedureErrors.find((ticket) => ticket.id === "pdu-load").mistakeConsequences).toContain(
    pduDistractorError.lastConsequence,
  );
});

test("restarts a completed shift without reloading the page", async ({ page }) => {
  await page.goto("/?test=1&autostart=1");
  await page.evaluate(() => {
    window.__restartSentinel = "same-page";
  });

  const finished = await page.evaluate(() => window.__simTest.finishShift());
  expect(finished).toBe(true);
  await expect(page.locator("#score-modal")).toBeVisible();
  await expect(page.locator("#score-breakdown")).toContainText("Base score");
  await expect(page.locator("#score-breakdown")).toContainText("Procedure errors");
  await expect(page.locator("#score-breakdown")).toContainText("Unnecessary actions");
  await expect(page.locator("#score-breakdown")).toContainText("Difficulty");

  await page.locator("#restart-shift").dispatchEvent("click");
  const snapshot = await page.evaluate(() => ({
    sentinel: window.__restartSentinel,
    state: window.__simTest.snapshot(),
  }));

  await expect(page.locator("#score-modal")).toBeHidden();
  await expect(page.locator("#ticket-count")).toHaveText("4");
  await expect(page.locator("#health")).toHaveText("100%");
  await expect(page.locator("#floor-map-points > div")).toHaveCount(5);

  expect(snapshot.sentinel).toBe("same-page");
  expect(snapshot.state.finished).toBe(false);
  expect(snapshot.state.openTickets).toBe(4);
  expect(snapshot.state.journalEntries).toBe(0);
  expect(snapshot.state.floorMap.incidents).toHaveLength(4);
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
  await expectDomText(page, "#tickets", "Critical in 3 min");
  await page.evaluate(() => window.__simTest.advanceIncidentsTo(8));

  await expect(page.locator("#tickets")).toContainText("Critical");
  await expectDomText(page, "#tickets", "Critical pressure active");
  const snapshot = await page.evaluate(() => window.__simTest.snapshot());
  expect(snapshot.difficulty).toBe("expert");
  expect(snapshot.cueLog).toContain("critical-escalation");
});
