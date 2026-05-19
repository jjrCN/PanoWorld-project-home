import * as THREE from "../vendor/three.module.min.js";

const COMMON_ROTATION = [
  -0.2799965739, 0.0, 0.9600009918,
  -0.9600009918, 0.0, -0.2799965739,
  0.0, -1.0, 0.0
];

const STYLE_FRENCH_LUXURY = "french-luxury";
const STYLE_MODERN_MINIMALIST = "modern-minimalist";
const DEFAULT_STYLE_ID = STYLE_FRENCH_LUXURY;

const PANORAMA_STYLES = {
  [STYLE_FRENCH_LUXURY]: {
    id: STYLE_FRENCH_LUXURY,
    label: "法式轻奢风格",
    buttonLabel: "切换到现代简约风格",
    assetDir: "./assets/panos"
  },
  [STYLE_MODERN_MINIMALIST]: {
    id: STYLE_MODERN_MINIMALIST,
    label: "现代简约风格",
    buttonLabel: "切换到法式轻奢风格",
    assetDir: "./assets/panos-simple"
  }
};

const PANORAMA_STYLE_IDS = [STYLE_FRENCH_LUXURY, STYLE_MODERN_MINIMALIST];

const VIEWPOINTS = [
  { id: "0000", position: [0.7237534, -1.055, 1.35], rotation: COMMON_ROTATION },
  { id: "0001", position: [-0.7762466073, -1.0549999475, 1.3500000238], rotation: COMMON_ROTATION },
  { id: "0003", position: [0.7237533927, 0.4449999928, 1.3500000238], rotation: COMMON_ROTATION },
  { id: "0007", position: [2.2237534523, 0.4449999928, 1.3500000238], rotation: COMMON_ROTATION },
  { id: "0008", position: [-2.2762465477, -1.0549999475, 1.3500000238], rotation: COMMON_ROTATION },
  { id: "0009", position: [0.7237533927, 1.9450000525, 1.3500000238], rotation: COMMON_ROTATION },
  { id: "0012", position: [3.7237534523, 0.4449999928, 1.3500000238], rotation: COMMON_ROTATION },
  { id: "0014", position: [5.2237534523, -1.0549999475, 1.3500000238], rotation: COMMON_ROTATION },
  { id: "0015", position: [0.7237533927, 3.4449999332, 1.3500000238], rotation: COMMON_ROTATION },
  { id: "0016", position: [5.2237534523, -2.5550000668, 1.3500000238], rotation: COMMON_ROTATION },
  { id: "0019", position: [-3.7762465477, 1.9450000525, 1.3500000238], rotation: COMMON_ROTATION },
  { id: "0021", position: [-5.2762465477, 0.4449999928, 1.3500000238], rotation: COMMON_ROTATION },
  { id: "0022", position: [6.7237534523, 0.4449999928, 1.3500000238], rotation: COMMON_ROTATION }
];

const MINIMAP_MARKERS = new Map([
  ["0000", { xPct: 53.333, yPct: 63.583, labelClass: "label-bottom-right" }],
  ["0001", { xPct: 46.444, yPct: 63.583, labelClass: "label-bottom" }],
  ["0003", { xPct: 53.222, yPct: 54.0, labelClass: "label-left" }],
  ["0007", { xPct: 59.944, yPct: 54.0, labelClass: "label-top" }],
  ["0008", { xPct: 39.722, yPct: 63.583, labelClass: "label-bottom-left" }],
  ["0009", { xPct: 53.222, yPct: 44.917, labelClass: "label-left" }],
  ["0012", { xPct: 66.611, yPct: 54.0, labelClass: "label-bottom" }],
  ["0014", { xPct: 73.778, yPct: 63.583, labelClass: "label-right" }],
  ["0015", { xPct: 53.056, yPct: 35.917, labelClass: "label-top-right" }],
  ["0016", { xPct: 73.778, yPct: 71.333, labelClass: "label-bottom" }],
  ["0019", { xPct: 33.611, yPct: 44.917, labelClass: "label-top" }],
  ["0021", { xPct: 26.5, yPct: 54.0, labelClass: "label-bottom-left" }],
  ["0022", { xPct: 79.944, yPct: 54.0, labelClass: "label-top" }]
]);

