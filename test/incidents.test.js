import assert from "node:assert/strict";
import test from "node:test";

import {
  getDifficultyPreset,
  getIncidentEscalationStatus,
  getIncidentPressureMultiplier,
  getIncidentStage,
} from "../src/incidents.js";

test("incident stages progress by elapsed shift time", () => {
  assert.equal(getIncidentStage(0).id, "watch");
  assert.equal(getIncidentStage(6).id, "degraded");
  assert.equal(getIncidentStage(12).id, "critical");
});

test("resolved incidents do not apply pressure", () => {
  const stage = getIncidentStage(30, true);

  assert.equal(stage.id, "resolved");
  assert.equal(stage.pressureMultiplier, 0);
});

test("critical incidents apply stronger pressure", () => {
  assert.ok(getIncidentPressureMultiplier("critical") > getIncidentPressureMultiplier("watch"));
});

test("difficulty presets adjust escalation thresholds", () => {
  assert.equal(getIncidentStage(5, false, { difficulty: "expert" }).id, "degraded");
  assert.equal(getIncidentStage(5, false, { difficulty: "standard" }).id, "watch");
  assert.equal(getIncidentStage(8, false, { difficulty: "training" }).id, "watch");
  assert.equal(getIncidentStage(9, false, { difficulty: "training" }).id, "degraded");
});

test("unknown difficulty falls back to standard", () => {
  assert.equal(getDifficultyPreset("unknown").id, "standard");
});

test("escalation status reports the next stage countdown", () => {
  const standardStatus = getIncidentEscalationStatus(3, false, { difficulty: "standard" });

  assert.equal(standardStatus.stage.id, "watch");
  assert.equal(standardStatus.nextStage.id, "degraded");
  assert.equal(standardStatus.minutesUntilNext, 3);

  const expertStatus = getIncidentEscalationStatus(5, false, { difficulty: "expert" });

  assert.equal(expertStatus.stage.id, "degraded");
  assert.equal(expertStatus.nextStage.id, "critical");
  assert.equal(expertStatus.minutesUntilNext, 3);
});

test("escalation status clears countdowns for resolved and critical incidents", () => {
  const resolvedStatus = getIncidentEscalationStatus(30, true);
  const criticalStatus = getIncidentEscalationStatus(12);

  assert.equal(resolvedStatus.stage.id, "resolved");
  assert.equal(resolvedStatus.nextStage, null);
  assert.equal(resolvedStatus.minutesUntilNext, null);
  assert.equal(criticalStatus.stage.id, "critical");
  assert.equal(criticalStatus.nextStage, null);
  assert.equal(criticalStatus.minutesUntilNext, null);
});
