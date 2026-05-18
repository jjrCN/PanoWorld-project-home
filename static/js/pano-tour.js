import * as THREE from "../vendor/three.module.min.js";

const COMMON_ROTATION = [
  -0.2799965739, 0.0, 0.9600009918,
  -0.9600009918, 0.0, -0.2799965739,
  0.0, -1.0, 0.0
];

const VIEWPOINTS = [
  { id: "0000", position: [0.7237534, -1.055, 1.35], image: "./assets/panos/0000.webp", rotation: COMMON_ROTATION },
  { id: "0001", position: [-0.7762466073, -1.0549999475, 1.3500000238], image: "./assets/panos/0001.webp", rotation: COMMON_ROTATION },
  { id: "0003", position: [0.7237533927, 0.4449999928, 1.3500000238], image: "./assets/panos/0003.webp", rotation: COMMON_ROTATION },
  { id: "0007", position: [2.2237534523, 0.4449999928, 1.3500000238], image: "./assets/panos/0007.webp", rotation: COMMON_ROTATION },
  { id: "0008", position: [-2.2762465477, -1.0549999475, 1.3500000238], image: "./assets/panos/0008.webp", rotation: COMMON_ROTATION },
  { id: "0009", position: [0.7237533927, 1.9450000525, 1.3500000238], image: "./assets/panos/0009.webp", rotation: COMMON_ROTATION },
  { id: "0012", position: [3.7237534523, 0.4449999928, 1.3500000238], image: "./assets/panos/0012.webp", rotation: COMMON_ROTATION },
  { id: "0014", position: [5.2237534523, -1.0549999475, 1.3500000238], image: "./assets/panos/0014.webp", rotation: COMMON_ROTATION },
  { id: "0015", position: [0.7237533927, 3.4449999332, 1.3500000238], image: "./assets/panos/0015.webp", rotation: COMMON_ROTATION },
  { id: "0016", position: [5.2237534523, -2.5550000668, 1.3500000238], image: "./assets/panos/0016.webp", rotation: COMMON_ROTATION },
  { id: "0019", position: [-3.7762465477, 1.9450000525, 1.3500000238], image: "./assets/panos/0019.webp", rotation: COMMON_ROTATION },
  { id: "0021", position: [-5.2762465477, 0.4449999928, 1.3500000238], image: "./assets/panos/0021.webp", rotation: COMMON_ROTATION },
  { id: "0022", position: [6.7237534523, 0.4449999928, 1.3500000238], image: "./assets/panos/0022.webp", rotation: COMMON_ROTATION }
];

const VIEWPOINT_MAP = new Map(VIEWPOINTS.map((node) => [node.id, node]));
const START_VIEWPOINT_ID = "0003";
const VIEWER_FORWARD = new THREE.Vector3(1, 0, 0);

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

