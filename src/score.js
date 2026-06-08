const DIFFICULTY_MULTIPLIERS = {
  training: 0.9,
  standard: 1,
  expert: 1.08,
};

export function calculateShiftScore({
  health,
  pue,
  temperature,
  resolvedTickets,
  totalTickets,
  procedureErrors = 0,
  unnecessaryActions = 0,
  averageResponseMinutes = null,
  difficulty = "standard",
}) {
  return calculateShiftGradeBreakdown({
    health,
    pue,
    temperature,
    resolvedTickets,
    totalTickets,
    procedureErrors,
    unnecessaryActions,
    averageResponseMinutes,
    difficulty,
  }).finalScore;
}

export function calculateShiftGradeBreakdown({
  health,
  pue,
  temperature,
  resolvedTickets,
  totalTickets,
  procedureErrors = 0,
  unnecessaryActions = 0,
  averageResponseMinutes = null,
  difficulty = "standard",
}) {
  const resolutionRatio = totalTickets === 0 ? 1 : resolvedTickets / totalTickets;
  const healthScore = Math.max(0, Math.min(100, health));
  const efficiencyScore = Math.max(0, 100 - Math.max(0, pue - 1.35) * 140);
  const thermalScore = Math.max(0, 100 - Math.max(0, temperature - 24) * 12);
  const resolutionScore = resolutionRatio * 100;
  const baseScore = Math.round(
    healthScore * 0.35 + efficiencyScore * 0.2 + thermalScore * 0.2 + resolutionScore * 0.25,
  );
  const responsePenalty = Number.isFinite(averageResponseMinutes)
    ? Math.max(0, Math.round((averageResponseMinutes - 8) * 1.5))
    : 18;
  const procedurePenalty = Math.max(0, procedureErrors) * 4;
  const unnecessaryActionPenalty = Math.max(0, unnecessaryActions) * 3;
  const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[difficulty] ?? DIFFICULTY_MULTIPLIERS.standard;
  const adjustedScore = Math.max(0, baseScore - responsePenalty - procedurePenalty - unnecessaryActionPenalty);
  const finalScore = Math.max(0, Math.min(100, Math.round(adjustedScore * difficultyMultiplier)));

  return {
    baseScore,
    finalScore,
    responsePenalty,
    procedurePenalty,
    unnecessaryActionPenalty,
    difficultyMultiplier,
  };
}

export function calculateAverageResponseMinutes(tickets) {
  const responseTimes = tickets
    .map((ticket) => ticket.resolvedAtMinute)
    .filter((minute) => Number.isFinite(minute));

  if (responseTimes.length === 0) return null;

  return Math.round(
    responseTimes.reduce((sum, minute) => sum + minute, 0) / responseTimes.length,
  );
}

export function formatResponseMinutes(minutes) {
  if (!Number.isFinite(minutes)) return "Unresolved";
  if (minutes < 1) return "<1 min";
  return `${Math.round(minutes)} min`;
}
