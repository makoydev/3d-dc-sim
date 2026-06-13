import assert from "node:assert/strict";
import test from "node:test";

import { getIncidentPriorityItems, getRecommendedIncidentId } from "../src/priority.js";

const playerPosition = { x: 0, z: 0 };

test("priority favors higher escalation stage over distance", () => {
  const recommended = getRecommendedIncidentId({
    playerPosition,
    tickets: [
      {
        id: "near-watch",
        stage: "watch",
        location: { x: 1, z: 0 },
        done: false,
      },
      {
        id: "far-critical",
        stage: "critical",
        location: { x: 20, z: 0 },
        done: false,
      },
    ],
  });

  assert.equal(recommended, "far-critical");
});

test("priority uses distance when stage pressure is equal", () => {
  const items = getIncidentPriorityItems({
    playerPosition,
    tickets: [
      {
        id: "far",
        stage: "watch",
        location: { x: 12, z: 0 },
        done: false,
      },
      {
        id: "near",
        stage: "watch",
        location: { x: 4, z: 0 },
        done: false,
      },
    ],
  });

  assert.deepEqual(
    items.map((item) => item.id),
    ["near", "far"],
  );
});

test("priority ignores resolved tickets for recommendation", () => {
  const recommended = getRecommendedIncidentId({
    playerPosition,
    tickets: [
      {
        id: "resolved-critical",
        stage: "critical",
        location: { x: 1, z: 0 },
        done: true,
      },
      {
        id: "open-watch",
        stage: "watch",
        location: { x: 10, z: 0 },
        done: false,
      },
    ],
  });

  assert.equal(recommended, "open-watch");
});

test("priority adds pressure for tickets with procedure errors", () => {
  const items = getIncidentPriorityItems({
    playerPosition,
    tickets: [
      {
        id: "clean",
        stage: "watch",
        procedureErrors: 0,
        location: { x: 5, z: 0 },
        done: false,
      },
      {
        id: "error",
        stage: "watch",
        procedureErrors: 2,
        location: { x: 20, z: 0 },
        done: false,
      },
    ],
  });

  assert.equal(items[0].id, "error");
});
