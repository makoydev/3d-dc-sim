import assert from "node:assert/strict";
import test from "node:test";

import {
  SHIFT_RECORD_KEY,
  clearShiftRecord,
  getEmptyShiftRecord,
  readShiftRecord,
  recordShiftResult,
} from "../src/records.js";

function createMemoryStorage(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) values.set(SHIFT_RECORD_KEY, initialValue);

  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

test("read shift record returns defaults when storage is empty", () => {
  assert.deepEqual(readShiftRecord(createMemoryStorage()), getEmptyShiftRecord());
});

test("read shift record recovers from invalid storage", () => {
  assert.deepEqual(readShiftRecord(createMemoryStorage("{bad json")), getEmptyShiftRecord());
});

test("record shift result stores attempts, latest score, and best score", () => {
  const storage = createMemoryStorage();

  const firstRecord = recordShiftResult(
    {
      score: 82,
      difficulty: "standard",
      resolvedTickets: 3,
      totalTickets: 4,
    },
    storage,
  );

  assert.equal(firstRecord.attempts, 1);
  assert.equal(firstRecord.lastScore, 82);
  assert.equal(firstRecord.bestScore, 82);
  assert.equal(firstRecord.bestDifficulty, "standard");

  const secondRecord = recordShiftResult(
    {
      score: 76,
      difficulty: "expert",
      resolvedTickets: 4,
      totalTickets: 4,
    },
    storage,
  );

  assert.equal(secondRecord.attempts, 2);
  assert.equal(secondRecord.lastScore, 76);
  assert.equal(secondRecord.lastDifficulty, "expert");
  assert.equal(secondRecord.bestScore, 82);
  assert.equal(secondRecord.bestDifficulty, "standard");
});

test("record shift result replaces best score when a run improves", () => {
  const storage = createMemoryStorage();

  recordShiftResult(
    {
      score: 82,
      difficulty: "standard",
      resolvedTickets: 3,
      totalTickets: 4,
    },
    storage,
  );
  const record = recordShiftResult(
    {
      score: 91.4,
      difficulty: "expert",
      resolvedTickets: 4,
      totalTickets: 4,
    },
    storage,
  );

  assert.equal(record.bestScore, 91);
  assert.equal(record.bestDifficulty, "expert");
  assert.equal(record.bestResolvedTickets, 4);
});

test("clear shift record removes stored progress", () => {
  const storage = createMemoryStorage();
  recordShiftResult(
    {
      score: 88,
      difficulty: "standard",
      resolvedTickets: 4,
      totalTickets: 4,
    },
    storage,
  );

  assert.deepEqual(clearShiftRecord(storage), getEmptyShiftRecord());
  assert.deepEqual(readShiftRecord(storage), getEmptyShiftRecord());
});
