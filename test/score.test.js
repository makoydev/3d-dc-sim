import assert from "node:assert/strict";
import test from "node:test";

import { calculateShiftScore } from "../src/score.js";

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
