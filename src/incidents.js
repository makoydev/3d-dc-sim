export const INCIDENT_STAGES = [
  { id: "watch", label: "Watch", thresholdMinutes: 0, pressureMultiplier: 1 },
  { id: "degraded", label: "Degraded", thresholdMinutes: 6, pressureMultiplier: 1.35 },
  { id: "critical", label: "Critical", thresholdMinutes: 12, pressureMultiplier: 1.8 },
];

export const DIFFICULTY_PRESETS = [
  { id: "training", label: "Training", thresholdScale: 1.45 },
  { id: "standard", label: "Standard", thresholdScale: 1 },
  { id: "expert", label: "Expert", thresholdScale: 0.68 },
];

export function getDifficultyPreset(presetId) {
  return DIFFICULTY_PRESETS.find((preset) => preset.id === presetId) ?? DIFFICULTY_PRESETS[1];
}

export function getIncidentStage(elapsedMinutes, done = false, { difficulty = "standard" } = {}) {
  if (done) return { id: "resolved", label: "Resolved", thresholdMinutes: 0, pressureMultiplier: 0 };

  const preset = getDifficultyPreset(difficulty);
  return INCIDENT_STAGES.reduce((current, stage) => {
    const thresholdMinutes = Math.round(stage.thresholdMinutes * preset.thresholdScale);
    if (elapsedMinutes >= thresholdMinutes) return { ...stage, thresholdMinutes };
    return current;
  }, { ...INCIDENT_STAGES[0] });
}

export function getIncidentPressureMultiplier(stageId) {
  return INCIDENT_STAGES.find((stage) => stage.id === stageId)?.pressureMultiplier ?? 1;
}
