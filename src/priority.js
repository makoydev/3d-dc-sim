const STAGE_WEIGHTS = {
  critical: 300,
  degraded: 200,
  watch: 100,
  resolved: 0,
};

function getDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export function getIncidentPriorityItems({ playerPosition, tickets }) {
  return tickets
    .map((ticket) => {
      const distance = getDistance(playerPosition, ticket.location);
      const urgency = STAGE_WEIGHTS[ticket.stage] ?? STAGE_WEIGHTS.watch;
      const mistakePressure = Math.max(0, ticket.procedureErrors ?? 0) * 18;
      const score = ticket.done ? -Infinity : urgency + mistakePressure - distance;

      return {
        id: ticket.id,
        score,
        distance,
      };
    })
    .sort((a, b) => b.score - a.score || a.distance - b.distance);
}

export function getRecommendedIncidentId({ playerPosition, tickets }) {
  return getIncidentPriorityItems({ playerPosition, tickets }).find((item) => Number.isFinite(item.score))?.id ?? null;
}
