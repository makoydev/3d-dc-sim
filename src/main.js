import "./styles.css";
import * as THREE from "three";
import { getObjectiveCompassItems } from "./compass.js";
import {
  DIFFICULTY_PRESETS,
  getIncidentPressureMultiplier,
  getIncidentStage,
} from "./incidents.js";
import { getMovementDirection } from "./movement.js";
import {
  calculateAverageResponseMinutes,
  calculateShiftScore,
  formatResponseMinutes,
} from "./score.js";

const canvas = document.querySelector("#world");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x081012);
scene.fog = new THREE.Fog(0x081012, 16, 68);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.1,
  160,
);
camera.position.set(0, 1.72, 13);

const world = new THREE.Group();
scene.add(world);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const mouseCenter = new THREE.Vector2(0, 0);

const keys = new Set();
const initialPlayerPosition = new THREE.Vector3(0, 1.72, 13);
const player = {
  position: camera.position,
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  speed: 5.2,
  radius: 0.55,
};

function getInitialShiftState() {
  return {
    health: 100,
    temperature: 22,
    pue: 1.39,
    minutes: 8 * 60,
    startMinutes: 8 * 60,
  };
}

const state = {
  started: false,
  paused: true,
  ...getInitialShiftState(),
  finished: false,
  finishReason: "",
  activeTarget: null,
  journal: [],
  audio: {
    context: null,
    cueLog: [],
  },
  settings: {
    difficulty: "standard",
    mouseSensitivity: 2,
    invertY: false,
    movementSpeed: 5.2,
  },
  tickets: [
    {
      id: "cooling-leak",
      title: "Cooling loop leak",
      type: "Facilities alarm",
      location: new THREE.Vector3(-13.5, 0.6, -7.5),
      accent: "#58b7ff",
      description:
        "Moisture detected beside the chilled-water branch feeding CRAC-2. Follow the containment and isolation sequence before water reaches the underfloor plenum.",
      label: "Inspect chilled-water leak at CRAC-2",
      actions: [
        "Confirm drip source and keep water away from energized gear",
        "Close the local isolation valve",
        "Place absorbent pads and raise a facilities repair ticket",
      ],
      completedSteps: new Set(),
      procedureErrors: 0,
      lastProcedureError: null,
      resolvedAtMinute: null,
      stage: "watch",
      penaltyRate: 0.7,
      metricEffect: (dt) => {
        state.pue += 0.00035 * dt;
      },
    },
    {
      id: "hot-aisle",
      title: "Hot aisle temperature drift",
      type: "Thermal event",
      location: new THREE.Vector3(3.2, 0.9, -12.5),
      accent: "#ffb357",
      description:
        "Rack row B is running above target because airflow is bypassing the cold aisle. Restore containment and adjust the CRAC setpoint gradually.",
      label: "Balance airflow at rack row B",
      actions: [
        "Verify blanking panels and close the open containment door",
        "Increase fan trim by one step",
        "Check return-air temperature after stabilization",
      ],
      completedSteps: new Set(),
      procedureErrors: 0,
      lastProcedureError: null,
      resolvedAtMinute: null,
      stage: "watch",
      penaltyRate: 0.9,
      metricEffect: (dt) => {
        state.temperature += 0.045 * dt;
        state.pue += 0.0003 * dt;
      },
    },
    {
      id: "ups-alarm",
      title: "UPS battery string alarm",
      type: "Electrical risk",
      location: new THREE.Vector3(14, 1, 9),
      accent: "#f76565",
      description:
        "The UPS cabinet reports high impedance on one battery string. Confirm redundancy, isolate the string, and document load protection before escalation.",
      label: "Respond to UPS battery alarm",
      actions: [
        "Check N+1 capacity and current load percentage",
        "Open the maintenance bypass checklist",
        "Isolate the affected battery string and notify electrical vendor",
      ],
      completedSteps: new Set(),
      procedureErrors: 0,
      lastProcedureError: null,
      resolvedAtMinute: null,
      stage: "watch",
      penaltyRate: 1.1,
      metricEffect: (dt) => {
        state.health -= 0.018 * dt;
      },
    },
    {
      id: "pdu-load",
      title: "PDU branch load imbalance",
      type: "Capacity operation",
      location: new THREE.Vector3(-6, 0.8, 10.6),
      accent: "#9ae66e",
      description:
        "A new deployment is drawing uneven current across A/B feeds. Verify readings and move the approved noncritical load to restore headroom.",
      label: "Rebalance PDU A/B branch load",
      actions: [
        "Read A-feed and B-feed branch currents",
        "Identify approved noncritical load from the change record",
        "Move load to the lower-utilization branch and update the panel schedule",
      ],
      completedSteps: new Set(),
      procedureErrors: 0,
      lastProcedureError: null,
      resolvedAtMinute: null,
      stage: "watch",
      penaltyRate: 0.55,
      metricEffect: (dt) => {
        state.health -= 0.012 * dt;
      },
    },
  ],
};

const interactables = [];
const colliders = [];
const animated = [];

