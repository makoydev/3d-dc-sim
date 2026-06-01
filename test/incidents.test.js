import assert from "node:assert/strict";
import test from "node:test";

import { getIncidentPressureMultiplier, getIncidentStage } from "../src/incidents.js";

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
