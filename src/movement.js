import * as THREE from "three";

export function getForwardVector(yaw) {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

export function getRightVector(yaw) {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
}

export function getMovementDirection(yaw, keys) {
  const direction = new THREE.Vector3();
  const forward = getForwardVector(yaw);
  const right = getRightVector(yaw);

  if (keys.has("KeyW")) direction.add(forward);
  if (keys.has("KeyS")) direction.sub(forward);
  if (keys.has("KeyD")) direction.add(right);
  if (keys.has("KeyA")) direction.sub(right);
  if (direction.lengthSq() > 0) direction.normalize();

  return direction;
}
