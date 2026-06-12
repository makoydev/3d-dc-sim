import assert from "node:assert/strict";
import test from "node:test";

import { DATA_HALL_BOUNDS, getFloorMapItems, getFloorMapPoint } from "../src/floorMap.js";

test("floor map converts world coordinates to panel percentages", () => {
  assert.deepEqual(getFloorMapPoint({ x: 0, z: 0 }), { left: 50, top: 50 });
  assert.deepEqual(getFloorMapPoint({ x: DATA_HALL_BOUNDS.minX, z: DATA_HALL_BOUNDS.minZ }), {
    left: 0,
    top: 0,
  });
  assert.deepEqual(getFloorMapPoint({ x: DATA_HALL_BOUNDS.maxX, z: DATA_HALL_BOUNDS.maxZ }), {
    left: 100,
    top: 100,
  });
});

test("floor map clamps positions outside the data hall bounds", () => {
  assert.deepEqual(getFloorMapPoint({ x: -30, z: 40 }), { left: 0, top: 100 });
});

test("floor map items omit resolved incidents", () => {
  const items = getFloorMapItems({
    playerPosition: { x: 0, z: 0 },
    tickets: [
      {
        id: "open",
        title: "Open ticket",
        accent: "#fff",
        stage: "watch",
        location: { x: 9, z: -7.5 },
        done: false,
      },
      {
        id: "done",
        title: "Done ticket",
        accent: "#fff",
        stage: "resolved",
        location: { x: -9, z: 7.5 },
        done: true,
      },
    ],
  });

  assert.deepEqual(items.player, { left: 50, top: 50 });
  assert.equal(items.incidents.length, 1);
  assert.equal(items.incidents[0].id, "open");
  assert.deepEqual(
    { left: items.incidents[0].left, top: items.incidents[0].top },
    { left: 75, top: 25 },
  );
});
