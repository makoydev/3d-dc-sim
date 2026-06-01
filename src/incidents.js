export const INCIDENT_STAGES = [
  { id: "watch", label: "Watch", thresholdMinutes: 0, pressureMultiplier: 1 },
  { id: "degraded", label: "Degraded", thresholdMinutes: 6, pressureMultiplier: 1.35 },
  { id: "critical", label: "Critical", thresholdMinutes: 12, pressureMultiplier: 1.8 },
];

export function getIncidentStage(elapsedMinutes, done = false) {
  if (done) return { id: "resolved", label: "Resolved", thresholdMinutes: 0, pressureMultiplier: 0 };

  return INCIDENT_STAGES.reduce((current, stage) => {
    if (elapsedMinutes >= stage.thresholdMinutes) return stage;
    return current;
  }, INCIDENT_STAGES[0]);
}

export function getIncidentPressureMultiplier(stageId) {
  return INCIDENT_STAGES.find((stage) => stage.id === stageId)?.pressureMultiplier ?? 1;
}
