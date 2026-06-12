export const DATA_HALL_BOUNDS = {
  minX: -18,
  maxX: 18,
  minZ: -15,
  maxZ: 15,
};

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

export function getFloorMapPoint(position, bounds = DATA_HALL_BOUNDS) {
  const xRange = bounds.maxX - bounds.minX;
  const zRange = bounds.maxZ - bounds.minZ;

  return {
    left: clampPercent(((position.x - bounds.minX) / xRange) * 100),
    top: clampPercent(((position.z - bounds.minZ) / zRange) * 100),
  };
}

export function getFloorMapItems({ playerPosition, tickets, bounds = DATA_HALL_BOUNDS }) {
  return {
    player: getFloorMapPoint(playerPosition, bounds),
    incidents: tickets
      .filter((ticket) => !ticket.done)
      .map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        accent: ticket.accent,
        stage: ticket.stage,
        ...getFloorMapPoint(ticket.location, bounds),
      })),
  };
}
