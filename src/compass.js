const TAU = Math.PI * 2;

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function getObjectiveCompassItems({ playerPosition, yaw, tickets }) {
  return tickets
    .filter((ticket) => !ticket.done)
    .map((ticket) => {
      const dx = ticket.location.x - playerPosition.x;
      const dz = ticket.location.z - playerPosition.z;
      const targetBearing = Math.atan2(dx, -dz);
      const relativeAngle = normalizeAngle(targetBearing + yaw);
      const distance = Math.hypot(dx, dz);

      return {
        id: ticket.id,
        title: ticket.title,
        accent: ticket.accent,
        distance,
        relativeAngle,
        offset: Math.sin(relativeAngle),
        isBehind: Math.abs(relativeAngle) > TAU / 4,
      };
    })
    .sort((a, b) => a.distance - b.distance);
}
