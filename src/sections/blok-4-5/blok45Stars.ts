import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

type StarsHandle = { wake: () => void; pause: () => void; resume: () => void; kill: () => void };

type StarsBridge = {
  triggerAuto: number;
  triggerManual: number;
  btnElement: HTMLElement | null;
  wake?: () => void;
};

const getBridge = (): StarsBridge => {
  const w = window as Window & { _blok45StarsState?: StarsBridge };
  if (!w._blok45StarsState) {
    w._blok45StarsState = { triggerAuto: 0, triggerManual: 0, btnElement: null };
  }
  return w._blok45StarsState;
};

export function initBlok45Stars(container: HTMLElement): StarsHandle | null {
  const host = container.querySelector<HTMLElement>("#blok-4-5-stars-canvas");
  if (!host) return null;

  const CLEAR_COLOR = "#ffffff";
  const MIN_Y_DRIFT_PX = 30;
  const Y_MULT = 2.0;
  const CURVE_PEAK_PX = 24 * Y_MULT;
  const PARTICLE_COUNT = 14;

  const containerConfig = { width: 326, offsetX: 0, offsetY: -4, minY: -44, maxY: 55 };
  const state = {
    particles: [] as VelvetParticle[],
    pixelToUnit: 0.01,
    mouse: new THREE.Vector2(0, 0),
    sizeScaleFactor: 1.0,
    sceneSeed: 1,
  };
  const centerCache = { x: 0, y: 0 };
  const btnRectCache = { cx: 0, cy: 0, width: 0, height: 0 };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 15;
  const renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0xe6f0ff, 1.0);
  fillLight.position.set(-5, 8, 5);
  scene.add(fillLight);
  const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
  backLight.position.set(-5, 5, -5);
  scene.add(backLight);

  let threeRunning = false;
  let canvasVisible = true;
  let rafId = 0;
  let disposed = false;

  const hash32 = (x: number) => {
    x |= 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0;
  };

  const UNIT_T = 0.4;
  const UNIT_S = 1.0;
  const UNIT_D = 0.36;
  const UNIT_R = 0.16;
  const unitVGeom = new RoundedBoxGeometry(UNIT_T, UNIT_S, UNIT_D, 4, UNIT_R);
  const unitHGeom = new RoundedBoxGeometry(UNIT_S, UNIT_T, UNIT_D, 4, UNIT_R);

  class VelvetParticle {
    index: number;
    mesh: THREE.Group;
    seed: number;
    material: THREE.MeshStandardMaterial | null;
    vMesh: THREE.Mesh | null;
    hMesh: THREE.Mesh | null;
    alive: boolean;
    baseOpacity: number;
    baseX: number;
    baseY: number;
    duration: number;
    delay: number;
    timer: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    initialSpinX: number;
    initialSpinY: number;
    initialSpinZ: number;
    yMultiplier: number;
    yBoost: number;
    mass: number;
    meshScale: number;
    repelX: number;
    repelY: number;
    velocityX: number;
    velocityY: number;
    prevVelX: number;
    prevVelY: number;
    spinVelocity: number;
    cumulativeSpin: number;

    constructor(i: number) {
      this.index = i;
      this.mesh = new THREE.Group();
      this.seed = hash32(state.sceneSeed ^ Math.imul(i + 1, 0x9e3779b9));
      this.material = null;
      this.vMesh = null;
      this.hMesh = null;
      this.alive = false;
      this.baseOpacity = 1;
      this.baseX = 0;
      this.baseY = 0;
      this.duration = 1;
      this.delay = 0;
      this.timer = 0;
      this.rotX = 0;
      this.rotY = 0;
      this.rotZ = 0;
      this.initialSpinX = 0;
      this.initialSpinY = 0;
      this.initialSpinZ = 0;
      this.yMultiplier = 1;
      this.yBoost = 1;
      this.mass = 1;
      this.meshScale = 1;
      this.repelX = 0;
      this.repelY = 0;
      this.velocityX = 0;
      this.velocityY = 0;
      this.prevVelX = 0;
      this.prevVelY = 0;
      this.spinVelocity = 0;
      this.cumulativeSpin = 0;
      scene.add(this.mesh);
      this.mesh.visible = false;
    }

    random() {
      let t = (this.seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    resetPhysics() {
      this.repelX = 0;
      this.repelY = 0;
      this.velocityX = 0;
      this.velocityY = 0;
      this.prevVelX = 0;
      this.prevVelY = 0;
      this.spinVelocity = 0;
      this.cumulativeSpin = 0;
    }

    spawn(staggerDelay: number, isManual = false) {
      this.alive = true;
      this.seed = Math.random() * 0xffffffff;

      let color: string;
      let emissiveColor: string;
      let emissiveIntensity: number;
      let opacity: number;
      let roughness: number;
      let envIntensity: number;
      if (isManual) {
        const isRed = this.random() < 0.15;
        color = isRed ? "#e24132" : "#000000";
        emissiveColor = color;
        emissiveIntensity = 0.4;
        opacity = 1;
        roughness = 0.3;
        envIntensity = 1.0;
      } else {
        color = CLEAR_COLOR;
        emissiveColor = "#000000";
        emissiveIntensity = 0;
        opacity = 0.45;
        roughness = 0.05;
        envIntensity = 1.5;
      }
      this.baseOpacity = opacity;

      if (this.material) {
        this.material.color.set(color);
        this.material.emissive.set(emissiveColor);
        this.material.emissiveIntensity = emissiveIntensity;
        this.material.opacity = opacity;
        this.material.roughness = roughness;
        this.material.envMapIntensity = envIntensity;
      } else {
        this.material = new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity,
          roughness,
          metalness: 0.1,
          envMapIntensity: envIntensity,
          side: THREE.DoubleSide,
          emissive: emissiveColor,
          emissiveIntensity,
        });
      }

      const scale = state.pixelToUnit || 0.01;
      const sizeRand = this.random();
      let sizePx = 0;
      if (sizeRand < 0.4) sizePx = 20 + this.random() * 9;
      else if (sizeRand < 0.8) sizePx = 28 + this.random() * 10;
      else sizePx = 38 + this.random() * 8;
      sizePx *= state.sizeScaleFactor;
      this.meshScale = sizePx * scale;

      if (!this.vMesh || !this.hMesh) {
        this.vMesh = new THREE.Mesh(unitVGeom, this.material);
        this.hMesh = new THREE.Mesh(unitHGeom, this.material);
        this.mesh.add(this.vMesh);
        this.mesh.add(this.hMesh);
      } else {
        this.vMesh.material = this.material;
        this.hMesh.material = this.material;
      }

      const u = (this.index + this.random()) / PARTICLE_COUNT;
      const xBasePx = (u - 0.5) * containerConfig.width;
      const xJitterPx = (this.random() - 0.5) * 20;
      this.baseX = (xBasePx + xJitterPx + containerConfig.offsetX) * scale;
      const yRange = containerConfig.maxY - containerConfig.minY;
      let yStartPx = containerConfig.offsetY + containerConfig.minY + this.random() * yRange;
      yStartPx += (this.random() - 0.5) * 10;
      this.baseY = -yStartPx * scale;
      const speedRand = this.random();
      let speedMultiplier = 1.0;
      if (speedRand < 0.2) speedMultiplier = 0.67;
      else if (speedRand > 0.8) speedMultiplier = 1.5;
      this.duration = (1.6 + this.random() * 1.0) * 2 * speedMultiplier;
      this.delay = staggerDelay;
      this.timer = 0;
      this.rotX = (this.random() - 0.5) * Math.PI * 1.2;
      this.rotY = (this.random() - 0.5) * Math.PI * 1.2;
      this.rotZ = (this.random() - 0.5) * Math.PI * 3;
      this.initialSpinX = (this.random() - 0.5) * Math.PI * 2;
      this.initialSpinY = (this.random() - 0.5) * Math.PI * 2;
      this.initialSpinZ = (this.random() - 0.5) * Math.PI * 4;
      this.yMultiplier = this.random() > 0.5 ? 2.0 : 1.0;
      this.yBoost = Math.max(1.0, MIN_Y_DRIFT_PX / (CURVE_PEAK_PX * this.yMultiplier));
      this.mass = 0.7 + this.random() * 0.6;
      this.resetPhysics();
    }

    update(dt: number, center: { x: number; y: number }, mouseWorldX: number, mouseWorldY: number, ptu: number, repelRadiusSq: number, repelRadius: number) {
      if (!this.alive) {
        this.mesh.visible = false;
        return;
      }
      this.timer += dt;
      const t = this.timer - this.delay;
      if (t > this.duration) {
        this.alive = false;
        this.mesh.visible = false;
        return;
      }
      if (t < 0) {
        this.mesh.visible = false;
        return;
      }
      this.mesh.visible = true;

      const p = t / this.duration;
      const pScale = Math.min(1.0, p / 0.6);
      let op = 1;
      let sc = 1;
      let tyPx = 0;
      let rP = 0;
      if (p < 0.15) {
        const k = p / 0.15;
        tyPx = (12 - 6 * k) * Y_MULT;
        rP = k * 0.15;
      } else if (p < 0.28) {
        const k = (p - 0.15) / 0.13;
        tyPx = (6 - 6 * k) * Y_MULT;
        rP = 0.15 + k * 0.13;
      } else if (p < 0.35) {
        const k = (p - 0.28) / 0.07;
        tyPx = (0 - 3 * k) * Y_MULT;
        rP = 0.28 + k * 0.07;
      } else if (p < 0.4) {
        const k = (p - 0.35) / 0.05;
        tyPx = (-3 - 2 * k) * Y_MULT;
        rP = 0.35 + k * 0.05;
      } else if (p < 0.45) {
        const k = (p - 0.4) / 0.05;
        tyPx = (-5 - 2 * k) * Y_MULT;
        rP = 0.4 + k * 0.05;
      } else if (p < 0.52) {
        const k = (p - 0.45) / 0.07;
        tyPx = (-7 - 3 * k) * Y_MULT;
        rP = 0.45 + k * 0.07;
      } else if (p < 0.65) {
        const k = (p - 0.52) / 0.13;
        tyPx = (-10 - 6 * k) * Y_MULT;
        rP = 0.52 + k * 0.13;
      } else {
        const k = (p - 0.65) / 0.35;
        tyPx = (-16 - 8 * k) * Y_MULT;
        rP = 0.65 + k * 0.35;
      }

      if (pScale < 0.15) {
        const k = pScale / 0.15;
        op = k;
        sc = k;
      } else if (pScale < 0.28) {
        op = 1;
        sc = 1;
      } else if (pScale < 0.35) {
        const k = (pScale - 0.28) / 0.07;
        op = 1;
        sc = 1 + k * 0.15;
      } else if (pScale < 0.4) {
        const k = (pScale - 0.35) / 0.05;
        op = 1;
        sc = 1.15 - k * 0.2;
      } else if (pScale < 0.45) {
        const k = (pScale - 0.4) / 0.05;
        op = 1;
        sc = 0.95 + k * 0.25;
      } else if (pScale < 0.52) {
        const k = (pScale - 0.45) / 0.07;
        op = 1;
        sc = 1.2 - k * 0.3;
      } else if (pScale < 0.65) {
        const k = (pScale - 0.52) / 0.13;
        op = 1;
        sc = 0.9 - k * 0.1;
      } else {
        const k = (pScale - 0.65) / 0.35;
        op = 1 - k;
        sc = 0.8 - k * 0.5;
      }

      const baseTargetX = center.x + this.baseX;
      const yDriftPx = tyPx * this.yMultiplier * this.yBoost;
      const baseTargetY = center.y + this.baseY - yDriftPx * ptu;
      const dx = baseTargetX - mouseWorldX;
      const dy = baseTargetY - mouseWorldY;
      const distSq = dx * dx + dy * dy;
      let tx = 0;
      let ty = 0;
      if (distSq < repelRadiusSq && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const ratio = 1 - dist / repelRadius;
        const f = (ratio * ratio * 1.2) / this.mass;
        tx = (dx / dist) * f;
        ty = (dy / dist) * f;
      }
      const damp = 0.85;
      let ax = (tx - this.repelX) * 0.15 - this.velocityX * (1 - damp);
      let ay = (ty - this.repelY) * 0.15 - this.velocityY * (1 - damp);
      const am = Math.sqrt(ax * ax + ay * ay);
      if (am > 0.008) {
        const s2 = 0.008 / am;
        ax *= s2;
        ay *= s2;
      }
      this.velocityX = (this.velocityX + ax) * damp;
      this.velocityY = (this.velocityY + ay) * damp;
      this.repelX += this.velocityX;
      this.repelY += this.velocityY;
      this.mesh.position.x = baseTargetX + this.repelX;
      this.mesh.position.y = baseTargetY + this.repelY;
      this.mesh.scale.setScalar(Math.max(0.001, sc * this.meshScale));
      const dVx = this.velocityX - this.prevVelX;
      const dVy = this.velocityY - this.prevVelY;
      this.spinVelocity += Math.sqrt(dVx * dVx + dVy * dVy) * 20;
      this.spinVelocity = Math.max(-0.2, Math.min(0.2, this.spinVelocity * 0.95));
      this.cumulativeSpin += this.spinVelocity * dt * 60;
      const entryPhase = Math.max(0, 1 - p * 3.33);
      const entryEase = entryPhase * entryPhase;
      const startZ = -Math.PI / 4;
      const finalRotX = this.rotX * rP + this.initialSpinX * entryEase;
      const finalRotY = this.rotY * rP + this.initialSpinY * entryEase;
      const finalRotZ = startZ + this.rotZ * rP + this.initialSpinZ * entryEase + this.cumulativeSpin;
      this.mesh.rotation.set(finalRotX, finalRotY, finalRotZ);
      this.prevVelX = this.velocityX;
      this.prevVelY = this.velocityY;
      const newOp = this.baseOpacity * op;
      if (this.material && this.material.opacity !== newOp) this.material.opacity = newOp;
    }

    dispose() {
      scene.remove(this.mesh);
      this.material?.dispose();
    }
  }

  const updatePixelScale = () => {
    const h = window.innerHeight;
    if (h === 0) {
      state.pixelToUnit = 0.01;
      return;
    }
    state.pixelToUnit = (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z) / h;
  };

  let btnPageCx = 0;
  let btnPageCy = 0;
  const cacheButtonRect = () => {
    const btnEl = getBridge().btnElement;
    if (!btnEl) return;
    const rect = btnEl.getBoundingClientRect();
    if (rect.width < 20) return;
    btnRectCache.width = rect.width;
    btnRectCache.height = rect.height;
    btnPageCx = rect.left + rect.width / 2 + window.scrollX;
    btnPageCy = rect.top + rect.height / 2 + window.scrollY;
    btnRectCache.cx = rect.left + rect.width / 2;
    btnRectCache.cy = rect.top + rect.height / 2;
  };
  const updateButtonRectFromScroll = () => {
    btnRectCache.cx = btnPageCx - window.scrollX;
    btnRectCache.cy = btnPageCy - window.scrollY;
  };
  const updateResponsiveConfig = () => {
    const bw = btnRectCache.width;
    const bh = btnRectCache.width > 0 ? btnRectCache.height || btnRectCache.width * 0.5 : 0;
    if (bw < 20) return;
    containerConfig.width = bw * 1.12;
    containerConfig.offsetX = 0;
    containerConfig.offsetY = -bh * 0.05;
    containerConfig.minY = -bh * 0.65;
    containerConfig.maxY = bh * 0.85;
    state.sizeScaleFactor = bw / 290;
  };

  const initParticles = () => {
    state.particles.forEach((p) => p.dispose());
    state.particles = [];
    state.sceneSeed = (Math.random() * 0xffffffff) >>> 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) state.particles.push(new VelvetParticle(i));
  };

  const triggerBatch = (isManual = false) => {
    cacheButtonRect();
    updateResponsiveConfig();
    const available: number[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) if (!state.particles[i]?.alive) available.push(i);
    if (!available.length) return;
    const toAdd = Math.min(available.length, 5 + Math.floor(Math.random() * 4));
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = available[i]!;
      available[i] = available[j]!;
      available[j] = tmp;
    }
    for (let j = 0; j < toAdd; j++) {
      const idx = available[j]!;
      const baseDelay = (j / toAdd) * 0.15;
      const jitter = Math.random() * 0.05;
      state.particles[idx]?.spawn(baseDelay + jitter, isManual);
    }
    wakeThreeLoop();
  };

  const clock = new THREE.Clock();
  const viewportHalfHeight = camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
  const RENDER_INTERVAL = 15;
  let lastRenderTime = 0;

  const animate = (now: number) => {
    if (disposed) return;
    const bridge = getBridge();
    const dt = Math.min(clock.getDelta(), 0.1);
    while (bridge.triggerAuto > 0) {
      bridge.triggerAuto--;
      triggerBatch(false);
    }
    while (bridge.triggerManual > 0) {
      bridge.triggerManual--;
      triggerBatch(true);
    }
    const ptu = state.pixelToUnit || 0.01;
    const repelRadius = 280 * ptu;
    const repelRadiusSq = repelRadius * repelRadius;
    const u = ptu;
    centerCache.x = (btnRectCache.cx - window.innerWidth / 2) * u;
    centerCache.y = -(btnRectCache.cy - window.innerHeight / 2) * u;
    const mx = state.mouse.x * viewportHalfHeight * camera.aspect;
    const my = state.mouse.y * viewportHalfHeight;
    let anyAlive = false;
    for (const p of state.particles) {
      p.update(dt, centerCache, mx, my, ptu, repelRadiusSq, repelRadius);
      if (p.alive) anyAlive = true;
    }
    if (anyAlive && now - lastRenderTime >= RENDER_INTERVAL) {
      renderer.render(scene, camera);
      lastRenderTime = now;
    }
    if (!anyAlive) {
      threeRunning = false;
      if (canvasVisible) {
        renderer.domElement.style.visibility = "hidden";
        canvasVisible = false;
      }
      return;
    }
    rafId = requestAnimationFrame(animate);
  };

  const wakeThreeLoop = () => {
    if (disposed) return;
    if (!threeRunning) {
      threeRunning = true;
      if (!canvasVisible) {
        renderer.domElement.style.visibility = "visible";
        canvasVisible = true;
      }
      clock.getDelta();
      rafId = requestAnimationFrame(animate);
    }
  };

  const bridge = getBridge();
  bridge.wake = wakeThreeLoop;

  const onMouseMove = (e: MouseEvent) => {
    if (!threeRunning) return;
    state.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!threeRunning) return;
    if (!e.touches.length) return;
    state.mouse.x = (e.touches[0]!.clientX / window.innerWidth) * 2 - 1;
    state.mouse.y = -(e.touches[0]!.clientY / window.innerHeight) * 2 + 1;
  };
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("touchmove", onTouchMove, { passive: true });

  let threeLastWidth = window.innerWidth;
  const onResize = () => {
    if (window.innerWidth === threeLastWidth) return;
    threeLastWidth = window.innerWidth;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updatePixelScale();
    cacheButtonRect();
    updateResponsiveConfig();
  };
  const onScroll = () => updateButtonRectFromScroll();
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onScroll, { passive: true });

  updatePixelScale();
  initParticles();
  renderer.domElement.style.visibility = "hidden";
  canvasVisible = false;
  const t = setTimeout(() => {
    cacheButtonRect();
    updateResponsiveConfig();
  }, 100);

  const pause = () => {
    if (!threeRunning) return;
    threeRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
  };

  const resume = () => {
    wakeThreeLoop();
  };

  const kill = () => {
    disposed = true;
    pause();
    clearTimeout(t);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onScroll);
    state.particles.forEach((p) => p.dispose());
    state.particles = [];
    unitVGeom.dispose();
    unitHGeom.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    const b = getBridge();
    b.triggerAuto = 0;
    b.triggerManual = 0;
    if (b.wake === wakeThreeLoop) delete b.wake;
  };

  return { wake: wakeThreeLoop, pause, resume, kill };
}