const ui = {
  startScreen: document.querySelector("#start-screen"),
  startButton: document.querySelector("#start-button"),
  hud: document.querySelector("#hud"),
  health: document.querySelector("#health"),
  temperature: document.querySelector("#temperature"),
  pue: document.querySelector("#pue"),
  ticketCount: document.querySelector("#ticket-count"),
  clock: document.querySelector("#clock"),
  compassTrack: document.querySelector("#compass-track"),
  compassHint: document.querySelector("#compass-hint"),
  settingsButton: document.querySelector("#settings-button"),
  settingsModal: document.querySelector("#settings-modal"),
  mouseSensitivity: document.querySelector("#mouse-sensitivity"),
  mouseSensitivityValue: document.querySelector("#mouse-sensitivity-value"),
  invertY: document.querySelector("#invert-y"),
  movementSpeed: document.querySelector("#movement-speed"),
  movementSpeedValue: document.querySelector("#movement-speed-value"),
  closeSettings: document.querySelector("#close-settings"),
  difficultyOptions: document.querySelectorAll("[data-difficulty-option]"),
  tickets: document.querySelector("#tickets"),
  journalEntries: document.querySelector("#journal-entries"),
  interaction: document.querySelector("#interaction"),
  interactionLabel: document.querySelector("#interaction-label"),
  taskModal: document.querySelector("#task-modal"),
  taskType: document.querySelector("#task-type"),
  taskTitle: document.querySelector("#task-title"),
  taskDescription: document.querySelector("#task-description"),
  taskActions: document.querySelector("#task-actions"),
  closeTask: document.querySelector("#close-task"),
  scoreModal: document.querySelector("#score-modal"),
  scoreTitle: document.querySelector("#score-title"),
  scoreValue: document.querySelector("#score-value"),
  scoreStats: document.querySelector("#score-stats"),
  scoreResponses: document.querySelector("#score-responses"),
  scoreJournal: document.querySelector("#score-journal"),
  restartShift: document.querySelector("#restart-shift"),
};

const materials = {
  floor: new THREE.MeshStandardMaterial({
    color: 0x253134,
    roughness: 0.72,
    metalness: 0.1,
  }),
  wall: new THREE.MeshStandardMaterial({ color: 0x11191c, roughness: 0.86 }),
  rack: new THREE.MeshStandardMaterial({
    color: 0x121719,
    roughness: 0.55,
    metalness: 0.35,
  }),
  rackSide: new THREE.MeshStandardMaterial({
    color: 0x222c30,
    roughness: 0.58,
    metalness: 0.24,
  }),
  coldAisle: new THREE.MeshStandardMaterial({
    color: 0x16364a,
    roughness: 0.8,
    transparent: true,
    opacity: 0.62,
  }),
  hotAisle: new THREE.MeshStandardMaterial({
    color: 0x4c1c18,
    roughness: 0.82,
    transparent: true,
    opacity: 0.55,
  }),
  cable: new THREE.MeshStandardMaterial({ color: 0x22282b, roughness: 0.5 }),
  pipe: new THREE.MeshStandardMaterial({
    color: 0x6b8ea0,
    roughness: 0.42,
    metalness: 0.6,
  }),
  hazard: new THREE.MeshStandardMaterial({
    color: 0xff5f5f,
    emissive: 0x4a0000,
    roughness: 0.4,
  }),
  success: new THREE.MeshStandardMaterial({
    color: 0x71f0c6,
    emissive: 0x0b3a2b,
    roughness: 0.42,
  }),
};

function box(name, size, position, material, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  world.add(mesh);
  return mesh;
}

function addCollider(center, size) {
  const bounds = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(...center),
    new THREE.Vector3(...size),
  );
  colliders.push(bounds);
}

function buildRoom() {
  box("raised access floor", [36, 0.18, 30], [0, -0.09, 0], materials.floor, false);
  box("north wall", [36, 5, 0.35], [0, 2.5, -15], materials.wall, false);
  box("south wall", [36, 5, 0.35], [0, 2.5, 15], materials.wall, false);
  box("west wall", [0.35, 5, 30], [-18, 2.5, 0], materials.wall, false);
  box("east wall", [0.35, 5, 30], [18, 2.5, 0], materials.wall, false);
  box("ceiling grid", [36, 0.16, 30], [0, 5.1, 0], materials.wall, false);

  addCollider([0, 2.5, -15], [36, 5, 0.8]);
  addCollider([0, 2.5, 15], [36, 5, 0.8]);
  addCollider([-18, 2.5, 0], [0.8, 5, 30]);
  addCollider([18, 2.5, 0], [0.8, 5, 30]);

  const gridMat = new THREE.MeshBasicMaterial({
    color: 0x506066,
    transparent: true,
    opacity: 0.22,
  });
  for (let x = -17; x <= 17; x += 2) {
    box("floor seam", [0.025, 0.012, 30], [x, 0.012, 0], gridMat, false, false);
  }
  for (let z = -14; z <= 14; z += 2) {
    box("floor seam", [36, 0.012, 0.025], [0, 0.012, z], gridMat, false, false);
  }

  const coldMat = materials.coldAisle;
  const hotMat = materials.hotAisle;
  box("cold aisle blue tile", [4.8, 0.025, 24], [-8, 0.02, 0], coldMat, false, false);
  box("cold aisle blue tile", [4.8, 0.025, 24], [8, 0.02, 0], coldMat, false, false);
  box("hot aisle red tile", [4.8, 0.025, 24], [0, 0.021, 0], hotMat, false, false);

  for (let i = -14; i <= 14; i += 4) {
    const light = new THREE.RectAreaLight(0xe7fff5, 2.4, 3.6, 0.42);
    light.position.set(0, 4.95, i);
    light.rotation.x = -Math.PI / 2;
    scene.add(light);
    box("ceiling luminaire", [3.8, 0.05, 0.5], [0, 4.96, i], new THREE.MeshBasicMaterial({ color: 0xcfffea }), false, false);
  }

  const ambient = new THREE.HemisphereLight(0xc8fff0, 0x10191c, 0.9);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xf6fff8, 1.1);
  sun.position.set(-8, 12, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  scene.add(sun);
}

