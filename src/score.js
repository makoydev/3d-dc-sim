export function calculateShiftScore({ health, pue, temperature, resolvedTickets, totalTickets }) {
  const resolutionRatio = totalTickets === 0 ? 1 : resolvedTickets / totalTickets;
  const healthScore = Math.max(0, Math.min(100, health));
  const efficiencyScore = Math.max(0, 100 - Math.max(0, pue - 1.35) * 140);
  const thermalScore = Math.max(0, 100 - Math.max(0, temperature - 24) * 12);
  const resolutionScore = resolutionRatio * 100;

  return Math.round(
    healthScore * 0.35 +
      efficiencyScore * 0.2 +
      thermalScore * 0.2 +
      resolutionScore * 0.25,
  );
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