const VIEWPOINT_MAP = new Map(VIEWPOINTS.map((node) => [node.id, node]));
const START_VIEWPOINT_ID = "0000";
const START_VIEWPOINT_TARGET_ID = "0016";
const PANORAMA_CROSSFADE_DURATION_MS = 520;
const MAX_TEXTURE_CACHE_SIZE = 8;
const VIEWER_FORWARD = new THREE.Vector3(1, 0, 0);
const ANALYTICS_ENDPOINTS = {
  stats: "./api/stats",
  like: "./api/like"
};

function scheduleIdleTask(callback, timeout) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: timeout || 1200 });
    return;
  }

  window.setTimeout(callback, timeout || 1200);
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function getStyleConfig(styleId) {
  return PANORAMA_STYLES[styleId] || PANORAMA_STYLES[DEFAULT_STYLE_ID];
}

function getAlternateStyleId(styleId) {
  return styleId === STYLE_FRENCH_LUXURY ? STYLE_MODERN_MINIMALIST : STYLE_FRENCH_LUXURY;
}

function getPanoramaImagePath(styleId, nodeId) {
  return getStyleConfig(styleId).assetDir + "/" + nodeId + ".webp";
}

function getTextureKey(styleId, nodeId) {
  return styleId + ":" + nodeId;
}

function formatShortViewpointId(id) {
  return String(Number.parseInt(id, 10)).padStart(2, "0");
}

