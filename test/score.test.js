import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAverageResponseMinutes,
  calculateShiftGradeBreakdown,
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
      averageResponseMinutes: 4,
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

test("grade breakdown applies mistake and response penalties", () => {
  const cleanBreakdown = calculateShiftGradeBreakdown({
    health: 96,
    pue: 1.34,
    temperature: 22.5,
    resolvedTickets: 4,
    totalTickets: 4,
    averageResponseMinutes: 6,
  });
  const penalizedBreakdown = calculateShiftGradeBreakdown({
    health: 96,
    pue: 1.34,
    temperature: 22.5,
    resolvedTickets: 4,
    totalTickets: 4,
    procedureErrors: 2,
    unnecessaryActions: 1,
    averageResponseMinutes: 12,
  });

  assert.equal(penalizedBreakdown.procedurePenalty, 8);
  assert.equal(penalizedBreakdown.unnecessaryActionPenalty, 3);
  assert.equal(penalizedBreakdown.responsePenalty, 6);
  assert.ok(penalizedBreakdown.finalScore < cleanBreakdown.finalScore);
});

test("difficulty multiplier adjusts the final score", () => {
  const trainingBreakdown = calculateShiftGradeBreakdown({
    health: 88,
    pue: 1.42,
    temperature: 25,
    resolvedTickets: 4,
    totalTickets: 4,
    averageResponseMinutes: 8,
    difficulty: "training",
  });
  const expertBreakdown = calculateShiftGradeBreakdown({
    health: 88,
    pue: 1.42,
    temperature: 25,
    resolvedTickets: 4,
    totalTickets: 4,
    averageResponseMinutes: 8,
    difficulty: "expert",
  });

  assert.equal(trainingBreakdown.difficultyMultiplier, 0.9);
  assert.equal(expertBreakdown.difficultyMultiplier, 1.08);
  assert.ok(expertBreakdown.finalScore > trainingBreakdown.finalScore);
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