function buildRack(x, z, rowLabel, index) {
  const rack = box(
    `${rowLabel}-${index} rack`,
    [1.65, 3.2, 1.22],
    [x, 1.6, z],
    materials.rack,
  );
  addCollider([x, 1.6, z], [1.9, 3.2, 1.45]);

  const front = box(
    "perforated rack door",
    [1.38, 2.74, 0.045],
    [x, 1.72, z + 0.64],
    new THREE.MeshStandardMaterial({
      color: 0x090d0e,
      roughness: 0.34,
      metalness: 0.5,
    }),
  );
  front.userData.parentRack = rack;
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x75f0c7 });
  for (let u = 0; u < 9; u += 1) {
    const led = box(
      "status led",
      [0.06, 0.035, 0.02],
      [x + 0.58, 0.55 + u * 0.29, z + 0.675],
      ledMat,
      false,
      false,
    );
    animated.push({
      mesh: led,
      update: (t) => {
        led.material.color.setHex(Math.sin(t * 2 + u + index) > -0.2 ? 0x75f0c7 : 0x27463d);
      },
    });
  }
  for (let shelf = 0; shelf < 6; shelf += 1) {
    box(
      "server faceplate",
      [1.14, 0.06, 0.03],
      [x - 0.08, 0.72 + shelf * 0.37, z + 0.68],
      materials.rackSide,
      false,
      false,
    );
  }
  return rack;
}

function buildDataHall() {
  for (const x of [-10.5, -6, 6, 10.5]) {
    for (let z = -10; z <= 10; z += 2.3) {
      buildRack(x, z, x < 0 ? "A" : "B", Math.round(z * 10));
    }
  }

  for (const x of [-14.8, 14.8]) {
    for (const z of [-8, 0, 8]) {
      box("CRAC cooling unit", [2.6, 2.4, 1.5], [x, 1.2, z], new THREE.MeshStandardMaterial({
        color: 0xd2d8d5,
        roughness: 0.42,
        metalness: 0.12,
      }));
      addCollider([x, 1.2, z], [2.9, 2.4, 1.8]);
      box("CRAC vent", [1.8, 0.18, 0.08], [x, 2.12, z + 0.78], materials.rackSide, false, false);
    }
  }

  box("UPS cabinet", [3.2, 2.4, 1.8], [14, 1.2, 10.2], new THREE.MeshStandardMaterial({
    color: 0x263239,
    roughness: 0.5,
    metalness: 0.24,
  }));
  addCollider([14, 1.2, 10.2], [3.5, 2.4, 2.1]);

  box("PDU cabinet", [2.4, 2.1, 1.2], [-6, 1.05, 11.7], new THREE.MeshStandardMaterial({
    color: 0x1c2b24,
    roughness: 0.48,
    metalness: 0.28,
  }));
  addCollider([-6, 1.05, 11.7], [2.7, 2.1, 1.5]);

  for (const z of [-10, -2, 6]) {
    const tray = box("overhead cable tray", [28, 0.16, 0.55], [0, 4.2, z], materials.cable, false, false);
    tray.castShadow = false;
    for (let x = -13; x <= 13; x += 4) {
      box("tray support", [0.08, 1.1, 0.08], [x, 4.65, z], materials.cable, false, false);
    }
  }

  const pipeGeom = new THREE.CylinderGeometry(0.09, 0.09, 29, 16);
  const pipe = new THREE.Mesh(pipeGeom, materials.pipe);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0, 4.55, -7.8);
  pipe.castShadow = true;
  world.add(pipe);

  const doorMat = new THREE.MeshStandardMaterial({ color: 0x19313a, roughness: 0.58 });
  box("secure exit door", [2.2, 3.2, 0.16], [0, 1.6, 14.82], doorMat, true, false);
}

