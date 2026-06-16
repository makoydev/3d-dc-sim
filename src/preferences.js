export const PREFERENCES_KEY = "3d-dc-sim.preferences.v1";

export const DEFAULT_PREFERENCES = {
  difficulty: "standard",
  mouseSensitivity: 2,
  invertY: false,
  movementSpeed: 5.2,
};

const DIFFICULTIES = new Set(["training", "standard", "expert"]);

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function normalizePreferences(preferences) {
  if (!preferences || typeof preferences !== "object") return { ...DEFAULT_PREFERENCES };

  return {
    difficulty: DIFFICULTIES.has(preferences.difficulty)
      ? preferences.difficulty
      : DEFAULT_PREFERENCES.difficulty,
    mouseSensitivity: clampNumber(
      preferences.mouseSensitivity,
      0.5,
      4,
      DEFAULT_PREFERENCES.mouseSensitivity,
    ),
    invertY: typeof preferences.invertY === "boolean" ? preferences.invertY : DEFAULT_PREFERENCES.invertY,
    movementSpeed: clampNumber(preferences.movementSpeed, 3, 8, DEFAULT_PREFERENCES.movementSpeed),
  };
}

export function readPreferences(storage = globalThis.localStorage) {
  try {
    return normalizePreferences(JSON.parse(storage?.getItem?.(PREFERENCES_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writePreferences(preferences, storage = globalThis.localStorage) {
  const normalizedPreferences = normalizePreferences(preferences);

  try {
    storage?.setItem?.(PREFERENCES_KEY, JSON.stringify(normalizedPreferences));
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }

  return normalizedPreferences;
}
