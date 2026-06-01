import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAverageResponseMinutes,
  calculateShiftScore,
  formatResponseMinutes,
} from "../src/score.js";

test("perfect shift receives a perfect score", () => {
  assert.equal(
    calculateShiftScore({
      health: 100,
      pue: 1.31,
      temperature: 22,
      resolvedTickets: 4,
      totalTickets: 4,
    }),
    100,
  );
});

test("unresolved tickets reduce the score", () => {
  const completeScore = calculateShiftScore({
    health: 90,
    pue: 1.42,
    temperature: 25,
    resolvedTickets: 4,
    totalTickets: 4,
  });
  const partialScore = calculateShiftScore({
    health: 90,
    pue: 1.42,
    temperature: 25,
    resolvedTickets: 2,
    totalTickets: 4,
  });

  assert.ok(partialScore < completeScore);
});

test("score is clamped when health is depleted", () => {
  assert.equal(
    calculateShiftScore({
      health: -10,
      pue: 2.4,
      temperature: 40,
      resolvedTickets: 0,
      totalTickets: 4,
    }),
    0,
  );
});

test("average response ignores unresolved tickets", () => {
  assert.equal(
    calculateAverageResponseMinutes([
      { resolvedAtMinute: 4 },
      { resolvedAtMinute: null },
      { resolvedAtMinute: 10 },
    ]),
    7,
  );
});

test("response time formatting handles unresolved and quick responses", () => {
  assert.equal(formatResponseMinutes(null), "Unresolved");
  assert.equal(formatResponseMinutes(0), "<1 min");
  assert.equal(formatResponseMinutes(8.4), "8 min");
});
