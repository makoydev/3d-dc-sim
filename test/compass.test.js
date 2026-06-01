import assert from "node:assert/strict";
import test from "node:test";

import { getObjectiveCompassItems } from "../src/compass.js";

const origin = { x: 0, z: 0 };

function makeTicket(id, location, done = false) {
  return {
    id,
    title: id,
    accent: "#ffffff",
    location,
    done,
  };
}

test("objective directly ahead stays centered", () => {
  const [item] = getObjectiveCompassItems({
    playerPosition: origin,
    yaw: 0,
    tickets: [makeTicket("ahead", { x: 0, z: -10 })],
  });

  assert.equal(item.id, "ahead");
  assert.ok(Math.abs(item.offset) < 1e-12);
  assert.equal(item.isBehind, false);
});

test("objective to the right moves to the right side of the compass", () => {
  const [item] = getObjectiveCompassItems({
    playerPosition: origin,
    yaw: 0,
    tickets: [makeTicket("right", { x: 10, z: 0 })],
  });

  assert.ok(item.offset > 0.99);
  assert.equal(item.isBehind, false);
});

test("resolved objectives are omitted", () => {
  const items = getObjectiveCompassItems({
    playerPosition: origin,
    yaw: 0,
    tickets: [
      makeTicket("done", { x: 0, z: -10 }, true),
      makeTicket("open", { x: 3, z: -4 }),
    ],
  });

  assert.deepEqual(items.map((item) => item.id), ["open"]);
});

test("objectives are sorted by distance", () => {
  const items = getObjectiveCompassItems({
    playerPosition: origin,
    yaw: 0,
    tickets: [
      makeTicket("far", { x: 0, z: -20 }),
      makeTicket("near", { x: 0, z: -5 }),
    ],
  });

  assert.deepEqual(items.map((item) => item.id), ["near", "far"]);
});