function computeDefaultAngles(node) {
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

  const strip = document.getElementById("pano-tour-strip");
  const loading = document.getElementById("pano-tour-loading");
  const currentLabel = document.getElementById("pano-tour-current");
  const resetButton = document.getElementById("pano-tour-reset");
  const fadeLayer = document.getElementById("pano-tour-fade");
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
  let currentViewpointId = START_VIEWPOINT_ID;
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
  const textureLoader = new THREE.TextureLoader();
  const textureEntries = new Map();
  const stripButtons = new Map();
  const hotspotButtons = new Map();
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

  function setCurrentLabel(id) {
    currentLabel.textContent = "Viewpoint " + id;
    stripButtons.forEach((button, buttonId) => {
      button.classList.toggle("is-active", buttonId === id);
    });
  }

  function markFade(active) {
    fadeLayer.classList.toggle("is-active", Boolean(active));
  }

  function setTooltip(sprite) {
    hoverHotspot = sprite || null;
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

    tooltip.textContent = "Jump to viewpoint " + hoverHotspot.userData.id;
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
    button.title = "Jump to viewpoint " + id;
    button.setAttribute("aria-label", "Jump to viewpoint " + id);
    button.innerHTML = [
      '<span class="pano-tour-hotspot-ring" aria-hidden="true"></span>',
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
      stage.style.cursor = "pointer";
      tooltip.hidden = false;
      tooltip.textContent = "Jump to viewpoint " + id;
      tooltip.style.left = button.style.left;
      tooltip.style.top = button.style.top;
    });

    button.addEventListener("mouseleave", () => {
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
    sprite.position.set(direction[0], direction[1], direction[2]).multiplyScalar(9.5);
    sprite.renderOrder = 20;
    sprite.frustumCulled = false;
    const scale = clamp(1.55 - distance * 0.12, 0.82, 1.22);
    sprite.scale.set(scale, scale, scale);
    sprite.userData = {
      id: targetNode.id,
      baseScale: scale
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
    hotspotGroup.children.forEach((sprite) => {
      const isHovered = hoverHotspot === sprite;
      const targetScale = sprite.userData.baseScale * (isHovered ? 1.18 : 1);
      sprite.scale.set(targetScale, targetScale, targetScale);
      sprite.material.color.set(isHovered ? "#ffcf70" : "#7ad3ff");
    });
  }

  function updateHotspotButtons() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const activeIds = new Set();

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
        if (tooltip.textContent === "Jump to viewpoint " + id) {
          tooltip.hidden = true;
        }
        button.hidden = true;
        return;
      }

      button.hidden = false;
      button.style.left = ((projectedPoint.x + 1) / 2) * width + "px";
      button.style.top = ((-projectedPoint.y + 1) / 2) * height + "px";
    });

    hotspotButtons.forEach((button, id) => {
      if (!activeIds.has(id)) {
        button.hidden = true;
      }
    });
  }

  function updateDefaultView() {
    defaultAngles = computeDefaultAngles(VIEWPOINT_MAP.get(currentViewpointId));
  }

  function resetView() {
    yaw = defaultAngles.yaw;
    pitch = defaultAngles.pitch;
    applyCameraOrientation();
  }

  function loadTextureForNode(nodeId) {
    const existing = textureEntries.get(nodeId);
    if (existing && existing.texture) {
      existing.lastUsed = performance.now();
      return Promise.resolve(existing.texture);
    }
    if (existing && existing.promise) {
      return existing.promise;
    }

    const entry = existing || { texture: null, promise: null, lastUsed: performance.now() };
    entry.promise = textureLoader.loadAsync(VIEWPOINT_MAP.get(nodeId).image).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      entry.texture = texture;
      entry.promise = null;
      entry.lastUsed = performance.now();
      return texture;
    });
    textureEntries.set(nodeId, entry);
    return entry.promise;
  }

  function pruneTextureCache() {
    if (textureEntries.size <= 4) {
      return;
    }

    const keepIds = new Set([currentViewpointId]);
    const entries = Array.from(textureEntries.entries()).sort((a, b) => b[1].lastUsed - a[1].lastUsed);

    entries.forEach(([id, entry], index) => {
      if (keepIds.has(id) || index < 4 || !entry.texture) {
        return;
      }
      entry.texture.dispose();
      textureEntries.delete(id);
    });
  }

  function prefetchPanoramaImages() {
    scheduleIdleTask(() => {
      VIEWPOINTS.forEach((node, index) => {
        window.setTimeout(() => {
          const image = new Image();
          image.decoding = "async";
          image.src = node.image;
        }, index * 180);
      });
    }, 1200);
  }

  function buildStrip() {
    const fragment = document.createDocumentFragment();
    VIEWPOINTS.forEach((node) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pano-tour-point-button";
      button.textContent = node.id;
      button.addEventListener("click", () => {
        switchViewpoint(node.id, true);
      });
      stripButtons.set(node.id, button);
      fragment.appendChild(button);
    });
    strip.innerHTML = "";
    strip.appendChild(fragment);
  }

  function computePreservedAngles(nextNodeId) {
    const currentNode = VIEWPOINT_MAP.get(currentViewpointId);
    const nextNode = VIEWPOINT_MAP.get(nextNodeId);
    const worldDirection = viewerDirectionToWorldVector(currentNode, anglesToViewerDirection(yaw, pitch));
    return viewerDirectionToAngles(worldDirectionToViewerVector(nextNode, worldDirection));
  }

  function startCrossFade(texture, nextNodeId, nextAngles) {
    standbySphere.material.map = texture;
    standbySphere.material.needsUpdate = true;
    standbySphere.material.opacity = 0;
    standbySphere.visible = true;

    currentViewpointId = nextNodeId;
    yaw = nextAngles.yaw;
    pitch = nextAngles.pitch;
    applyCameraOrientation();
    updateDefaultView();
    setCurrentLabel(currentViewpointId);
    setTooltip(null);
    hotspotGroup.visible = false;
    markFade(true);

    transition = {
      startedAt: performance.now(),
      duration: 360,
      from: activeSphere,
      to: standbySphere
    };
  }

  async function switchViewpoint(nextNodeId, preserveOrientation) {
    if (isSwitching || nextNodeId === currentViewpointId || !VIEWPOINT_MAP.has(nextNodeId)) {
      return;
    }

    isSwitching = true;
    showLoading("Loading viewpoint " + nextNodeId + "...");

    const nextAngles = preserveOrientation ? computePreservedAngles(nextNodeId) : computeDefaultAngles(VIEWPOINT_MAP.get(nextNodeId));
    try {
      const texture = await loadTextureForNode(nextNodeId);
      hideLoading();
      startCrossFade(texture, nextNodeId, nextAngles);
    } catch (error) {
      console.error(error);
      showLoading("Unable to load viewpoint " + nextNodeId);
      window.setTimeout(hideLoading, 1400);
      isSwitching = false;
    }
  }

  function handleClick(event) {
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(hotspotGroup.children, false);
    if (intersections.length) {
      switchViewpoint(intersections[0].object.userData.id, true);
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
    setTooltip(intersections.length ? intersections[0].object : null);
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
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      transition.from.material.opacity = 1 - eased;
      transition.to.material.opacity = eased;

      if (progress >= 1) {
        transition.from.material.opacity = 0;
        transition.from.visible = false;
        transition.to.material.opacity = 1;
        activeSphere = transition.to;
        standbySphere = transition.from;
        transition = null;
        rebuildHotspots();
        hotspotGroup.visible = true;
        markFade(false);
        isSwitching = false;
        pruneTextureCache();
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

    resetButton.addEventListener("click", () => {
      resetView();
      setTooltip(null);
    });

    window.addEventListener("resize", resize);
  }

  async function boot() {
    if (initialized) {
      return;
    }
    initialized = true;

    createScene();
    buildStrip();
    bindEvents();
    resize();

    const startNode = VIEWPOINT_MAP.get(START_VIEWPOINT_ID);
    defaultAngles = computeDefaultAngles(startNode);
    yaw = defaultAngles.yaw;
    pitch = defaultAngles.pitch;
    applyCameraOrientation();

    showLoading("Loading panorama tour...");
    try {
      const texture = await loadTextureForNode(START_VIEWPOINT_ID);
      activeSphere.material.map = texture;
      activeSphere.material.needsUpdate = true;
      activeSphere.visible = true;
      rebuildHotspots();
      setCurrentLabel(currentViewpointId);
      hideLoading();
      prefetchPanoramaImages();
      animate(performance.now());
    } catch (error) {
      console.error(error);
      showLoading("Unable to initialize the panorama tour.");
    }
  }

  if (!("IntersectionObserver" in window)) {
    boot();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        boot();
      }
    });
  }, {
    rootMargin: "320px 0px",
    threshold: 0.01
  });

  observer.observe(stage);

  window.addEventListener("beforeunload", () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
    }
  });
}

document.addEventListener("DOMContentLoaded", initPanoramaTour);