function addIncidentMarkers() {
  for (const ticket of state.tickets) {
    const group = new THREE.Group();
    group.position.copy(ticket.location);
    group.userData.ticket = ticket;

    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 0.04, 40),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(ticket.accent),
        transparent: true,
        opacity: 0.42,
      }),
    );
    marker.position.y = 0.03;
    group.add(marker);

    const beacon = new THREE.PointLight(new THREE.Color(ticket.accent), 1.8, 6);
    beacon.position.set(0, 1.1, 0);
    group.add(beacon);
    group.userData.marker = marker;
    group.userData.beacon = beacon;

    if (ticket.id === "cooling-leak") {
      const puddle = new THREE.Mesh(
        new THREE.CircleGeometry(0.95, 32),
        new THREE.MeshStandardMaterial({
          color: 0x4ca7d4,
          emissive: 0x07344a,
          transparent: true,
          opacity: 0.68,
          roughness: 0.18,
        }),
      );
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(0.25, 0.045, 0);
      group.add(puddle);
      animated.push({
        mesh: puddle,
        update: (t) => {
          puddle.scale.setScalar(1 + Math.sin(t * 2.8) * 0.035);
        },
      });
      for (let i = 0; i < 14; i += 1) {
        const drop = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0x7ccfff }),
        );
        drop.position.set(Math.random() * 0.16 - 0.08, 2.8 - Math.random() * 1.4, Math.random() * 0.16 - 0.08);
        group.add(drop);
        animated.push({
          mesh: drop,
          update: (t) => {
            drop.position.y = 2.85 - ((t * 1.7 + i * 0.19) % 1.45);
          },
        });
      }
    }

    if (ticket.id === "hot-aisle") {
      const heat = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 1.8, 0.18),
        new THREE.MeshBasicMaterial({
          color: 0xff7046,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        }),
      );
      heat.position.y = 1.4;
      group.add(heat);
      animated.push({
        mesh: heat,
        update: (t) => {
          heat.material.opacity = 0.12 + Math.sin(t * 3.2) * 0.04;
          heat.position.y = 1.4 + Math.sin(t * 1.8) * 0.08;
        },
      });
    }

    if (ticket.id === "ups-alarm") {
      const alarm = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 18, 12),
        materials.hazard,
      );
      alarm.position.set(0, 2.45, -0.78);
      group.add(alarm);
      animated.push({
        mesh: alarm,
        update: (t) => {
          alarm.material.emissiveIntensity = Math.sin(t * 8) > 0 ? 1.8 : 0.35;
        },
      });
    }

    if (ticket.id === "pdu-load") {
      const bars = new THREE.Group();
      for (let i = 0; i < 4; i += 1) {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.2 + i * 0.16, 0.08),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0x71f0c6 : 0xffd166 }),
        );
        bar.position.set(-0.36 + i * 0.24, 1.35 + i * 0.08, -0.65);
        bars.add(bar);
      }
      group.add(bars);
    }

    world.add(group);
    interactables.push(group);
    captureIncidentVisual(group);
  }
}

function captureIncidentVisual(target) {
  target.traverse((child) => {
    if (child.material) {
      child.userData.initialMaterial = {
        color: child.material.color?.clone(),
        emissive: child.material.emissive?.clone(),
        emissiveIntensity: child.material.emissiveIntensity,
        opacity: child.material.opacity,
        transparent: child.material.transparent,
      };
    }

    if (child.isLight) {
      child.userData.initialLight = {
        color: child.color.clone(),
        intensity: child.intensity,
        distance: child.distance,
      };
    }
  });
}

function restoreIncidentVisual(target) {
  target.traverse((child) => {
    const initialMaterial = child.userData.initialMaterial;
    if (child.material && initialMaterial) {
      if (initialMaterial.color) child.material.color.copy(initialMaterial.color);
      if (initialMaterial.emissive) child.material.emissive.copy(initialMaterial.emissive);
      child.material.emissiveIntensity = initialMaterial.emissiveIntensity;
      child.material.opacity = initialMaterial.opacity;
      child.material.transparent = initialMaterial.transparent;
    }

    const initialLight = child.userData.initialLight;
    if (child.isLight && initialLight) {
      child.color.copy(initialLight.color);
      child.intensity = initialLight.intensity;
      child.distance = initialLight.distance;
    }
  });
}

function createScene() {
  buildRoom();
  buildDataHall();
  addIncidentMarkers();
}

function startGame({ pointerLock = true } = {}) {
  state.started = true;
  state.paused = false;
  unlockAudio();
  ui.startScreen.classList.add("hidden");
  ui.hud.classList.remove("hidden");
  if (pointerLock) canvas.requestPointerLock?.();
}

function getElapsedShiftMinutes() {
  return Math.max(0, Math.floor(state.minutes - state.startMinutes));
}

function formatClockMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.floor(totalMinutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function recordJournalEntry(ticket, action, actionIndex, { kind = "complete" } = {}) {
  state.journal.push({
    id: `${ticket.id}-${actionIndex}`,
    clock: formatClockMinutes(state.minutes),
    minute: getElapsedShiftMinutes(),
    ticketTitle: ticket.title,
    action,
    kind,
  });
  renderJournal();
}

function renderJournalList(container, { emptyText }) {
  container.innerHTML = "";

  if (state.journal.length === 0) {
    const empty = document.createElement("p");
    empty.className = "journal-empty";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  for (const entry of state.journal) {
    const item = document.createElement("article");
    item.className = `journal-entry ${entry.kind === "error" ? "error" : ""}`;
    item.innerHTML = `
      <time>${entry.clock}</time>
      <div>
        <strong>${entry.kind === "error" ? "Procedure error" : entry.ticketTitle}</strong>
        <p>${entry.action}</p>
      </div>
    `;
    container.append(item);
  }
}

function renderJournal() {
  renderJournalList(ui.journalEntries, { emptyText: "No actions recorded" });
  renderJournalList(ui.scoreJournal, { emptyText: "No actions were completed" });
}

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  state.audio.context ??= new AudioContextConstructor();
  return state.audio.context;
}

function unlockAudio() {
  const context = getAudioContext();
  context?.resume?.();
}

function playCue(kind) {
  state.audio.cueLog.push(kind);

  const context = getAudioContext();
  if (!context || context.state !== "running") return;

  const patterns = {
    "task-complete": [
      { frequency: 523.25, duration: 0.07, type: "triangle", volume: 0.04 },
      { frequency: 659.25, duration: 0.08, type: "triangle", volume: 0.045 },
      { frequency: 783.99, duration: 0.12, type: "triangle", volume: 0.05 },
    ],
    "critical-escalation": [
      { frequency: 196, duration: 0.13, type: "sawtooth", volume: 0.035 },
      { frequency: 155.56, duration: 0.13, type: "sawtooth", volume: 0.04 },
      { frequency: 196, duration: 0.18, type: "sawtooth", volume: 0.035 },
    ],
  };

  let cursor = context.currentTime;
  for (const step of patterns[kind] ?? []) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = step.type;
    oscillator.frequency.setValueAtTime(step.frequency, cursor);
    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.exponentialRampToValueAtTime(step.volume, cursor + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + step.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(cursor);
    oscillator.stop(cursor + step.duration + 0.01);
    cursor += step.duration + 0.045;
  }
}

function updateCameraRotation() {
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function canMoveTo(next) {
  const playerBox = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(next.x, 0.95, next.z),
    new THREE.Vector3(player.radius * 2, 1.9, player.radius * 2),
  );
  return !colliders.some((box3) => box3.intersectsBox(playerBox));
}

function updateMovement(dt) {
  if (!state.started || state.paused) return;
  const direction = getMovementDirection(player.yaw, keys);
  const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const step = direction.multiplyScalar(state.settings.movementSpeed * (sprint ? 1.45 : 1) * dt);
  const nextX = player.position.clone().add(new THREE.Vector3(step.x, 0, 0));
  if (canMoveTo(nextX)) player.position.x = nextX.x;
  const nextZ = player.position.clone().add(new THREE.Vector3(0, 0, step.z));
  if (canMoveTo(nextZ)) player.position.z = nextZ.z;
  player.position.y = 1.72 + Math.sin(clock.elapsedTime * 9) * Math.min(step.length() * 0.14, 0.03);
}

function updateActiveTarget() {
  if (state.finished) return;
  raycaster.setFromCamera(mouseCenter, camera);
  const nearby = interactables
    .filter((target) => !isTicketDone(target.userData.ticket))
    .map((target) => ({
      target,
      distance: target.position.distanceTo(camera.position),
      angle: raycaster.ray.direction.angleTo(
        target.position.clone().sub(camera.position).normalize(),
      ),
    }))
    .filter((entry) => entry.distance < 4.2 && entry.angle < 0.65)
    .sort((a, b) => a.distance - b.distance);

  state.activeTarget = nearby[0]?.target ?? null;
  if (state.activeTarget) {
    ui.interaction.classList.remove("hidden");
    ui.interactionLabel.textContent = state.activeTarget.userData.ticket.label;
  } else {
    ui.interaction.classList.add("hidden");
  }
}

function isTicketDone(ticket) {
  return ticket.completedSteps.size === ticket.actions.length;
}

function getNextRequiredStep(ticket) {
  return ticket.actions.findIndex((_, index) => !ticket.completedSteps.has(index));
}

function getProcedurePenalty() {
  const penalties = {
    training: { health: 3, pressure: 0.15 },
    standard: { health: 5, pressure: 0.25 },
    expert: { health: 7, pressure: 0.35 },
  };
  return penalties[state.settings.difficulty] ?? penalties.standard;
}

function applyProcedureError(ticket, attemptedIndex) {
  const expectedIndex = getNextRequiredStep(ticket);
  const expectedAction = ticket.actions[expectedIndex];
  const attemptedAction = ticket.actions[attemptedIndex];
  const penalty = getProcedurePenalty();

  ticket.procedureErrors += 1;
  ticket.lastProcedureError = `Complete step ${expectedIndex + 1} before step ${attemptedIndex + 1}.`;
  state.health = Math.max(0, state.health - penalty.health);
  recordJournalEntry(
    ticket,
    `${attemptedAction} attempted before ${expectedAction}`,
    attemptedIndex,
    { kind: "error" },
  );
  playCue("critical-escalation");
  renderTickets();
  updateHud();
  if (state.health <= 0) finishShift("Site health reached zero");
}

function completeTicketStep(ticket, index) {
  const action = ticket.actions[index];
  const wasComplete = ticket.completedSteps.has(index);
  const wasDone = isTicketDone(ticket);

  if (wasComplete || wasDone) return;

  const expectedIndex = getNextRequiredStep(ticket);
  if (index !== expectedIndex) {
    applyProcedureError(ticket, index);
    return;
  }

  ticket.completedSteps.add(index);
  ticket.lastProcedureError = null;
  recordJournalEntry(ticket, action, index);

  if (isTicketDone(ticket)) {
    ticket.resolvedAtMinute ??= getElapsedShiftMinutes();
    state.health = Math.min(100, state.health + 8);
    state.temperature = Math.max(21.4, state.temperature - (ticket.id === "hot-aisle" ? 1.2 : 0.25));
    state.pue = Math.max(1.31, state.pue - 0.035);
    markIncidentResolved(ticket);
    playCue("task-complete");
  }
}

function openTask(ticket) {
  if (state.finished) return;
  state.paused = true;
  document.exitPointerLock?.();
  ui.taskType.textContent = ticket.type;
  ui.taskTitle.textContent = ticket.title;
  ui.taskDescription.textContent = ticket.description;
  ui.taskActions.innerHTML = "";

  if (ticket.lastProcedureError && !isTicketDone(ticket)) {
    const alert = document.createElement("div");
    alert.className = "procedure-alert";
    alert.textContent = ticket.lastProcedureError;
    ui.taskActions.append(alert);
  }

  ticket.actions.forEach((action, index) => {
    const button = document.createElement("button");
    const isComplete = ticket.completedSteps.has(index);
    const isNext = index === getNextRequiredStep(ticket);
    button.className = `task-action ${isComplete ? "complete" : ""} ${!isComplete && isNext ? "next" : ""}`;
    button.innerHTML = `<span class="icon">${ticket.completedSteps.has(index) ? "✓" : index + 1}</span><span>${action}</span>`;
    button.addEventListener("click", () => {
      completeTicketStep(ticket, index);
      openTask(ticket);
      renderTickets();
      checkShiftEnd();
    });
    ui.taskActions.append(button);
  });

  ui.taskModal.classList.remove("hidden");
}

function closeTask() {
  if (state.finished) return;
  state.paused = false;
  ui.taskModal.classList.add("hidden");
  if (state.started) canvas.requestPointerLock?.();
}

function openSettings() {
  if (!state.started || state.finished) return;
  state.paused = true;
  document.exitPointerLock?.();
  syncSettingsInputs();
  ui.settingsModal.classList.remove("hidden");
}

function closeSettings() {
  if (state.finished) return;
  state.paused = false;
  ui.settingsModal.classList.add("hidden");
  if (state.started) canvas.requestPointerLock?.();
}

function syncSettingsInputs() {
  ui.mouseSensitivity.value = String(state.settings.mouseSensitivity);
  ui.mouseSensitivityValue.textContent = state.settings.mouseSensitivity.toFixed(1);
  ui.invertY.checked = state.settings.invertY;
  ui.movementSpeed.value = String(state.settings.movementSpeed);
  ui.movementSpeedValue.textContent = state.settings.movementSpeed.toFixed(1);
  syncDifficultyOptions();
}

function updateSettings() {
  state.settings.mouseSensitivity = Number(ui.mouseSensitivity.value);
  state.settings.invertY = ui.invertY.checked;
  state.settings.movementSpeed = Number(ui.movementSpeed.value);
  syncSettingsInputs();
}

function syncDifficultyOptions() {
  ui.difficultyOptions.forEach((button) => {
    const active = button.dataset.difficultyOption === state.settings.difficulty;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setDifficulty(presetId) {
  if (!DIFFICULTY_PRESETS.some((preset) => preset.id === presetId)) return;
  state.settings.difficulty = presetId;
  syncDifficultyOptions();
  renderTickets();
}

function markIncidentResolved(ticket) {
  const target = interactables.find((item) => item.userData.ticket === ticket);
  if (!target) return;
  target.traverse((child) => {
    if (child.material?.color) child.material.color.set(0x71f0c6);
    if (child.material?.emissive) child.material.emissive.set(0x0b3a2b);
  });
}

function updateIncidentVisual(ticket, stage) {
  const target = interactables.find((item) => item.userData.ticket === ticket);
  if (!target || isTicketDone(ticket)) return;

  const stageColor = stage.id === "critical" ? "#f76565" : stage.id === "degraded" ? "#ffd166" : ticket.accent;
  const color = new THREE.Color(stageColor);
  target.userData.marker?.material.color.set(color);
  if (target.userData.marker?.material) {
    target.userData.marker.material.opacity = stage.id === "critical" ? 0.68 : stage.id === "degraded" ? 0.54 : 0.42;
  }
  if (target.userData.beacon) {
    target.userData.beacon.color.set(color);
    target.userData.beacon.intensity = stage.id === "critical" ? 3.4 : stage.id === "degraded" ? 2.5 : 1.8;
    target.userData.beacon.distance = stage.id === "critical" ? 8 : 6;
  }
}

function runIncidents(dt) {
  if (state.finished) return;
  const elapsedMinutes = getElapsedShiftMinutes();
  let ticketStageChanged = false;
  for (const ticket of state.tickets) {
    if (isTicketDone(ticket)) continue;
    const stage = getIncidentStage(elapsedMinutes, false, {
      difficulty: state.settings.difficulty,
    });
    const pressureMultiplier = getIncidentPressureMultiplier(stage.id);
    const procedurePressure = 1 + ticket.procedureErrors * getProcedurePenalty().pressure;
    if (ticket.stage !== stage.id) {
      ticket.stage = stage.id;
      ticketStageChanged = true;
      if (stage.id === "critical") playCue("critical-escalation");
    }
    updateIncidentVisual(ticket, stage);
    state.health -= ticket.penaltyRate * pressureMultiplier * procedurePressure * dt * 0.035;
    ticket.metricEffect(dt * pressureMultiplier * procedurePressure);
  }
  if (ticketStageChanged) renderTickets();
  state.health = THREE.MathUtils.clamp(state.health, 0, 100);
  state.temperature = THREE.MathUtils.clamp(state.temperature, 19, 34);
  state.pue = THREE.MathUtils.clamp(state.pue, 1.25, 2.1);
  state.minutes += dt * 2.6;
  if (state.health <= 0) finishShift("Site health reached zero");
}

function renderTickets() {
  ui.tickets.innerHTML = "";
  for (const ticket of state.tickets) {
    const done = isTicketDone(ticket);
    const item = document.createElement("article");
    item.className = `ticket ${done ? "done" : ""}`;
    item.style.setProperty("--accent", done ? "#6f7d80" : ticket.accent);
    const stage = getIncidentStage(getElapsedShiftMinutes(), done, {
      difficulty: state.settings.difficulty,
    });
    const detail = done
      ? `Resolved in ${formatResponseMinutes(ticket.resolvedAtMinute)}`
      : `${stage.label} - ${ticket.completedSteps.size}/${ticket.actions.length} actions complete${
          ticket.procedureErrors > 0 ? ` - ${ticket.procedureErrors} procedure error${ticket.procedureErrors === 1 ? "" : "s"}` : ""
        }`;
    item.dataset.stage = stage.id;
    item.innerHTML = `
      <strong>${done ? "Resolved" : ticket.type}: ${ticket.title}</strong>
      <p>${detail}</p>
    `;
    ui.tickets.append(item);
  }
  ui.ticketCount.textContent = String(state.tickets.filter((ticket) => !isTicketDone(ticket)).length);
}

function updateCompass() {
  const items = getObjectiveCompassItems({
    playerPosition: player.position,
    yaw: player.yaw,
    tickets: state.tickets.map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      accent: ticket.accent,
      location: ticket.location,
      done: isTicketDone(ticket),
    })),
  });

  ui.compassTrack.innerHTML = "";
  ui.compassHint.textContent = items.length > 0 ? "Nearest incident" : "All incidents clear";

  for (const item of items) {
    const marker = document.createElement("div");
    marker.className = `compass-marker ${item.isBehind ? "behind" : ""}`;
    marker.style.setProperty("--accent", item.accent);
    marker.style.left = `${50 + item.offset * 44}%`;
    marker.title = `${item.title} - ${Math.round(item.distance)}m`;
    marker.innerHTML = `
      <span class="marker-dot"></span>
      <span class="marker-label">${Math.round(item.distance)}m</span>
    `;
    ui.compassTrack.append(marker);
  }
}

function finishShift(reason) {
  if (state.finished) return;

  state.finished = true;
  state.paused = true;
  state.finishReason = reason;
  keys.clear();
  document.exitPointerLock?.();

  const resolvedTickets = state.tickets.filter(isTicketDone).length;
  const averageResponse = calculateAverageResponseMinutes(state.tickets);
  const score = calculateShiftScore({
    health: state.health,
    pue: state.pue,
    temperature: state.temperature,
    resolvedTickets,
    totalTickets: state.tickets.length,
  });

  ui.scoreTitle.textContent = reason;
  ui.scoreValue.textContent = String(score);
  ui.scoreStats.innerHTML = `
    <div><span>Resolved</span><strong>${resolvedTickets}/${state.tickets.length}</strong></div>
    <div><span>Elapsed</span><strong>${getElapsedShiftMinutes()} min</strong></div>
    <div><span>Avg response</span><strong>${formatResponseMinutes(averageResponse)}</strong></div>
    <div><span>Health</span><strong>${Math.round(state.health)}%</strong></div>
    <div><span>Peak temp</span><strong>${state.temperature.toFixed(1)}C</strong></div>
    <div><span>Final PUE</span><strong>${state.pue.toFixed(2)}</strong></div>
  `;
  ui.scoreResponses.innerHTML = state.tickets
    .map(
      (ticket) => `
        <div>
          <span>${ticket.title}</span>
          <strong>${formatResponseMinutes(ticket.resolvedAtMinute)}</strong>
        </div>
      `,
    )
    .join("");
  ui.taskModal.classList.add("hidden");
  ui.settingsModal.classList.add("hidden");
  ui.interaction.classList.add("hidden");
  renderJournal();
  ui.scoreModal.classList.remove("hidden");
}

function checkShiftEnd() {
  if (state.tickets.every(isTicketDone)) {
    finishShift("Shift complete");
  }
}

function resetShift({ pointerLock = true } = {}) {
  Object.assign(state, {
    ...getInitialShiftState(),
    started: true,
    paused: false,
    finished: false,
    finishReason: "",
    activeTarget: null,
    journal: [],
  });

  keys.clear();
  state.audio.cueLog = [];
  unlockAudio();
  player.position.copy(initialPlayerPosition);
  player.velocity.set(0, 0, 0);
  player.yaw = 0;
  player.pitch = 0;
  updateCameraRotation();

  for (const ticket of state.tickets) {
    ticket.completedSteps.clear();
    ticket.procedureErrors = 0;
    ticket.lastProcedureError = null;
    ticket.resolvedAtMinute = null;
    ticket.stage = "watch";
  }

  for (const target of interactables) restoreIncidentVisual(target);

  ui.startScreen.classList.add("hidden");
  ui.hud.classList.remove("hidden");
  ui.taskModal.classList.add("hidden");
  ui.settingsModal.classList.add("hidden");
  ui.scoreModal.classList.add("hidden");
  ui.interaction.classList.add("hidden");

  renderTickets();
  renderJournal();
  updateHud();
  if (pointerLock) canvas.requestPointerLock?.();
}

function updateHud() {
  ui.health.textContent = `${Math.round(state.health)}%`;
  ui.temperature.textContent = `${state.temperature.toFixed(1)}C`;
  ui.pue.textContent = state.pue.toFixed(2);
  ui.clock.textContent = formatClockMinutes(state.minutes);
  updateCompass();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  updateMovement(dt);
  updateActiveTarget();
  if (!state.paused) runIncidents(dt);
  for (const item of animated) item.update(clock.elapsedTime);
  updateHud();
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Escape" && !ui.settingsModal.classList.contains("hidden")) {
    closeSettings();
    return;
  }
  if (event.code === "KeyE" && state.activeTarget && !ui.taskModal.classList.contains("hidden")) {
    return;
  }
  if (event.code === "KeyE" && state.activeTarget) {
    openTask(state.activeTarget.userData.ticket);
  }
  if (event.code === "Escape" && !ui.taskModal.classList.contains("hidden")) {
    closeTask();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("mousemove", (event) => {
  if (!state.started || state.paused || document.pointerLockElement !== canvas) return;
  const sensitivity = state.settings.mouseSensitivity * 0.001;
  player.yaw -= event.movementX * sensitivity;
  player.pitch += event.movementY * (state.settings.invertY ? sensitivity : -sensitivity);
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.25, 1.25);
  updateCameraRotation();
});

canvas.addEventListener("click", () => {
  if (state.started && !state.paused) canvas.requestPointerLock?.();
});

ui.startButton.addEventListener("click", startGame);
ui.closeTask.addEventListener("click", closeTask);
ui.settingsButton.addEventListener("click", openSettings);
ui.closeSettings.addEventListener("click", closeSettings);
ui.mouseSensitivity.addEventListener("input", updateSettings);
ui.invertY.addEventListener("change", updateSettings);
ui.movementSpeed.addEventListener("input", updateSettings);
ui.difficultyOptions.forEach((button) => {
  button.addEventListener("click", () => setDifficulty(button.dataset.difficultyOption));
});
ui.restartShift.addEventListener("click", () => {
  resetShift();
});

if (new URLSearchParams(window.location.search).get("test") === "1") {
  window.__simTest = {
    moveToTicket: (ticketId) => {
      const target = interactables.find((item) => item.userData.ticket.id === ticketId);
      if (!target) return false;
      const offset = new THREE.Vector3(0, 0, 2.4);
      player.position.copy(target.position).add(offset);
      player.position.y = 1.72;
      player.yaw = Math.atan2(player.position.x - target.position.x, player.position.z - target.position.z);
      player.pitch = 0;
      updateCameraRotation();
      updateActiveTarget();
      return Boolean(state.activeTarget);
    },
    finishShift: () => {
      for (const ticket of state.tickets) {
        ticket.actions.forEach((_, index) => ticket.completedSteps.add(index));
        ticket.resolvedAtMinute ??= getElapsedShiftMinutes();
        markIncidentResolved(ticket);
      }
      renderTickets();
      checkShiftEnd();
      return state.finished;
    },
    completeTicket: (ticketId) => {
      const ticket = state.tickets.find((item) => item.id === ticketId);
      if (!ticket) return false;
      ticket.actions.forEach((_, index) => completeTicketStep(ticket, index));
      renderTickets();
      checkShiftEnd();
      return isTicketDone(ticket);
    },
    attemptStep: (ticketId, index) => {
      const ticket = state.tickets.find((item) => item.id === ticketId);
      if (!ticket) return false;
      completeTicketStep(ticket, index);
      if (!ui.taskModal.classList.contains("hidden")) openTask(ticket);
      renderTickets();
      updateHud();
      return true;
    },
    snapshot: () => ({
      health: state.health,
      temperature: state.temperature,
      pue: state.pue,
      minutes: state.minutes,
      finished: state.finished,
      difficulty: state.settings.difficulty,
      ticketStages: state.tickets.map((ticket) => ticket.stage),
      procedureErrors: state.tickets.map((ticket) => ({
        id: ticket.id,
        errors: ticket.procedureErrors,
        lastError: ticket.lastProcedureError,
      })),
      cueLog: [...state.audio.cueLog],
      openTickets: state.tickets.filter((ticket) => !isTicketDone(ticket)).length,
      journalEntries: state.journal.length,
      playerPosition: player.position.toArray(),
    }),
    setElapsedMinutes: (minutes) => {
      state.minutes = state.startMinutes + minutes;
      renderTickets();
      updateHud();
    },
    advanceIncidentsTo: (minutes) => {
      state.minutes = state.startMinutes + minutes;
      runIncidents(0);
      renderTickets();
      updateHud();
    },
  };
}

createScene();
renderTickets();
renderJournal();
syncDifficultyOptions();
updateCameraRotation();
animate();

if (new URLSearchParams(window.location.search).get("autostart") === "1") {
  startGame({ pointerLock: false });
}
