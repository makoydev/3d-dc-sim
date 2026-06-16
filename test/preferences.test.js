import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  readPreferences,
  writePreferences,
} from "../src/preferences.js";

function createMemoryStorage(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) values.set(PREFERENCES_KEY, initialValue);

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("read preferences returns defaults when storage is empty", () => {
  assert.deepEqual(readPreferences(createMemoryStorage()), DEFAULT_PREFERENCES);
});

test("read preferences recovers from invalid storage", () => {
  assert.deepEqual(readPreferences(createMemoryStorage("{bad json")), DEFAULT_PREFERENCES);
});

test("read preferences normalizes invalid values", () => {
  const storage = createMemoryStorage(
    JSON.stringify({
      difficulty: "impossible",
      mouseSensitivity: 99,
      invertY: "yes",
      movementSpeed: -1,
    }),
  );

  assert.deepEqual(readPreferences(storage), {
    difficulty: "standard",
    mouseSensitivity: 4,
    invertY: false,
    movementSpeed: 3,
  });
});

test("write preferences stores normalized values", () => {
  const storage = createMemoryStorage();
  const preferences = writePreferences(
    {
      difficulty: "expert",
      mouseSensitivity: 2.6,
      invertY: true,
      movementSpeed: 6.4,
    },
    storage,
  );

  assert.deepEqual(preferences, {
    difficulty: "expert",
    mouseSensitivity: 2.6,
    invertY: true,
    movementSpeed: 6.4,
  });
  assert.deepEqual(readPreferences(storage), preferences);
});