function vecLength(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalizeVec(vector) {
  const length = vecLength(vector) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function subtractVec(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function addVec(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVec(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function multiplyMat3Vec3(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
  ];
}

function multiplyMat3TransposeVec3(m, v) {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2]
  ];
}

function cameraToViewerVector(cameraVector) {
  return [cameraVector[2], -cameraVector[1], cameraVector[0]];
}

function viewerToCameraVector(viewerVector) {
  return [viewerVector[2], -viewerVector[1], viewerVector[0]];
}

function worldDirectionToViewerVector(node, worldDirection) {
  return normalizeVec(
    cameraToViewerVector(multiplyMat3TransposeVec3(node.rotation, worldDirection))
  );
}

function viewerDirectionToWorldVector(node, viewerDirection) {
  return normalizeVec(
    multiplyMat3Vec3(node.rotation, viewerToCameraVector(viewerDirection))
  );
}

function viewerDirectionToHotspotVector(viewerDirection) {
  return [-viewerDirection[0], viewerDirection[1], -viewerDirection[2]];
}

function viewerDirectionToAngles(viewerDirection) {
  return {
    yaw: Math.atan2(viewerDirection[2], viewerDirection[0]),
    pitch: Math.asin(clamp(viewerDirection[1], -1, 1))
  };
}

function anglesToViewerDirection(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [cp * Math.cos(yaw), Math.sin(pitch), cp * Math.sin(yaw)];
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function computeDefaultAngles(node) {
  if (node.id === START_VIEWPOINT_ID) {
    const targetNode = VIEWPOINT_MAP.get(START_VIEWPOINT_TARGET_ID);
    if (targetNode) {
      const startDelta = subtractVec(targetNode.position, node.position);
      const startAngles = viewerDirectionToAngles(worldDirectionToViewerVector(node, startDelta));
      return {
        yaw: wrapAngle(startAngles.yaw + Math.PI),
        pitch: startAngles.pitch
      };
    }
  }

  const others = VIEWPOINTS.filter((item) => item.id !== node.id);
  if (!others.length) {
    return { yaw: 0, pitch: 0 };
  }

  const centroid = others.reduce((acc, item) => addVec(acc, item.position), [0, 0, 0]);
  const worldTarget = scaleVec(centroid, 1 / others.length);
  const delta = subtractVec(worldTarget, node.position);
  return viewerDirectionToAngles(worldDirectionToViewerVector(node, delta));
}

function createHotspotTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.beginPath();
  context.arc(64, 64, 34, 0, Math.PI * 2);
  context.fillStyle = "rgba(255, 255, 255, 0.16)";
  context.fill();

  context.beginPath();
  context.arc(64, 64, 28, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  context.lineWidth = 6;
  context.stroke();

  context.beginPath();
  context.arc(64, 64, 10, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.fill();

  return new THREE.CanvasTexture(canvas);
}

function initPanoramaTour() {
  const stage = document.getElementById("pano-tour-stage");
  if (!stage) {
    return;
  }

  const loading = document.getElementById("pano-tour-loading");
  const currentLabel = document.getElementById("pano-tour-current");
  const styleLabel = document.getElementById("pano-tour-style");
  const styleToggleButton = document.getElementById("pano-tour-style-toggle");
  const likeButton = document.getElementById("pano-tour-like-toggle");
  const likeLabel = document.getElementById("pano-tour-like-label");
  const likeCount = document.getElementById("pano-tour-like-count");
  const minimap = document.getElementById("pano-tour-map");
  const minimapMarkers = document.getElementById("pano-tour-map-markers");
  const hotspotOverlay = document.getElementById("pano-tour-hotspots");
  const tooltip = document.getElementById("pano-tour-tooltip");

  let renderer;
  let scene;
  let camera;
  let sphereGeometry;
  let sphereA;
  let sphereB;
  let activeSphere;
  let standbySphere;
  let hotspotGroup;
  let hotspotTexture;
  let raycaster;
  let hoverHotspot = null;
  let hoverHotspotId = null;
  let currentViewpointId = START_VIEWPOINT_ID;
  let currentStyleId = DEFAULT_STYLE_ID;
  let yaw = 0;
  let pitch = 0;
  let defaultAngles = { yaw: 0, pitch: 0 };
  let isPointerDown = false;
  let hasDragged = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerYaw = 0;
  let pointerPitch = 0;
  let transition = null;
  let isSwitching = false;
  let initialized = false;
  let animationFrameId = null;
  let likeRequestInFlight = false;
  const textureLoader = new THREE.TextureLoader();
  const textureEntries = new Map();
  const minimapButtons = new Map();
  const hotspotButtons = new Map();
  const interactiveHotspotIds = new Set();
  const visibleHotspotIds = new Set();
  const analyticsState = {
    liked: false,
    likesCount: 0
  };
  const pointer = new THREE.Vector2();
  const cameraDirection = new THREE.Vector3();
  const projectedPoint = new THREE.Vector3();

  function showLoading(message) {
    if (message) {
      loading.lastElementChild.textContent = message;
    }
    loading.classList.remove("is-hidden");
  }

  function hideLoading() {
    loading.classList.add("is-hidden");
  }

  function updateMinimapHighlightState() {
    minimapButtons.forEach((button, buttonId) => {
      button.classList.toggle("is-active", buttonId === currentViewpointId);
      button.classList.toggle("is-preview", buttonId === hoverHotspotId);
    });
  }

  function setCurrentLabel(id) {
    currentLabel.textContent = "点位 " + id;
    updateMinimapHighlightState();
  }

  function updateStyleUI() {
    const styleConfig = getStyleConfig(currentStyleId);
    if (styleLabel) {
      styleLabel.textContent = styleConfig.label;
    }
    if (styleToggleButton) {
      styleToggleButton.textContent = styleConfig.buttonLabel;
      styleToggleButton.setAttribute("aria-label", styleConfig.buttonLabel);
    }
  }

  function updateLikeButtonUI() {
    if (!likeButton) {
      return;
    }

    const actionLabel = analyticsState.liked ? "已点赞" : "点赞";
    likeButton.classList.toggle("is-liked", analyticsState.liked);
    likeButton.classList.toggle("is-busy", likeRequestInFlight);
    likeButton.disabled = likeRequestInFlight;
    likeButton.setAttribute("aria-pressed", analyticsState.liked ? "true" : "false");
    likeButton.title = analyticsState.liked ? "取消点赞" : "点赞";
    likeButton.setAttribute(
      "aria-label",
      (analyticsState.liked ? "取消点赞" : "点赞") + "，当前共有 " + analyticsState.likesCount + " 个赞"
    );

    if (likeLabel) {
      likeLabel.textContent = actionLabel;
    }
    if (likeCount) {
      likeCount.textContent = String(analyticsState.likesCount);
    }
  }

  function applyAnalyticsPayload(payload) {
    if (!payload || !payload.likes) {
      return;
    }

    analyticsState.liked = Boolean(payload.likes.liked);
    analyticsState.likesCount = Number(payload.likes.count || 0);
    updateLikeButtonUI();
  }

  async function requestAnalytics(url, options) {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      },
      ...options
    });

    if (!response.ok) {
      throw new Error("Analytics request failed: " + response.status);
    }

    return response.json();
  }

  async function syncAnalytics() {
    try {
      const payload = await requestAnalytics(ANALYTICS_ENDPOINTS.stats);
      applyAnalyticsPayload(payload);
    } catch (error) {
      console.error("Failed to fetch analytics stats.", error);
    }
  }

  function bindStyleToggleControl() {
    if (!styleToggleButton) {
      return;
    }

    ["pointerdown", "pointermove", "pointerup"].forEach((eventName) => {
      styleToggleButton.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    });

    styleToggleButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      switchStyle(getAlternateStyleId(currentStyleId));
      setTooltip(null);
    });
  }

  function bindLikeControl() {
    if (!likeButton) {
      return;
    }

    ["pointerdown", "pointermove", "pointerup"].forEach((eventName) => {
      likeButton.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    });

    likeButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (likeRequestInFlight) {
        return;
      }

      likeRequestInFlight = true;
      updateLikeButtonUI();

      try {
        const payload = await requestAnalytics(ANALYTICS_ENDPOINTS.like, {
          method: "POST"
        });
        applyAnalyticsPayload(payload);
      } catch (error) {
        console.error("Failed to toggle like state.", error);
      } finally {
        likeRequestInFlight = false;
        updateLikeButtonUI();
      }
    });
  }

  function bindMinimapControl() {
    if (!minimap) {
      return;
    }

    ["pointerdown", "pointermove", "pointerup", "click", "wheel"].forEach((eventName) => {
      minimap.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    });
  }

  function setHoveredHotspot(sprite, hotspotId) {
    hoverHotspot = sprite || null;
    hoverHotspotId = hotspotId || (sprite ? sprite.userData.id : null);
    updateMinimapHighlightState();
    updateHotspotHoverState();
  }

  function setTooltip(sprite) {
    setHoveredHotspot(sprite, sprite ? sprite.userData.id : null);
    tooltip.hidden = !sprite;
    stage.style.cursor = sprite ? "pointer" : (isPointerDown ? "grabbing" : "grab");
  }

  function updateTooltipPosition() {
    if (!hoverHotspot || tooltip.hidden) {
      return;
    }

    const projected = hoverHotspot.position.clone().project(camera);
    const rect = stage.getBoundingClientRect();
    const x = ((projected.x + 1) / 2) * rect.width;
    const y = ((-projected.y + 1) / 2) * rect.height;

    tooltip.textContent = "跳转到点位 " + hoverHotspot.userData.id;
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function setPointerFromEvent(event) {
    const rect = stage.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function ensureHotspotButton(id) {
    if (hotspotButtons.has(id)) {
      return hotspotButtons.get(id);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "pano-tour-hotspot-button";
    button.hidden = true;
    button.title = "跳转到点位 " + id;
    button.setAttribute("aria-label", "跳转到点位 " + id);
    button.innerHTML = [
      '<span class="pano-tour-hotspot-ring pano-tour-hotspot-ring--outer" aria-hidden="true"></span>',
      '<span class="pano-tour-hotspot-ring pano-tour-hotspot-ring--inner" aria-hidden="true"></span>',
      '<span class="pano-tour-hotspot-core" aria-hidden="true"></span>'
    ].join("");

    button.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    button.addEventListener("pointermove", (event) => {
      event.stopPropagation();
    });

    button.addEventListener("pointerup", (event) => {
      event.stopPropagation();
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      switchViewpoint(id, true);
    });

    button.addEventListener("mouseenter", () => {
      setHoveredHotspot(null, id);
      stage.style.cursor = "pointer";
      tooltip.hidden = false;
      tooltip.textContent = "跳转到点位 " + id;
      tooltip.style.left = button.style.left;
      tooltip.style.top = button.style.top;
    });

    button.addEventListener("mouseleave", () => {
      setHoveredHotspot(null, null);
      stage.style.cursor = isPointerDown ? "grabbing" : "grab";
      tooltip.hidden = true;
    });

    hotspotOverlay.appendChild(button);
    hotspotButtons.set(id, button);
    return button;
  }

  function applyCameraOrientation() {
    const direction = anglesToViewerDirection(yaw, pitch);
    camera.lookAt(direction[0], direction[1], direction[2]);
  }

  function createScene() {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    renderer.setClearColor(0x0b1220, 1);
    stage.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(72, stage.clientWidth / stage.clientHeight, 0.1, 120);
    camera.position.set(0, 0, 0);
    camera.up.set(0, 1, 0);

    sphereGeometry = new THREE.SphereGeometry(50, 72, 48);
    sphereGeometry.scale(-1, 1, 1);

    const materialA = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, depthWrite: false });
    const materialB = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

    sphereA = new THREE.Mesh(sphereGeometry, materialA);
    sphereB = new THREE.Mesh(sphereGeometry, materialB);
    sphereA.renderOrder = 0;
    sphereB.renderOrder = 1;
    sphereB.visible = false;

    scene.add(sphereA);
    scene.add(sphereB);

    activeSphere = sphereA;
    standbySphere = sphereB;

    hotspotGroup = new THREE.Group();
    hotspotGroup.renderOrder = 20;
    scene.add(hotspotGroup);

    hotspotTexture = createHotspotTexture();
    hotspotTexture.colorSpace = THREE.SRGBColorSpace;

    raycaster = new THREE.Raycaster();
  }

  function createHotspotSprite(targetNode, direction, distance) {
    const material = new THREE.SpriteMaterial({
      map: hotspotTexture,
      transparent: true,
      color: new THREE.Color("#7ad3ff"),
      depthTest: false,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(material);
    const hotspotDirection = viewerDirectionToHotspotVector(direction);
    sprite.position.set(
      hotspotDirection[0],
      hotspotDirection[1],
      hotspotDirection[2]
    ).multiplyScalar(9.5);
    sprite.renderOrder = 20;
    sprite.frustumCulled = false;
    const scale = clamp(1.64 - distance * 0.14, 0.8, 1.26);
    sprite.scale.set(scale, scale, scale);
    const buttonScale = clamp(1.58 - distance * 0.12, 0.62, 1.4);
    sprite.userData = {
      id: targetNode.id,
      baseScale: scale,
      buttonScale,
      distance
    };
    return sprite;
  }

  function rebuildHotspots() {
    while (hotspotGroup.children.length) {
      const child = hotspotGroup.children[0];
      hotspotGroup.remove(child);
      child.material.dispose();
    }

    const currentNode = VIEWPOINT_MAP.get(currentViewpointId);
    VIEWPOINTS.forEach((targetNode) => {
      if (targetNode.id === currentViewpointId) {
        return;
      }

      const delta = subtractVec(targetNode.position, currentNode.position);
      const direction = worldDirectionToViewerVector(currentNode, delta);
      const distance = vecLength(delta);
      hotspotGroup.add(createHotspotSprite(targetNode, direction, distance));
    });
  }

  function updateHotspotHoverState() {
    if (!hotspotGroup) {
      return;
    }

    hotspotGroup.children.forEach((sprite) => {
      const isHovered = hoverHotspotId === sprite.userData.id;
      const targetScale = sprite.userData.baseScale * (isHovered ? 1.18 : 1);
      sprite.scale.set(targetScale, targetScale, targetScale);
      sprite.material.color.set(isHovered ? "#ffcf70" : "#7ad3ff");
    });
  }

  function updateHotspotButtons() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const activeIds = new Set();
    const visibleEntries = [];
    const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
    const overlapBaseRadius = rootFontSize * 1.43;

    interactiveHotspotIds.clear();
    visibleHotspotIds.clear();

    camera.getWorldDirection(cameraDirection);

    hotspotGroup.children.forEach((sprite) => {
      const id = sprite.userData.id;
      const button = ensureHotspotButton(id);
      const facingScore = sprite.position.clone().normalize().dot(cameraDirection);
      projectedPoint.copy(sprite.position).project(camera);

      activeIds.add(id);

      const isVisible = (
        hotspotGroup.visible &&
        !transition &&
        facingScore > 0.04 &&
        projectedPoint.z > -1 &&
        projectedPoint.z < 1 &&
        projectedPoint.x > -1.12 &&
        projectedPoint.x < 1.12 &&
        projectedPoint.y > -1.12 &&
        projectedPoint.y < 1.12
      );

      if (!isVisible) {
        if (tooltip.textContent === "跳转到点位 " + id) {
          tooltip.hidden = true;
        }
        button.hidden = true;
        button.style.pointerEvents = "none";
        button.tabIndex = -1;
        button.setAttribute("aria-disabled", "true");
        return;
      }

      button.hidden = false;
      const screenX = ((projectedPoint.x + 1) / 2) * width;
      const screenY = ((-projectedPoint.y + 1) / 2) * height;
      button.style.left = screenX + "px";
      button.style.top = screenY + "px";
      button.style.zIndex = String(1000 - Math.round(sprite.userData.distance * 100));
      button.style.setProperty("--pano-hotspot-scale", String(sprite.userData.buttonScale));

      visibleHotspotIds.add(id);
      visibleEntries.push({
        id,
        button,
        sprite,
        distance: sprite.userData.distance,
        x: screenX,
        y: screenY,
        radius: overlapBaseRadius * sprite.userData.buttonScale
      });
    });

    visibleEntries.sort((a, b) => a.distance - b.distance);

    const clickableEntries = [];
    visibleEntries.forEach((entry) => {
      const blockedByNearer = clickableEntries.some((otherEntry) => {
        const dx = entry.x - otherEntry.x;
        const dy = entry.y - otherEntry.y;
        return Math.hypot(dx, dy) < entry.radius + otherEntry.radius;
      });

      entry.button.style.pointerEvents = blockedByNearer ? "none" : "auto";
      entry.button.tabIndex = blockedByNearer ? -1 : 0;
      entry.button.setAttribute("aria-disabled", blockedByNearer ? "true" : "false");

      if (blockedByNearer) {
        if (hoverHotspotId === entry.id) {
          setTooltip(null);
        }
        return;
      }

      interactiveHotspotIds.add(entry.id);
      clickableEntries.push(entry);
    });

    hotspotButtons.forEach((button, id) => {
      if (!activeIds.has(id)) {
        button.hidden = true;
        button.style.pointerEvents = "none";
        button.tabIndex = -1;
        button.setAttribute("aria-disabled", "true");
      }
    });
  }

  function updateDefaultView() {
    defaultAngles = computeDefaultAngles(VIEWPOINT_MAP.get(currentViewpointId));
  }

  function loadTextureForNode(styleId, nodeId) {
    const textureKey = getTextureKey(styleId, nodeId);
    const existing = textureEntries.get(textureKey);
    if (existing && existing.texture) {
      existing.lastUsed = performance.now();
      return Promise.resolve(existing.texture);
    }
    if (existing && existing.promise) {
      return existing.promise;
    }

    const entry = existing || { texture: null, promise: null, lastUsed: performance.now() };
    entry.promise = textureLoader.loadAsync(getPanoramaImagePath(styleId, nodeId)).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      entry.texture = texture;
      entry.promise = null;
      entry.lastUsed = performance.now();
      return texture;
    });
    textureEntries.set(textureKey, entry);
    return entry.promise;
  }

  function pruneTextureCache() {
    if (textureEntries.size <= MAX_TEXTURE_CACHE_SIZE) {
      return;
    }

    const keepKeys = new Set([
      getTextureKey(currentStyleId, currentViewpointId),
      getTextureKey(getAlternateStyleId(currentStyleId), currentViewpointId)
    ]);
    const entries = Array.from(textureEntries.entries()).sort((a, b) => b[1].lastUsed - a[1].lastUsed);

    entries.forEach(([textureKey, entry], index) => {
      if (keepKeys.has(textureKey) || index < MAX_TEXTURE_CACHE_SIZE || !entry.texture) {
        return;
      }
      entry.texture.dispose();
      textureEntries.delete(textureKey);
    });
  }

  function prefetchPanoramaImages() {
    scheduleIdleTask(() => {
      PANORAMA_STYLE_IDS.forEach((styleId, styleIndex) => {
        VIEWPOINTS.forEach((node, nodeIndex) => {
          window.setTimeout(() => {
            const image = new Image();
            image.decoding = "async";
            image.src = getPanoramaImagePath(styleId, node.id);
          }, styleIndex * 1400 + nodeIndex * 180);
        });
      });
    }, 1200);
  }

  function prefetchAlternateStyleCurrentViewpoint() {
    scheduleIdleTask(() => {
      loadTextureForNode(getAlternateStyleId(currentStyleId), currentViewpointId).catch(() => {});
    }, 1500);
  }

  function buildMinimap() {
    if (!minimapMarkers) {
      return;
    }

    const fragment = document.createDocumentFragment();
    VIEWPOINTS.forEach((node) => {
      const marker = MINIMAP_MARKERS.get(node.id);
      if (!marker) {
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "pano-tour-map-marker";
      if (marker.labelClass) {
        button.classList.add(marker.labelClass);
      }
      button.title = "在户型图中跳转到点位 " + node.id;
      button.setAttribute("aria-label", "在户型图中跳转到点位 " + node.id);
      button.style.left = marker.xPct + "%";
      button.style.top = marker.yPct + "%";
      button.innerHTML = [
        '<span class="pano-tour-map-marker-dot" aria-hidden="true"></span>',
        '<span class="pano-tour-map-marker-id" aria-hidden="true">' + formatShortViewpointId(node.id) + "</span>"
      ].join("");

      ["pointerdown", "pointermove", "pointerup"].forEach((eventName) => {
        button.addEventListener(eventName, (event) => {
          event.stopPropagation();
        });
      });

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!initialized) {
          boot().then(() => {
            switchViewpoint(node.id, true);
          });
          return;
        }
        switchViewpoint(node.id, true);
      });

      minimapButtons.set(node.id, button);
      fragment.appendChild(button);
    });

    minimapMarkers.innerHTML = "";
    minimapMarkers.appendChild(fragment);
  }

  function computePreservedAngles(nextNodeId) {
    const currentNode = VIEWPOINT_MAP.get(currentViewpointId);
    const nextNode = VIEWPOINT_MAP.get(nextNodeId);
    const worldDirection = viewerDirectionToWorldVector(currentNode, anglesToViewerDirection(yaw, pitch));
    return viewerDirectionToAngles(worldDirectionToViewerVector(nextNode, worldDirection));
  }

  function startCrossFade(texture, nextNodeId, nextAngles, nextStyleId) {
    standbySphere.material.map = texture;
    standbySphere.material.needsUpdate = true;
    standbySphere.material.opacity = 0;
    standbySphere.visible = true;

    currentViewpointId = nextNodeId;
    currentStyleId = nextStyleId;
    yaw = nextAngles.yaw;
    pitch = nextAngles.pitch;
    applyCameraOrientation();
    updateDefaultView();
    setCurrentLabel(currentViewpointId);
    updateStyleUI();

    setTooltip(null);
    hotspotGroup.visible = false;

    transition = {
      startedAt: performance.now(),
      duration: PANORAMA_CROSSFADE_DURATION_MS,
      from: activeSphere,
      to: standbySphere
    };
  }

  async function switchViewpoint(nextNodeId, preserveOrientation) {
    if (isSwitching || nextNodeId === currentViewpointId || !VIEWPOINT_MAP.has(nextNodeId)) {
      return;
    }

    isSwitching = true;
    showLoading("正在加载点位 " + nextNodeId + "...");

    const nextAngles = preserveOrientation ? computePreservedAngles(nextNodeId) : computeDefaultAngles(VIEWPOINT_MAP.get(nextNodeId));
    try {
      const texture = await loadTextureForNode(currentStyleId, nextNodeId);
      hideLoading();
      startCrossFade(texture, nextNodeId, nextAngles, currentStyleId);
    } catch (error) {
      console.error(error);
      showLoading("无法加载点位 " + nextNodeId);
      window.setTimeout(hideLoading, 1400);
      isSwitching = false;
    }
  }

  async function switchStyle(nextStyleId) {
    if (isSwitching || nextStyleId === currentStyleId || !PANORAMA_STYLES[nextStyleId]) {
      return;
    }

    isSwitching = true;
    showLoading("正在切换到" + getStyleConfig(nextStyleId).label + "...");

    try {
      const texture = await loadTextureForNode(nextStyleId, currentViewpointId);
      hideLoading();
      startCrossFade(texture, currentViewpointId, { yaw, pitch }, nextStyleId);
    } catch (error) {
      console.error(error);
      showLoading("无法加载" + getStyleConfig(nextStyleId).label);
      window.setTimeout(hideLoading, 1400);
      isSwitching = false;
    }
  }

  function handleClick(event) {
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(hotspotGroup.children, false);
    const interactiveIntersection = intersections.find((intersection) => (
      visibleHotspotIds.has(intersection.object.userData.id) &&
      interactiveHotspotIds.has(intersection.object.userData.id)
    ));
    if (interactiveIntersection) {
      switchViewpoint(interactiveIntersection.object.userData.id, true);
    }
  }

  function updateHoverFromEvent(event) {
    if (isPointerDown || transition) {
      setTooltip(null);
      return;
    }

    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(hotspotGroup.children, false);
    const interactiveIntersection = intersections.find((intersection) => (
      visibleHotspotIds.has(intersection.object.userData.id) &&
      interactiveHotspotIds.has(intersection.object.userData.id)
    ));
    setTooltip(interactiveIntersection ? interactiveIntersection.object : null);
  }

  function resize() {
    if (!renderer || !camera) {
      return;
    }
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
  }

  function animate(now) {
    animationFrameId = window.requestAnimationFrame(animate);

    if (transition) {
      const progress = clamp((now - transition.startedAt) / transition.duration, 0, 1);
      const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);
      transition.from.material.opacity = 1 - eased;
      transition.to.material.opacity = eased;

      if (progress >= 1) {
        transition.from.material.opacity = 0;
        transition.from.visible = false;
        transition.to.material.opacity = 1;
        transition.to.visible = true;
        activeSphere = transition.to;
        standbySphere = transition.from;
        transition = null;
        rebuildHotspots();
        hotspotGroup.visible = true;
        isSwitching = false;
        pruneTextureCache();
        prefetchAlternateStyleCurrentViewpoint();
      }
    }

    updateHotspotHoverState();
    updateHotspotButtons();
    updateTooltipPosition();
    renderer.render(scene, camera);
  }

  function bindEvents() {
    stage.addEventListener("pointerdown", (event) => {
      if (isSwitching) {
        return;
      }
      isPointerDown = true;
      hasDragged = false;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      pointerYaw = yaw;
      pointerPitch = pitch;
      stage.classList.add("is-dragging");
      stage.setPointerCapture(event.pointerId);
      setTooltip(null);
    });

    stage.addEventListener("pointermove", (event) => {
      if (isPointerDown) {
        const dx = event.clientX - pointerStartX;
        const dy = event.clientY - pointerStartY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          hasDragged = true;
        }
        yaw = pointerYaw - dx * 0.0055;
        pitch = clamp(pointerPitch + dy * 0.0036, -1.2, 1.2);
        applyCameraOrientation();
      } else {
        updateHoverFromEvent(event);
      }
    });

    stage.addEventListener("pointerup", (event) => {
      if (!isPointerDown) {
        return;
      }
      stage.releasePointerCapture(event.pointerId);
      stage.classList.remove("is-dragging");
      isPointerDown = false;

      if (!hasDragged && !isSwitching) {
        handleClick(event);
      } else {
        updateHoverFromEvent(event);
      }
    });

    stage.addEventListener("pointerleave", () => {
      if (!isPointerDown) {
        setTooltip(null);
      }
    });

    stage.addEventListener("wheel", (event) => {
      event.preventDefault();
      camera.fov = clamp(camera.fov + event.deltaY * 0.018, 42, 88);
      camera.updateProjectionMatrix();
    }, { passive: false });

    window.addEventListener("resize", resize);
  }

  async function boot() {
    if (initialized) {
      return;
    }
    initialized = true;

    createScene();
    bindStyleToggleControl();
    bindEvents();
    resize();

    const startNode = VIEWPOINT_MAP.get(START_VIEWPOINT_ID);
    defaultAngles = computeDefaultAngles(startNode);
    yaw = defaultAngles.yaw;
    pitch = defaultAngles.pitch;
    applyCameraOrientation();
    updateStyleUI();

    showLoading("正在加载全景漫游...");
    try {
      const texture = await loadTextureForNode(currentStyleId, START_VIEWPOINT_ID);
      activeSphere.material.map = texture;
      activeSphere.material.needsUpdate = true;
      activeSphere.visible = true;
      rebuildHotspots();
      setCurrentLabel(currentViewpointId);
      hideLoading();
      prefetchPanoramaImages();
      prefetchAlternateStyleCurrentViewpoint();
      animate(performance.now());
    } catch (error) {
      console.error(error);
      showLoading("全景漫游初始化失败。");
    }
  }

  buildMinimap();
  bindMinimapControl();
  bindLikeControl();
  updateStyleUI();
  updateLikeButtonUI();
  setCurrentLabel(currentViewpointId);
  syncAnalytics();

  boot();

  window.addEventListener("beforeunload", () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
    }
  });
}

document.addEventListener("DOMContentLoaded", initPanoramaTour);
