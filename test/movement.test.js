import assert from "node:assert/strict";
import test from "node:test";

import { getForwardVector, getMovementDirection } from "../src/movement.js";

const EPSILON = 1e-12;

function assertVector(vector, expected) {
  assert.ok(Math.abs(vector.x - expected.x) < EPSILON, `expected x ${expected.x}, got ${vector.x}`);
  assert.ok(Math.abs(vector.y - expected.y) < EPSILON, `expected y ${expected.y}, got ${vector.y}`);
  assert.ok(Math.abs(vector.z - expected.z) < EPSILON, `expected z ${expected.z}, got ${vector.z}`);
}

test("forward vector points where the camera faces at neutral yaw", () => {
  assertVector(getForwardVector(0), { x: 0, y: 0, z: -1 });
});

test("W moves forward and S moves backward at neutral yaw", () => {
  assertVector(getMovementDirection(0, new Set(["KeyW"])), { x: 0, y: 0, z: -1 });
  assertVector(getMovementDirection(0, new Set(["KeyS"])), { x: 0, y: 0, z: 1 });
});

test("W and S cancel each other out", () => {
  assertVector(getMovementDirection(0, new Set(["KeyW", "KeyS"])), { x: 0, y: 0, z: 0 });
});

test("diagonal movement remains normalized", () => {
  const direction = getMovementDirection(0, new Set(["KeyW", "KeyD"]));

  assert.ok(Math.abs(direction.length() - 1) < EPSILON);
  assertVector(direction, {
    x: Math.SQRT1_2,
    y: 0,
    z: -Math.SQRT1_2,
  });
});
