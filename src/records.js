export const SHIFT_RECORD_KEY = "3d-dc-sim.shift-record.v1";

export function getEmptyShiftRecord() {
  return {
    attempts: 0,
    bestScore: null,
    bestDifficulty: null,
    bestResolvedTickets: null,
    bestTotalTickets: null,
    lastScore: null,
    lastDifficulty: null,
    lastResolvedTickets: null,
    lastTotalTickets: null,
  };
}

function normalizeNumber(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeRecord(record) {
  const emptyRecord = getEmptyShiftRecord();
  if (!record || typeof record !== "object") return emptyRecord;

  return {
    attempts: Math.max(0, Math.floor(normalizeNumber(record.attempts, 0))),
    bestScore: normalizeNumber(record.bestScore),
    bestDifficulty: typeof record.bestDifficulty === "string" ? record.bestDifficulty : null,
    bestResolvedTickets: normalizeNumber(record.bestResolvedTickets),
    bestTotalTickets: normalizeNumber(record.bestTotalTickets),
    lastScore: normalizeNumber(record.lastScore),
    lastDifficulty: typeof record.lastDifficulty === "string" ? record.lastDifficulty : null,
    lastResolvedTickets: normalizeNumber(record.lastResolvedTickets),
    lastTotalTickets: normalizeNumber(record.lastTotalTickets),
  };
}

function writeShiftRecord(storage, record) {
  try {
    storage?.setItem?.(SHIFT_RECORD_KEY, JSON.stringify(record));
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }
}

export function clearShiftRecord(storage = globalThis.localStorage) {
  try {
    storage?.removeItem?.(SHIFT_RECORD_KEY);
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }

  return getEmptyShiftRecord();
}

export function readShiftRecord(storage = globalThis.localStorage) {
  try {
    return normalizeRecord(JSON.parse(storage?.getItem?.(SHIFT_RECORD_KEY) ?? "null"));
  } catch {
    return getEmptyShiftRecord();
  }
}

export function recordShiftResult(
  {
    score,
    difficulty,
    resolvedTickets,
    totalTickets,
  },
  storage = globalThis.localStorage,
) {
  const currentRecord = readShiftRecord(storage);
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const isBestScore = currentRecord.bestScore === null || normalizedScore > currentRecord.bestScore;
  const updatedRecord = {
    ...currentRecord,
    attempts: currentRecord.attempts + 1,
    lastScore: normalizedScore,
    lastDifficulty: difficulty,
    lastResolvedTickets: resolvedTickets,
    lastTotalTickets: totalTickets,
    bestScore: isBestScore ? normalizedScore : currentRecord.bestScore,
    bestDifficulty: isBestScore ? difficulty : currentRecord.bestDifficulty,
    bestResolvedTickets: isBestScore ? resolvedTickets : currentRecord.bestResolvedTickets,
    bestTotalTickets: isBestScore ? totalTickets : currentRecord.bestTotalTickets,
  };

  writeShiftRecord(storage, updatedRecord);
  return updatedRecord;
}
