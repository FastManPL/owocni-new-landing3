import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type KineticHandle = { kill: () => void; pause: () => void; resume: () => void };

/**
 * Kinetic (PIN+SNAP Macro Section) engine.
 * Batch 1: lifecycle + v2.5.1 guards scaffold.
 * Batch 2: full timeline/canvas logic 1:1 from index_clean (25).html.
 */
export function runKinetic(container: HTMLElement): KineticHandle {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const prevFps = (gsap.ticker as unknown as { fps: (value?: number) => number }).fps();
  gsap.ticker.fps(30);

  // P2.1: idempotent init — one pin instance per root.
  try {
    ScrollTrigger.getAll().forEach((st) => {
      if (st.trigger === container || st.vars?.id === "KINETIC_PIN") st.kill(true);
    });
  } catch {
    // noop
  }

  const tickerFns: Array<() => void> = [];
  const cleanups: Array<() => void> = [];
  const gsapInstances: Array<gsap.core.Animation> = [];
  const timerIds: Array<ReturnType<typeof setTimeout>> = [];

  // P2.3: mobile resize snap-lock (used by snapTo in full timeline migration).
  const isTouch = !!ScrollTrigger.isTouch;
  let mobileResizeLock = false;
  let resizeLockTimer: ReturnType<typeof setTimeout> | null = null;
  const armMobileResizeLock = () => {
    if (!isTouch) return;
    mobileResizeLock = true;
    if (resizeLockTimer) clearTimeout(resizeLockTimer);
    resizeLockTimer = setTimeout(() => {
      mobileResizeLock = false;
    }, 250);
  };
  window.addEventListener("resize", armMobileResizeLock, { passive: true });
  window.visualViewport?.addEventListener("resize", armMobileResizeLock, { passive: true });
  cleanups.push(() => {
    window.removeEventListener("resize", armMobileResizeLock);
    window.visualViewport?.removeEventListener("resize", armMobileResizeLock);
    if (resizeLockTimer) clearTimeout(resizeLockTimer);
  });

  const FREEZE_ON = 0.999;
  const FREEZE_OFF = 0.995;
  let freezeFinal = false;

  // Source parity: viewport probe for svh/lvh based math.
  const svhProbe = document.createElement("div");
  svhProbe.style.cssText = "position:fixed;top:0;height:100svh;pointer-events:none;visibility:hidden;";
  document.body.appendChild(svhProbe);
  const svhRaw = svhProbe.offsetHeight;
  svhProbe.style.height = "100lvh";
  const lvhRaw = svhProbe.offsetHeight;
  document.body.removeChild(svhProbe);
  const supportsViewportUnits = svhRaw > 0 && lvhRaw > 0;
  const fallbackVh = window.visualViewport?.height || window.innerHeight;
  const svh = supportsViewportUnits ? svhRaw : fallbackVh;
  const lvh = supportsViewportUnits ? lvhRaw : fallbackVh;
  const _toolbarDelta = Math.max(0, lvh - svh);
  void _toolbarDelta;

  const KINETIC_U = 23.0;
  const SCROLL_KINETIC = 3526;
  const I = KINETIC_U * (svh / SCROLL_KINETIC);
  const TOTAL_U = I + KINETIC_U;
  const KINETIC_SNAPS = [I + 3.5, I + 9.5, I + 23.0].map((u) => u / TOTAL_U);
  const BRIDGE_END_PROGRESS = (I + 3.5) / TOTAL_U;
  const GRAB_START = BRIDGE_END_PROGRESS * 0.82;
  const HYS = Math.min(0.03, BRIDGE_END_PROGRESS * 0.25);
  const snapDir = ScrollTrigger.snapDirectional(KINETIC_SNAPS);

  // Adaptive DPR system (source parity: quality scales with observed fps).
  const adaptiveDPR = {
    cap: 0.75,
    min: 0.5,
    max: 1.5,
    lastTime: performance.now(),
    frameCount: 0,
    avgFPS: 30,
    callbacks: [] as Array<(cap: number) => void>,
    tick() {
      if (document.hidden) {
        this.lastTime = performance.now();
        this.frameCount = 0;
        return;
      }
      this.frameCount += 1;
      const now = performance.now();
      const elapsed = now - this.lastTime;
      if (elapsed < 500) return;
      const currentFPS = (this.frameCount / elapsed) * 1000;
      this.avgFPS = this.avgFPS * 0.7 + currentFPS * 0.3;
      this.frameCount = 0;
      this.lastTime = now;
      const oldCap = this.cap;
      if (this.avgFPS > 28) this.cap = Math.min(this.cap + 0.05, this.max);
      if (this.avgFPS < 22) this.cap = Math.max(this.cap - 0.1, this.min);
      if (oldCap !== this.cap) this.callbacks.forEach((cb) => cb(this.cap));
    },
    get() {
      return Math.min(window.devicePixelRatio || 1, this.cap);
    },
    onChange(fn: (cap: number) => void) {
      this.callbacks.push(fn);
      return () => {
        const idx = this.callbacks.indexOf(fn);
        if (idx >= 0) this.callbacks.splice(idx, 1);
      };
    },
  };
  const tickAdaptiveDpr = () => adaptiveDPR.tick();
  gsap.ticker.add(tickAdaptiveDpr);
  tickerFns.push(tickAdaptiveDpr);

  const pinnedTl = gsap.timeline({
    scrollTrigger: {
      trigger: container,
      start: "top top",
      end: () => "+=" + (svh + SCROLL_KINETIC),
      id: "KINETIC_PIN",
      scrub: 1,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      preventOverlaps: true,
      onUpdate: (self) => {
        // P2.4: freeze final frame only on touch devices.
        if (!isTouch) return;
        if (!freezeFinal && self.progress >= FREEZE_ON) freezeFinal = true;
        else if (freezeFinal && self.progress <= FREEZE_OFF) freezeFinal = false;
      },
      snap: {
        snapTo: (value, self) => {
          const fallbackProgress = typeof value === "number" ? value : 0;
          if (!self) return fallbackProgress;
          // P2.3: Snap-Lock on touch resize.
          if (mobileResizeLock) return self.progress;
          const p = self.progress;
          const dir = self.direction || 1;
          if (p < GRAB_START) return p;
          if (p < BRIDGE_END_PROGRESS + HYS) {
            if (dir > 0) return BRIDGE_END_PROGRESS;
            return p;
          }
          return snapDir(value, dir);
        },
        directional: true,
        inertia: false,
        duration: { min: 0.3, max: 2.0 },
        delay: 0.1,
        ease: "power2.out",
      },
      // P2.2: no fastScrollEnd in macro pin+snap sections.
    },
  });
  gsapInstances.push(pinnedTl);
  (window as Window & { pinnedTl?: gsap.core.Timeline }).pinnedTl = pinnedTl;
  (window as Window & { BRIDGE_I?: number }).BRIDGE_I = I;

  // Timeline durations are defined by migrated source blocks below.

  const splitIntoChars = (element: HTMLElement) => {
    const nodes = Array.from(element.childNodes);
    element.innerHTML = "";
    const fragment = document.createDocumentFragment();
    let globalIndex = 0;

    nodes.forEach((node) => {
      const isText = node.nodeType === Node.TEXT_NODE;
      const target = isText ? fragment : node.cloneNode(false);
      const textContent = node.textContent ?? "";
      [...textContent].forEach((char) => {
        const span = document.createElement("span");
        span.className = "anim-char";
        span.textContent = char === " " ? "\u00A0" : char;
        span.dataset.index = String(globalIndex++);
        target.appendChild(span);
      });
      if (!isText) fragment.appendChild(target);
    });

    element.appendChild(fragment);
    return element.querySelectorAll<HTMLElement>(".anim-char");
  };

  const animateBlock1_ColorWave = (
    tl: gsap.core.Timeline,
    b1: HTMLElement,
    b1Lines: NodeListOf<HTMLElement>,
    b1Bold: NodeListOf<HTMLElement>
  ) => {
    const allLineChars: Array<{ line: HTMLElement; chars: NodeListOf<HTMLElement>; isBold: boolean }> = [];

    [...b1Lines, ...b1Bold].forEach((line) => {
      const chars = splitIntoChars(line);
      allLineChars.push({
        line,
        chars,
        isBold: line.classList.contains("bold-line"),
      });
    });

    allLineChars.forEach(({ chars }) => {
      gsap.set(chars, { color: "#9dd2f6" });
    });

    tl.set(b1, { autoAlpha: 1 });

    const normalLines = allLineChars.filter((l) => !l.isBold).map((l) => l.line);
    const boldLines = allLineChars.filter((l) => l.isBold).map((l) => l.line);
    const allLines = [...normalLines, ...boldLines];

    tl.addLabel("colorWaveStart");
    tl.fromTo(
      allLines,
      { y: 60, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 3, stagger: 0.5, ease: "expo.out" }
    );

    allLineChars.forEach(({ chars }, index) => {
      const lineStartTime = index * 0.5;
      tl.to(
        chars,
        {
          color: "#141414",
          duration: 2.8,
          stagger: 0.02,
          ease: "power2.out",
        },
        "colorWaveStart+=" + (lineStartTime + 0.1)
      );
    });
  };

  // Batch 2: core narrative sequence Block1 -> Block2 -> Block3.
  const b1 = container.querySelector<HTMLElement>("#kinetic-block-1");
  const b2 = container.querySelector<HTMLElement>("#kinetic-block-2");
  const b3 = container.querySelector<HTMLElement>("#kinetic-block-3");
  if (b1 && b2 && b3) {
    const b1Lines = b1.querySelectorAll<HTMLElement>(".line:not(.bold-line)");
    const b1Bold = b1.querySelectorAll<HTMLElement>(".line.bold-line");
    const line = container.querySelector<HTMLElement>("#kinetic-problem-line");
    const b3Header = b3.querySelector<HTMLElement>(".small-header");
    const mobContainer = b3.querySelector<HTMLElement>(".block-3-mobile");
    const dskContainer = b3.querySelector<HTMLElement>(".block-3-desktop");
    const isMobileB3 = !!(mobContainer && window.getComputedStyle(mobContainer).display !== "none");
    const b3Container = (isMobileB3 ? mobContainer : dskContainer) || b3;
    const b3Lines = b3Container.querySelectorAll<HTMLElement>(".line:not(.bold-line)");
    const b3Bold = b3Container.querySelector<HTMLElement>(".line.bold-line");

    gsap.set([b1, b2, b3], { autoAlpha: 0 });
    pinnedTl.addLabel("start", I);
    pinnedTl.addLabel("block1", 3.5 + I);
    pinnedTl.addLabel("block2", 9.0 + I);
    pinnedTl.addLabel("block3", 22.0 + I);
    pinnedTl.addLabel("end", 23.0 + I);

    // Bridge spacer then Block1 color-wave rhythm.
    pinnedTl.to({}, { duration: I }, 0);
    animateBlock1_ColorWave(pinnedTl, b1, b1Lines, b1Bold);

    const block2StartPosition = pinnedTl.duration();
    pinnedTl.addLabel("block2Start", block2StartPosition);

    if (line) {
      const chars = splitIntoChars(line);
      gsap.set(line, { filter: "blur(20px)" });
      chars.forEach((char) => {
        gsap.set(char, { opacity: 0, scale: 1.5, y: 100, color: "#9df6e4" });
      });

      const appearDuration = 6.0;
      const blurDuration = 3.6;
      const colorDuration = 8.0;

      pinnedTl.set(b2, { autoAlpha: 1 }, "block2Start");
      pinnedTl.to(line, { filter: "blur(0px)", duration: blurDuration, ease: "power4.out" }, "block2Start");
      pinnedTl.to(
        chars,
        { opacity: 1, scale: 1, y: 0, duration: appearDuration, ease: "power4.out", stagger: { from: "center", amount: 0.8 } },
        "block2Start"
      );
      pinnedTl.to(
        chars,
        { color: "#141414", duration: colorDuration, ease: "power2.out", stagger: { from: "center", amount: 0.8 } },
        "block2Start+=0.1"
      );
    }

    // Exit collision and block3 intro (source timings).
    pinnedTl.to(b1, { y: 50, opacity: 0, duration: 1.22, ease: "power4.in" }, 9.5 + I);
    pinnedTl.to(b2, { y: -50, opacity: 0, duration: 2, ease: "power4.in" }, 8.72 + I);
    gsap.set(b3, { yPercent: -50, transformOrigin: "left center" });
    gsap.set([b3Lines, b3Bold].filter(Boolean), { transformOrigin: "left center" });
    pinnedTl.set(b3, { autoAlpha: 1 }, 10.04 + I);
    if (b3Lines.length) {
      pinnedTl.fromTo(
        b3Lines,
        { y: 60, opacity: 0, scale: 1 },
        { y: 0, opacity: 1, scale: 1.08, duration: 8.0, stagger: 0.6, ease: "power4.out" },
        10.04 + I
      );
    }
    if (b3Bold) {
      pinnedTl.fromTo(
        b3Bold,
        { opacity: 0, scale: 0.95, y: 60 },
        { opacity: 1, scale: 1.12, y: 0, duration: 7.0, ease: "power4.out" },
        12.44 + I
      );
    }
    // Header wave "Wg badań GEMIUS" (character-level, later phase).
    if (b3Header) {
      const b3HeaderChars = splitIntoChars(b3Header);
      gsap.set(b3HeaderChars, { opacity: 0, x: 30, color: "#ffb998", immediateRender: true });
      pinnedTl.to(
        b3HeaderChars,
        { opacity: 1, x: 0, duration: 6, stagger: 0.06, ease: "power2.out", immediateRender: false },
        14.3 + I
      );
      pinnedTl.to(
        b3HeaderChars,
        { color: "#141414", duration: 5.5, stagger: 0.06, ease: "power1.inOut" },
        14.6 + I
      );
    }

    // Block scales and staged B1 line collapse (source absolute timings).
    gsap.set(b1, { scale: 0.95, transformOrigin: "center center" });
    pinnedTl.to(b1, { scale: 1.08, duration: 13, ease: "power2.in" }, I);
    gsap.set(b3, { scale: 0.95 });
    pinnedTl.to(b3, { scale: 1.12, duration: 8.0, ease: "power3.out" }, 10.3 + I);
    const b1AllLines = b1.querySelectorAll<HTMLElement>(".line");
    if (b1AllLines[0]) pinnedTl.to(b1AllLines[0], { y: 60, opacity: 0, duration: 0.57, ease: "power2.in" }, 9.5 + I);
    if (b1AllLines[1]) pinnedTl.to(b1AllLines[1], { y: 60, opacity: 0, duration: 0.57, ease: "power2.in" }, 9.75 + I);
    if (b1AllLines[2]) pinnedTl.to(b1AllLines[2], { y: 60, opacity: 0, duration: 0.57, ease: "power2.in" }, 10.0 + I);

    // Problem-line additional macro scale easing.
    if (line) {
      gsap.set(line, { scale: 3, transformOrigin: "center center" });
      pinnedTl.to(line, { scale: 1, duration: 7.71, ease: "circ.out" }, 2.13 + I);
    }
  }

  // Phase state (source parity for modules reading form/rotate/collapse).
  const FORM_END = 3.5;
  const ROTATE_START = 3.5;
  const ROTATE_END = 9.5;
  const COLLAPSE_START = 9.5;
  const COLLAPSE_END = 10.8;
  const particleState = {
    formProgress: 0,
    rotateProgress: 0,
    collapseProgress: 0,
    colorMixRatio: 0,
  };

  const updatePhases = (currentUnit: number) => {
    if (currentUnit <= FORM_END) {
      particleState.formProgress = Math.max(0, currentUnit / FORM_END);
      particleState.rotateProgress = 0;
      particleState.collapseProgress = 0;
    } else if (currentUnit <= ROTATE_END) {
      particleState.formProgress = 1;
      particleState.rotateProgress = (currentUnit - ROTATE_START) / (ROTATE_END - ROTATE_START);
      particleState.collapseProgress = 0;
    } else if (currentUnit <= COLLAPSE_END) {
      particleState.formProgress = 1;
      particleState.rotateProgress = 1;
      particleState.collapseProgress = (currentUnit - COLLAPSE_START) / (COLLAPSE_END - COLLAPSE_START);
    } else {
      particleState.formProgress = 1;
      particleState.rotateProgress = 1;
      particleState.collapseProgress = 1;
    }
    particleState.colorMixRatio = particleState.rotateProgress;
  };

  const tickPhases = () => {
    if (!pinnedTl) return;
    const progress = pinnedTl.progress();
    const duration = pinnedTl.duration();
    const currentUnit = progress * duration;
    if (currentUnit < I) {
      const bridgeFraction = I > 0 ? currentUnit / I : 1;
      updatePhases(bridgeFraction * FORM_END);
    } else {
      const kineticUnit = currentUnit - I;
      updatePhases(Math.max(FORM_END, kineticUnit));
    }
  };
  gsap.ticker.add(tickPhases);
  tickerFns.push(tickPhases);

  // Particle question-mark canvas module.
  const particleCanvas = container.querySelector<HTMLCanvasElement>("#kinetic-particle-qmark-canvas");
  if (particleCanvas) {
    const pCtx = particleCanvas.getContext("2d");
    if (pCtx) {
      const maxCapacity = 2400;
      const pX = new Float32Array(maxCapacity);
      const pY = new Float32Array(maxCapacity);
      const pZ = new Float32Array(maxCapacity);
      const tX = new Float32Array(maxCapacity);
      const tY = new Float32Array(maxCapacity);
      const tZ = new Float32Array(maxCapacity);
      const sX = new Float32Array(maxCapacity);
      const sY = new Float32Array(maxCapacity);
      const sZ = new Float32Array(maxCapacity);
      const pSize = new Float32Array(maxCapacity);
      const pSpeedVar = new Float32Array(maxCapacity);
      const pSeed = new Float32Array(maxCapacity);
      const pCurvePhase = new Float32Array(maxCapacity);
      const pCurveFactor = new Float32Array(maxCapacity);
      const pAlpha = new Float32Array(maxCapacity);
      const pTyNorm = new Float32Array(maxCapacity);
      const pFallDriftX = new Float32Array(maxCapacity);
      const pFallDriftZ = new Float32Array(maxCapacity);
      const pFallSpeed = new Float32Array(maxCapacity);
      const sortedIndices = new Int16Array(maxCapacity);
      const pColorAIdx = new Uint8Array(maxCapacity);
      const pColorBIdx = new Uint8Array(maxCapacity);
      const PALETTE_A = ["#d9e2e9", "#b4ccd9", "#c3c3da", "#cce4e4"];
      const PALETTE_B = ["#d9ebda", "#b2dab2", "#c1dcce", "#cfe2c7"];
      const A_RGB = PALETTE_A.map((hex) => {
        const n = parseInt(hex.slice(1), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      });
      const B_RGB = PALETTE_B.map((hex) => {
        const n = parseInt(hex.slice(1), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      });

      let activeCount = 0;
      let width = 0;
      let height = 0;
      let cx = 0;
      let cy = 0;
      let initialized = false;
      let lastWidth = 0;
      let frameCount = 0;
      let dotTopY = 0;
      let dotBottomY = 0;
      const FOCAL_LENGTH = 800;
      const PI = Math.PI;
      const PI2 = Math.PI * 2;

      const getShapeCoordinates = () => {
        if (!width || !height) return [] as Array<{ x: number; y: number }>;
        const temp = document.createElement("canvas");
        const tCtx = temp.getContext("2d");
        if (!tCtx) return [] as Array<{ x: number; y: number }>;
        const MIN_RENDER = 1200;
        const scaleUp = Math.max(1, MIN_RENDER / Math.min(width, height));
        const rW = Math.round(width * scaleUp);
        const rH = Math.round(height * scaleUp);
        const size = Math.min(rW, rH) * 0.55;
        temp.width = rW;
        temp.height = rH;
        tCtx.font = "700 " + size + 'px "Times New Roman", Georgia, serif';
        tCtx.textAlign = "center";
        tCtx.textBaseline = "middle";
        tCtx.fillStyle = "#000";
        tCtx.fillText("?", rW / 2, rH / 2);
        const data = tCtx.getImageData(0, 0, rW, rH).data;
        const out: Array<{ x: number; y: number }> = [];
        for (let y = 0; y < rH; y += 4) {
          for (let x = 0; x < rW; x += 4) {
            const i = (y * rW + x) * 4;
            if (data[i + 3] > 128) out.push({ x: x / scaleUp, y: y / scaleUp });
          }
        }
        if (!out.length) return out;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const p of out) {
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        dotTopY = minY + (maxY - minY) * 0.72 - cy;
        dotBottomY = maxY - cy;
        return out;
      };

      const createParticles = () => {
        const points = getShapeCoordinates();
        if (!points.length) return;
        const limit = width < 768 ? 1000 : 2000;
        const step = Math.max(1, Math.ceil(points.length / limit));
        const sampled: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < points.length; i += step) sampled.push(points[i]);
        let minY = Infinity;
        let maxY = -Infinity;
        for (const p of sampled) {
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const rangeY = maxY - minY || 1;
        const shapeDepth = 50 * (rangeY / 600);
        activeCount = 0;
        for (let i = 0; i < sampled.length && activeCount < maxCapacity; i++) {
          const idx = activeCount++;
          const p = sampled[i];
          tX[idx] = p.x - cx;
          tY[idx] = p.y - cy;
          tZ[idx] = (Math.random() - 0.5) * shapeDepth;
          sX[idx] = (Math.random() - 0.5) * width * 1.6;
          sY[idx] = height * 0.55 + Math.random() * height * 0.3;
          sZ[idx] = Math.random() < 0.5 ? 600 + (Math.random() - 0.5) * 500 : -200 - Math.random() * 400;
          pX[idx] = sX[idx];
          pY[idx] = sY[idx];
          pZ[idx] = sZ[idx];
          pSize[idx] = Math.random() * 3.5 + 1.5;
          pSpeedVar[idx] = Math.random() * 0.5 + 0.5;
          pSeed[idx] = Math.random() * 1000;
          pCurvePhase[idx] = Math.random() * PI2;
          pCurveFactor[idx] = (Math.random() - 0.5) * 3 - (sX[idx] / (width * 0.8)) * 0.9;
          pTyNorm[idx] = (p.y - minY) / rangeY;
          pFallDriftX[idx] = (Math.random() - 0.5) * 80;
          pFallDriftZ[idx] = (Math.random() - 0.5) * 60;
          pFallSpeed[idx] = 0.8 + Math.random() * 0.5;
          pColorAIdx[idx] = Math.floor(Math.random() * A_RGB.length);
          pColorBIdx[idx] = Math.floor(Math.random() * B_RGB.length);
          sortedIndices[idx] = idx;
        }
      };

      const resizeParticleForDpr = () => {
        const dpr = adaptiveDPR.get();
        particleCanvas.width = width * dpr;
        particleCanvas.height = height * dpr;
        pCtx.setTransform(1, 0, 0, 1, 0, 0);
        pCtx.scale(dpr, dpr);
      };

      const resizeParticles = () => {
        if (isTouch && freezeFinal) return;
        const wrapper = particleCanvas.parentElement;
        const newWidth = wrapper ? wrapper.clientWidth : window.innerWidth;
        height = wrapper ? wrapper.clientHeight : window.innerHeight;
        const widthChanged = newWidth !== lastWidth;
        width = newWidth;
        lastWidth = newWidth;
        cx = width / 2;
        cy = height / 2;
        resizeParticleForDpr();
        if (widthChanged) {
          createParticles();
          initialized = true;
        }
      };

      const sortByDepth = () => {
        for (let i = 1; i < activeCount; i++) {
          const current = sortedIndices[i];
          const z = pZ[current];
          let j = i - 1;
          while (j >= 0 && pZ[sortedIndices[j]] < z) {
            sortedIndices[j + 1] = sortedIndices[j];
            j--;
          }
          sortedIndices[j + 1] = current;
        }
      };

      const animateParticles = () => {
        if (!initialized || activeCount === 0 || document.hidden) return;
        frameCount += 1;
        const fp = particleState.formProgress;
        const rp = particleState.rotateProgress;
        const cp = particleState.collapseProgress;
        if (cp >= 1) {
          pCtx.clearRect(0, 0, width, height);
          return;
        }
        const rotEase = rp < 0.5 ? 4 * rp * rp * rp : 1 - Math.pow(-2 * rp + 2, 3) / 2;
        const theta = (PI * 0.5) * (1 - rotEase);
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        for (let i = 0; i < activeCount; i++) {
          let p = (fp - (1 - pSpeedVar[i]) * 0.35) / 0.65;
          p = Math.max(0, Math.min(1, p));
          const invP = 1 - p;
          const ease = 1 - invP * invP * invP * invP;
          const rTx = tX[i] * cosTheta + tZ[i] * sinTheta;
          const rTz = -tX[i] * sinTheta + tZ[i] * cosTheta;
          let lx = sX[i] + (rTx - sX[i]) * ease;
          let ly = sY[i] + (tY[i] - sY[i]) * ease;
          let lz = sZ[i] + (rTz - sZ[i]) * ease;
          if (p < 0.98) {
            const flightCurve = Math.sin(p * PI);
            const cPhase = pCurvePhase[i];
            const cFact = pCurveFactor[i];
            lx += Math.sin(p * PI2 + cPhase) * cFact * flightCurve * 80 * 0.4;
            ly += Math.cos(p * 2.5 * PI + cPhase + 1.3) * cFact * flightCurve * 50 * 0.3;
            lz += Math.sin(p * 3 * PI + pSeed[i]) * flightCurve * 60;
          }
          let collapseAlpha = 1;
          if (cp > 0) {
            const isDot = tY[i] >= (dotTopY || 9999);
            const K = 1.6;
            const trigger = isDot ? (1 - pTyNorm[i]) * 0.4 : pTyNorm[i] * 0.6;
            const local = cp * cp * K - trigger;
            if (local > 0) {
              const fallY = local * local * (height * 0.6) * pFallSpeed[i] * (isDot ? 7 : 4);
              ly += fallY;
              lx += pFallDriftX[i] * local * (isDot ? 0.25 : 1);
              lz += pFallDriftZ[i] * local;
              collapseAlpha = isDot ? Math.max(0, 1 - fallY / (height * 0.25)) : Math.max(0, 1 - local * 1.4);
            }
          }
          pX[i] = lx;
          pY[i] = ly;
          pZ[i] = lz;
          const depthAlpha = Math.max(0, 1 - lz / 3500);
          pAlpha[i] = Math.max(0, Math.min(1, Math.min(1, p * 3) * depthAlpha * collapseAlpha));
        }
        if (frameCount % 3 === 0) sortByDepth();
        pCtx.clearRect(0, 0, width, height);
        const isMobileParticle = width < 600;
        const signScale = isMobileParticle ? 1.4 : 1;
        const mobileYOffset = isMobileParticle ? -55 : 0;
        const particleSizeScale = isMobileParticle ? 0.6 : 1;
        for (let i = 0; i < activeCount; i++) {
          const idx = sortedIndices[i];
          if (pAlpha[idx] <= 0.01) continue;
          const depth = FOCAL_LENGTH + pZ[idx];
          if (depth < 10) continue;
          const scale = FOCAL_LENGTH / depth;
          const rX = cx + pX[idx] * scale * signScale;
          const rY = cy + pY[idx] * scale * signScale + mobileYOffset;
          if (rX < -50 || rX > width + 50 || rY < -50 || rY > height + 50) continue;
          let rSize = pSize[idx] * scale * particleSizeScale;
          if (rSize < 0.1) continue;
          const cA = A_RGB[pColorAIdx[idx]];
          const cB = B_RGB[pColorBIdx[idx]];
          const mix = particleState.colorMixRatio;
          const r = Math.floor(cA.r + (cB.r - cA.r) * mix);
          const g = Math.floor(cA.g + (cB.g - cA.g) * mix);
          const b = Math.floor(cA.b + (cB.b - cA.b) * mix);
          pCtx.fillStyle = `rgb(${r},${g},${b})`;
          pCtx.globalAlpha = pAlpha[idx];
          pCtx.beginPath();
          if (rSize < 4) pCtx.rect(rX - rSize, rY - rSize, rSize * 2, rSize * 2);
          else pCtx.arc(rX, rY, rSize, 0, PI2);
          pCtx.fill();
        }
        pCtx.globalAlpha = 1;
      };

      const tickParticle = () => animateParticles();
      gsap.ticker.add(tickParticle);
      tickerFns.push(tickParticle);
      const onResizeParticle = () => resizeParticles();
      window.addEventListener("resize", onResizeParticle);
      cleanups.push(() => window.removeEventListener("resize", onResizeParticle));
      const offDpr = adaptiveDPR.onChange(() => resizeParticleForDpr());
      cleanups.push(offDpr);
      resizeParticles();
      (
        window as Window & {
          particleQmark?: { state: typeof particleState; getActiveCount: () => number; canvas: HTMLCanvasElement; forceResize: () => void };
        }
      ).particleQmark = {
        state: particleState,
        getActiveCount: () => activeCount,
        canvas: particleCanvas,
        forceResize: () => {
          lastWidth = 0;
          resizeParticles();
        },
      };
    }
  }

  // Cylinder module (scrub-driven, source adapted).
  const cylCanvas = container.querySelector<HTMLCanvasElement>("#kinetic-cylinder-canvas");
  const cylWrapper = container.querySelector<HTMLElement>("#kinetic-cylinder-wrapper");
  if (cylCanvas && cylWrapper) {
    const ctx = cylCanvas.getContext("2d", { alpha: true });
    if (ctx) {
      const CYLINDER_CONFIG = {
        startNumber: 96,
        endNumber: 98,
        fontSize: 792,
        radius: 900,
        perspective: 288,
        fontSizeMobile: 342,
        radiusMobile: 389,
        perspectiveMobile: 124,
        mobileBreakpoint: 768,
        fontFamily: "Lexend, sans-serif",
        fontWeight: "800",
        superscriptRatio: 0.45,
        sliceHeight: 3,
        centerYPercent: 0.502,
        centerYPercentMobile: 0.452,
        textColor: "#fefefc",
      };
      let width = window.innerWidth;
      let height = window.innerHeight;
      let lastCylWidth = 0;
      const config = { ...CYLINDER_CONFIG, itemSpacing: 0, words: [] as string[] };
      const textures: Array<{
        img: HTMLCanvasElement;
        width: number;
        height: number;
        arcAngle: number;
        _originalIndex: number;
      }> = [];
      let cachedFogTop: CanvasGradient | null = null;
      let cachedFogBottom: CanvasGradient | null = null;
      let cachedFogTopEnd = 0;
      let cachedFogBottomStart = 0;
      const cylinderState = { rotation: 0, opacity: 0, y: -100 };
      let lastRotation: number | null = null;
      let lastOpacity: number | null = null;
      let resizeTriggered = true;

      const createWordTexture = (text: string) => {
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return null;
        const mainFontSize = config.fontSize;
        const superFontSize = Math.round(mainFontSize * config.superscriptRatio);
        tempCtx.font = `${config.fontWeight} ${mainFontSize}px ${config.fontFamily}`;
        const mainWidth = Math.ceil(tempCtx.measureText(text).width);
        tempCtx.font = `${config.fontWeight} ${superFontSize}px ${config.fontFamily}`;
        const superWidth = Math.ceil(tempCtx.measureText("%").width);
        const totalWidth = mainWidth + superWidth + 5;
        const textHeight = Math.ceil(mainFontSize * 1.0);
        tempCanvas.width = totalWidth;
        tempCanvas.height = textHeight;
        tempCtx.font = `${config.fontWeight} ${mainFontSize}px ${config.fontFamily}`;
        tempCtx.textAlign = "left";
        tempCtx.textBaseline = "middle";
        tempCtx.fillStyle = config.textColor;
        tempCtx.fillText(text, 0, textHeight / 2);
        tempCtx.font = `${config.fontWeight} ${superFontSize}px ${config.fontFamily}`;
        const superOffsetY = textHeight / 2 - mainFontSize * 0.15;
        tempCtx.fillText("%", mainWidth + 5, superOffsetY);
        return { img: tempCanvas, width: totalWidth, height: textHeight, arcAngle: textHeight / config.radius };
      };

      const initTextures = () => {
        textures.length = 0;
        const testTexture = createWordTexture(String(config.endNumber));
        if (!testTexture) return;
        config.itemSpacing = (testTexture.height / config.radius) * 0.8;
        const maxItems = Math.floor((2 * Math.PI) / config.itemSpacing);
        config.words = [];
        for (let i = maxItems - 1; i >= 0; i--) config.words.unshift((config.endNumber - i).toString());
        const visibleNumbers = ["96", "97", "98"];
        for (let i = 0; i < config.words.length; i++) {
          if (!visibleNumbers.includes(config.words[i])) continue;
          const tex = createWordTexture(config.words[i]);
          if (!tex) continue;
          textures.push({ ...tex, _originalIndex: i });
        }
      };

      const getRotationForNumber = (num: number) => {
        const index = config.words.indexOf(String(num));
        return index === -1 ? 0 : -index * config.itemSpacing;
      };

      const resizeCylinder = () => {
        if (isTouch && freezeFinal) return;
        const rawWidth = cylWrapper.offsetWidth;
        const rawHeight = cylWrapper.offsetHeight;
        const MAX_CANVAS_W = 1440;
        const MAX_CANVAS_H = 900;
        const canvasScale = Math.min(
          rawWidth > MAX_CANVAS_W ? MAX_CANVAS_W / rawWidth : 1,
          rawHeight > MAX_CANVAS_H ? MAX_CANVAS_H / rawHeight : 1
        );
        width = Math.round(rawWidth * canvasScale);
        height = Math.round(rawHeight * canvasScale);
        cylCanvas.width = width;
        cylCanvas.height = height;
        cylCanvas.style.width = rawWidth + "px";
        cylCanvas.style.height = rawHeight + "px";
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (window.innerWidth < config.mobileBreakpoint) {
          const mobileScale = width / 600;
          config.fontSize = Math.round(CYLINDER_CONFIG.fontSizeMobile * Math.min(1, mobileScale));
          config.radius = Math.round(CYLINDER_CONFIG.radiusMobile * Math.min(1, mobileScale));
          config.perspective = CYLINDER_CONFIG.perspectiveMobile;
          config.centerYPercent = CYLINDER_CONFIG.centerYPercentMobile;
        } else {
          const desktopScale = width / MAX_CANVAS_W;
          config.fontSize = Math.round(CYLINDER_CONFIG.fontSize * desktopScale);
          config.radius = Math.round(CYLINDER_CONFIG.radius * desktopScale);
          config.perspective = Math.round(CYLINDER_CONFIG.perspective * desktopScale);
          config.centerYPercent = CYLINDER_CONFIG.centerYPercent;
        }

        cachedFogTopEnd = config.centerYPercent - 0.05;
        cachedFogBottomStart = config.centerYPercent + 0.05;
        cachedFogTop = ctx.createLinearGradient(0, 0, 0, height * cachedFogTopEnd);
        cachedFogTop.addColorStop(0, "rgba(0,0,0,1)");
        cachedFogTop.addColorStop(0.6, "rgba(0,0,0,0.8)");
        cachedFogTop.addColorStop(1, "rgba(0,0,0,0)");
        cachedFogBottom = ctx.createLinearGradient(0, height * cachedFogBottomStart, 0, height);
        cachedFogBottom.addColorStop(0, "rgba(0,0,0,0)");
        cachedFogBottom.addColorStop(0.4, "rgba(0,0,0,0.8)");
        cachedFogBottom.addColorStop(1, "rgba(0,0,0,1)");

        if (rawWidth !== lastCylWidth) {
          initTextures();
          lastCylWidth = rawWidth;
          cylinderState.rotation = getRotationForNumber(CYLINDER_CONFIG.startNumber);
        }
        resizeTriggered = true;
      };

      const renderCylinder = () => {
        ctx.clearRect(0, 0, width, height);
        if (cylinderState.opacity <= 0) return;
        const centerX = width * 0.5;
        const centerY = height * config.centerYPercent;
        const angleCutoff = 0.7;
        const radius = config.radius;
        const perspective = config.perspective;
        const sliceHeight = config.sliceHeight;
        const rotation = cylinderState.rotation;
        const itemSpacing = config.itemSpacing;
        const minY = height * 0.1;
        const maxY = height * 0.9;

        for (const texture of textures) {
          const baseAngle = texture._originalIndex * itemSpacing + rotation;
          const cosBase = Math.cos(baseAngle);
          if (cosBase < angleCutoff) continue;
          const texImg = texture.img;
          const texWidth = texture.width;
          const texHeight = texture.height;
          const textureArcAngle = texture.arcAngle;
          const invTexHeight = 1 / texHeight;
          for (let sy = 0; sy < texHeight; sy += sliceHeight) {
            const relY = sy * invTexHeight - 0.5;
            const sliceAngle = baseAngle + relY * textureArcAngle;
            const cosSlice = Math.cos(sliceAngle);
            if (cosSlice < angleCutoff) continue;
            const sinSlice = Math.sin(sliceAngle);
            const worldY = sinSlice * radius;
            const depth = radius - radius * cosSlice;
            const scale = perspective / (perspective + depth);
            const screenY = centerY + worldY * scale;
            const destHeight = sliceHeight * scale * cosSlice;
            if (screenY + destHeight < minY) continue;
            if (screenY > maxY) break;
            const destWidth = texWidth * scale;
            const destX = centerX - destWidth * 0.5;
            ctx.drawImage(texImg, 0, sy, texWidth, sliceHeight, destX, screenY, destWidth, destHeight + 0.5);
          }
        }
        if (cachedFogTop && cachedFogBottom) {
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = cachedFogTop;
          ctx.fillRect(0, 0, width, height * cachedFogTopEnd);
          ctx.fillStyle = cachedFogBottom;
          ctx.fillRect(0, height * cachedFogBottomStart, width, height * (1 - cachedFogBottomStart));
          ctx.restore();
        }
      };

      const tickCylinder = () => {
        if (document.hidden) return;
        if (lastOpacity !== cylinderState.opacity) cylWrapper.style.opacity = String(cylinderState.opacity);
        const rotationChanged = lastRotation !== cylinderState.rotation;
        const opacityChanged = lastOpacity !== cylinderState.opacity;
        if (!rotationChanged && !opacityChanged && !resizeTriggered) return;
        lastRotation = cylinderState.rotation;
        lastOpacity = cylinderState.opacity;
        resizeTriggered = false;
        renderCylinder();
      };
      gsap.ticker.add(tickCylinder);
      tickerFns.push(tickCylinder);
      window.addEventListener("resize", resizeCylinder);
      cleanups.push(() => window.removeEventListener("resize", resizeCylinder));
      resizeCylinder();
      (
        window as Window & {
          cylinder?: {
            state: typeof cylinderState;
            getRotationForNumber: (num: number) => number;
            config: typeof config;
            setConfig: (cfg: Partial<typeof config>) => void;
          };
        }
      ).cylinder = {
        state: cylinderState,
        getRotationForNumber,
        config,
        setConfig: (newConfig) => {
          if (newConfig.perspective !== undefined) config.perspective = Number(newConfig.perspective);
          lastRotation = null;
          lastOpacity = null;
        },
      };

      // Attach cylinder intro to main timeline.
      const w = window.innerWidth;
      const h = window.innerHeight;
      let cylEndScale: number;
      let cylX: number;
      let cylEndY: number;
      let cylRot: number;
      if (w < 600) {
        cylEndScale = 0.66 + ((w - 270) * (1.26 - 0.66)) / (587 - 270);
        cylEndScale = Math.max(0.66, Math.min(1.26, cylEndScale));
        cylX = -2;
        cylEndY = -14 + ((h - 533) * (-27 - -14)) / (1111 - 533);
        cylEndY = Math.max(-27, Math.min(-14, cylEndY));
        cylRot = 12;
      } else {
        const W1 = 1101;
        const W2 = 1645;
        const W3 = 2215;
        cylRot = -5;
        if (w <= W1) {
          cylEndScale = 0.84;
          cylX = 0;
          cylEndY = -9;
        } else if (w <= W2) {
          const t = (w - W1) / (W2 - W1);
          cylEndScale = 0.84 + t * (1.1 - 0.84);
          cylX = 0 + t * (-1 - 0);
          cylEndY = -9 + t * (-7 - -9);
        } else if (w <= W3) {
          const t = (w - W2) / (W3 - W2);
          cylEndScale = 1.1 + t * (1.16 - 1.1);
          cylX = -1 + t * (-3 - -1);
          cylEndY = -7;
        } else {
          cylEndScale = 1.16;
          cylX = -3;
          cylEndY = -7;
        }
      }
      gsap.set("#kinetic-cylinder-wrapper", { xPercent: -50, yPercent: -50, x: 0, y: "12vh", scale: 0.34, rotation: 0, opacity: 0 });
      pinnedTl.to("#kinetic-cylinder-wrapper", { xPercent: -50, yPercent: -50, x: `${cylX}vw`, y: `${cylEndY}vh`, scale: cylEndScale, rotation: cylRot, opacity: 1, duration: 9, ease: "power2.out" }, 13 + I);
      pinnedTl.to(cylinderState, { rotation: getRotationForNumber(98), opacity: 1, duration: 9, ease: "none" }, 13 + I);
    }
  }

  // Tunnel module (source adapted).
  const tunnelCanvas = container.querySelector<HTMLCanvasElement>("#kinetic-tunnel-canvas");
  if (tunnelCanvas) {
    const TUNNEL_CONFIG = { count: 6, twistSpeed: 9.0, lwBase: 0.45, lwScale: 0.0028, maxOp: 0.82 };
    const FP_TUNNEL_START = 0.257;
    const FP_SHRINK_START = 0.634;
    const FP_SHRINK_END = 0.926;

    class Tunnel {
      canvas: HTMLCanvasElement;
      ctx: CanvasRenderingContext2D;
      rings: Array<{ t: number; frags: Array<{ offset: number; len: number }>; opacity: number }> = [];
      globalRot = 0;
      shrink = 1.0;
      W = 0;
      H = 0;
      cx = 0;
      spacing = 0;
      travel = 0;
      R_NEAR = 0;
      R_FAR = 0;
      lastWidth = 0;
      _hasConicGrad =
        typeof CanvasRenderingContext2D !== "undefined" &&
        typeof CanvasRenderingContext2D.prototype.createConicGradient === "function";
      _prevProgress = 0;
      time = 0;
      constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Tunnel canvas context unavailable");
        this.ctx = ctx;
        const resizeTunnel = () => {
          const newWidth = window.innerWidth;
          const widthChanged = newWidth !== this.lastWidth;
          this.resize();
          if (widthChanged) this.build();
        };
        window.addEventListener("resize", resizeTunnel);
        cleanups.push(() => window.removeEventListener("resize", resizeTunnel));
        this.resize();
        this.build();
      }
      resize() {
        if (isTouch && freezeFinal) return;
        const dpr = Math.min(devicePixelRatio, 1);
        const newW = window.innerWidth;
        const newH = window.innerHeight;
        const targetW = newW * dpr;
        const targetH = newH * dpr;
        if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
          this.canvas.width = targetW;
          this.canvas.height = targetH;
          this.ctx = this.canvas.getContext("2d")!;
          this.ctx.setTransform(1, 0, 0, 1, 0, 0);
          this.ctx.scale(dpr, dpr);
        }
        this.W = newW;
        this.H = newH;
        this.lastWidth = newW;
        this.cx = this.W * 0.5;
        this.spacing = this.H * 0.75;
        this.travel = this.H + this.spacing * 0.35;
        this.R_NEAR = this.W * 0.48;
        this.R_FAR = this.W * 0.1664;
      }
      build() {
        this.rings = [];
        const N = TUNNEL_CONFIG.count;
        for (let i = 0; i < N; i++) {
          const t = 1.0 + (i / (N - 1)) * 0.35;
          let frags: Array<{ offset: number; len: number }>;
          if (i === 2 || i === 4) {
            const arcLen = 0.35 * Math.PI * 2;
            const gap = 0.15 * Math.PI * 2;
            frags = [
              { offset: Math.PI * 0.5, len: arcLen },
              { offset: Math.PI * 0.5 + arcLen + gap, len: arcLen },
            ];
          } else if (i % 2 === 1) {
            const extraGap = 0.6 + Math.random() * 1.4;
            const newGap = 0.3 * (1 + extraGap);
            const arcLen = Math.max(0.15, 1 - newGap) * Math.PI * 2;
            frags = [{ offset: Math.PI * 0.5 - arcLen * 0.5, len: arcLen }];
          } else {
            const arcLen = 0.7 * Math.PI * 2;
            frags = [{ offset: Math.PI * 0.5 - arcLen * 0.5, len: arcLen }];
          }
          this.rings.push({ t, frags, opacity: 0 });
        }
      }
      render(progress: number, velocity: number) {
        const ctx = this.ctx;
        const { W, H, cx, spacing, travel, R_NEAR, R_FAR } = this;
        ctx.clearRect(0, 0, W, H);
        if (progress < 0.01) return;
        const easedProgress = progress * progress;
        const dynamicSpacing = spacing * (0.5 + easedProgress * 0.75);
        const yBase = H - progress * travel;
        this.globalRot += velocity * TUNNEL_CONFIG.twistSpeed * 0.09;
        this.globalRot += 0.012;
        this.time += 0.016;
        const jitterIntensity = Math.min(1, progress * 1.35);
        for (let i = 0; i < this.rings.length; i++) {
          const ring = this.rings[i];
          const finalY = yBase - (1 - ring.t) * dynamicSpacing;
          const extraPush = progress > 0.7 ? (progress - 0.7) / 0.3 : 0;
          const adjustedY = finalY - extraPush * extraPush * H * 1.5;
          if (adjustedY < -H * 0.5 || adjustedY > H * 1.2) continue;
          const yNorm = Math.max(0, Math.min(1, adjustedY / H));
          const rxBase = R_FAR + (R_NEAR - R_FAR) * Math.pow(yNorm, 1.4);
          const rx = rxBase * this.shrink;
          if (rx < 1) continue;
          const tilt = 0.15 + yNorm * 0.35;
          const ry = rx * tilt;
          const entryFade = adjustedY > H ? 0 : Math.min(1, (H - adjustedY) / (H * 0.45));
          ring.opacity = Math.pow(entryFade, 1.8) * TUNNEL_CONFIG.maxOp;
          if (ring.opacity < 0.004) continue;
          const lw = Math.max(2.0, TUNNEL_CONFIG.lwBase + rx * TUNNEL_CONFIG.lwScale);
          for (let f = 0; f < ring.frags.length; f++) {
            const frag = ring.frags[f];
            const sa = this.globalRot + frag.offset;
            const ea = sa + frag.len;
            const jAmt = Math.sin(this.time * 60 + i * 7 + f) * 3 * jitterIntensity;
            const ji = jitterIntensity;
            if (ji > 0.01) {
              ctx.save();
              ctx.translate(jAmt, jAmt * 0.3);
              ctx.globalCompositeOperation = "lighter";
              ctx.lineWidth = lw * 18;
              ctx.globalAlpha = ring.opacity * 0.35 * ji;
              ctx.strokeStyle = "rgba(214,228,235,0.25)";
              ctx.beginPath();
              ctx.ellipse(cx, adjustedY, rx, ry, 0, sa, ea);
              ctx.stroke();
              ctx.lineWidth = lw * 5;
              ctx.globalAlpha = ring.opacity * 0.6 * ji;
              ctx.strokeStyle = "rgba(214,228,235,0.35)";
              ctx.beginPath();
              ctx.ellipse(cx, adjustedY, rx, ry, 0, sa, ea);
              ctx.stroke();
              ctx.restore();
            }
            ctx.globalCompositeOperation = "source-over";
            ctx.lineWidth = lw;
            ctx.globalAlpha = ring.opacity;
            ctx.strokeStyle = "rgba(0,0,0,0.45)";
            ctx.beginPath();
            ctx.ellipse(cx, adjustedY, rx, ry, 0, sa, ea);
            ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
    }

    const tunnel = new Tunnel(tunnelCanvas);
    let tunnelProgress = 0;
    let tunnelVelocity = 0;
    const tickTunnel = () => {
      const fp = particleState.formProgress || 0;
      const fpRange = Math.max(0.01, 1.0 - FP_TUNNEL_START);
      tunnelProgress = Math.max(0, Math.min(1, (fp - FP_TUNNEL_START) / fpRange));
      if (fp <= FP_SHRINK_START) tunnel.shrink = 1.0;
      else if (fp >= FP_SHRINK_END) tunnel.shrink = 0.5;
      else {
        const shrRange = Math.max(0.01, FP_SHRINK_END - FP_SHRINK_START);
        tunnel.shrink = 1.0 - 0.5 * ((fp - FP_SHRINK_START) / shrRange);
      }
      const currentProgress = pinnedTl ? pinnedTl.progress() : 0;
      const scrollImpulse = (currentProgress - tunnel._prevProgress) * 60;
      tunnel._prevProgress = currentProgress;
      tunnelVelocity = tunnelVelocity * 0.82 + scrollImpulse;
      tunnel.render(tunnelProgress, tunnelVelocity);
    };
    gsap.ticker.add(tickTunnel);
    tickerFns.push(tickTunnel);
  }

  // Particle-canvas transforms + blob choreography + explosion canvas.
  const root = container;
  const pqCanvas = container.querySelector<HTMLCanvasElement>("#kinetic-particle-qmark-canvas");
  const blobBgPreviewEl = container.querySelector<HTMLElement>("#kinetic-blob-bg-preview");
  const blobCarrier = container.querySelector<HTMLElement>("#kinetic-blob-carrier");
  const blob1 = container.querySelector<HTMLElement>("#kinetic-blob1");
  const blob2 = container.querySelector<HTMLElement>("#kinetic-blob2");
  const blob3 = container.querySelector<HTMLElement>("#kinetic-blob3");
  if (pqCanvas) {
    gsap.set(pqCanvas, {
      scale: 0.85,
      opacity: 0,
      y: 0,
      transformOrigin: "center center",
      filter: "hue-rotate(0deg) brightness(60%) saturate(10%) contrast(200%)",
    });
    pinnedTl.to(pqCanvas, { opacity: 1, duration: 1.5, ease: "power2.out" }, 0);
    pinnedTl.to(pqCanvas, { scale: 1.3, duration: I + 3.5, ease: "power2.out" }, 0);
    pinnedTl.to(pqCanvas, { y: 14, duration: I + 3.5, ease: "power2.out" }, 0);
    pinnedTl.to(pqCanvas, { scale: 1.65, duration: 6.0, ease: "power2.inOut" }, I + 3.5);
    pinnedTl.to(pqCanvas, { y: 55, duration: 6.0, ease: "power2.inOut" }, I + 3.5);
    pinnedTl.to(pqCanvas, { opacity: 0, duration: 1.3, ease: "power2.in" }, 9.5 + I);
  }

  const paletteGreen1 = { bg: "hsl(156, 32%, 94%)", b1: "hsl(146, 37%, 88%)", b2: "hsl(178, 27%, 90%)", b3: "hsl(128, 32%, 92%)" };
  const paletteGreen2 = { bg: "hsl(123, 33%, 94%)", b1: "hsl(113, 38%, 88%)", b2: "hsl(141, 28%, 90%)", b3: "hsl(96, 33%, 91%)" };
  const paletteWarm = { bg: "hsl(40, 35%, 94%)", b1: "hsl(30, 40%, 88%)", b2: "hsl(45, 30%, 90%)", b3: "hsl(15, 35%, 91%)" };
  if (blob1 && blob2 && blob3 && blobCarrier) {
    gsap.set([blob1, blob2, blob3], { opacity: 0 });
    gsap.set(blobCarrier, { opacity: 1 });
    if (window.innerWidth < 600) {
      gsap.set(blob1, { x: "5vw", y: "5vh", scale: 0.3, rotation: 15 });
      gsap.set(blob2, { xPercent: -50, yPercent: -50, x: "-15vw", y: "-40vh", scale: 0.25, rotation: -10 });
      gsap.set(blob3, { xPercent: -50, yPercent: -50, x: "-9.5vw", y: "-16vh", scale: 0.25, rotation: -30 });
    } else {
      gsap.set(blob1, { x: "0.5vw", y: "0.5vh", scale: 0.95, rotation: 29 });
      gsap.set(blob2, { xPercent: -50, yPercent: -50, x: "0vw", y: "0vh", scale: 0.7, rotation: 0 });
      gsap.set(blob3, { x: "0.5vw", y: "46.5vh", scale: 1.0, rotation: -36 });
    }
    pinnedTl.to(blob1, { opacity: 1.0, duration: 1.5, ease: "power1.out" }, I - 2);
    pinnedTl.to(blob2, { opacity: 1.0, duration: 1.5, ease: "power1.out" }, I - 1.9);
    pinnedTl.to(blob3, { opacity: 1.0, duration: 1.5, ease: "power1.out" }, I - 1.8);

    pinnedTl.to(root, { "--blob-1-color": paletteGreen1.b1, "--blob-2-color": paletteGreen1.b2, "--blob-3-color": paletteGreen1.b3, "--blob-bg-preview": paletteGreen1.bg, duration: 2.14, ease: "none" }, 2.16 + I);
    pinnedTl.to(root, { "--blob-1-color": paletteGreen2.b1, "--blob-2-color": paletteGreen2.b2, "--blob-3-color": paletteGreen2.b3, "--blob-bg-preview": paletteGreen2.bg, duration: 6.5, ease: "none" }, 4.3 + I);
    pinnedTl.to(root, { "--blob-1-color": paletteWarm.b1, "--blob-2-color": paletteWarm.b2, "--blob-3-color": paletteWarm.b3, "--blob-bg-preview": paletteWarm.bg, duration: 0.16, ease: "power2.in" }, 10.8 + I);

    const isMobile = window.innerWidth < 600;
    if (isMobile) {
      pinnedTl.to(blob1, {
        keyframes: { "0%": { x: "5vw", y: "5vh", scale: 0.3, rotation: 15 }, "22.00%": { x: "10vw", y: "10vh", scale: 1.04, rotation: 20 }, "46.00%": { x: "12vw", y: "8vh", scale: 0.55, rotation: 22 }, "57.60%": { x: "10vw", y: "16vh", scale: 1.76, rotation: 25 }, "84.00%": { x: "8vw", y: "14vh", scale: 1.62, rotation: 28 }, "100%": { x: "7vw", y: "13vh", scale: 1.55, rotation: 30 }, easeEach: "sine.inOut" },
        duration: 25,
        ease: "none",
      }, I - 2);
      pinnedTl.to(blob2, {
        keyframes: { "0%": { x: "-15vw", y: "-40vh", scale: 0.25, rotation: -10 }, "22.00%": { x: "-40vw", y: "-37vh", scale: 1.17, rotation: -15 }, "46.00%": { x: "-38vw", y: "-37vh", scale: 1.0, rotation: -18 }, "57.60%": { x: "-40vw", y: "-32vh", scale: 1.62, rotation: -20 }, "84.00%": { x: "-42vw", y: "-30vh", scale: 1.49, rotation: -22 }, "100%": { x: "-43vw", y: "-29vh", scale: 1.42, rotation: -23 }, easeEach: "sine.inOut" },
        duration: 25,
        ease: "none",
      }, I - 2);
      pinnedTl.to(blob3, {
        keyframes: { "0%": { x: "-9.5vw", y: "-16vh", scale: 0.25, rotation: -30 }, "29.96%": { x: "-5vw", y: "-10vh", scale: 1.11, rotation: -25 }, "65.27%": { x: "0vw", y: "0vh", scale: 0.5, rotation: -15 }, "82.35%": { x: "0vw", y: "1vh", scale: 1.49, rotation: 0 }, "100%": { x: "0vw", y: "0vh", scale: 1.35, rotation: 5 }, easeEach: "sine.inOut" },
        duration: 16.99,
        ease: "none",
      }, I - 1.59);
    } else {
      (window as Window & { blobTweens?: Record<string, gsap.core.Timeline> }).blobTweens =
        (window as Window & { blobTweens?: Record<string, gsap.core.Timeline> }).blobTweens || {};
      (window as Window & { blobTweens?: Record<string, gsap.core.Timeline> }).blobTweens!.blob1 = pinnedTl.to(blob1, {
        keyframes: { "0%": { x: "0.5vw", y: "0.5vh", scale: 0.95, rotation: 29 }, "28.59%": { x: "9vw", y: "9.5vh", scale: 0.75, rotation: 29 }, "35.04%": { x: "16.5vw", y: "23vh", scale: 0.75, rotation: 29 }, "47.94%": { x: "16.5vw", y: "23vh", scale: 0.7, rotation: 29 }, "63.40%": { x: "13vw", y: "26.5vh", scale: 1.1, rotation: 29 }, "84.00%": { x: "1vw", y: "2vh", scale: 0.85, rotation: 29 }, "100%": { x: "-1vw", y: "-2vh", scale: 0.8, rotation: 29 }, easeEach: "sine.inOut" },
        duration: 25,
        ease: "none",
      }, I - 2);
      (window as Window & { blobTweens?: Record<string, gsap.core.Timeline> }).blobTweens!.blob2 = pinnedTl.to(blob2, {
        keyframes: { "0%": { x: "0vw", y: "0vh", scale: 0.7, rotation: 0 }, "31.83%": { x: "-9vw", y: "-15vh", scale: 1.35, rotation: 0 }, "54.20%": { x: "-9vw", y: "-15vh", scale: 0.35, rotation: -85 }, "84.00%": { x: "-9vw", y: "2vh", scale: 1.0, rotation: -85 }, "100%": { x: "-9vw", y: "5vh", scale: 1.0, rotation: -85 }, easeEach: "sine.inOut" },
        duration: 25,
        ease: "none",
      }, I - 2);
      (window as Window & { blobTweens?: Record<string, gsap.core.Timeline> }).blobTweens!.blob3 = pinnedTl.to(blob3, {
        keyframes: { "0%": { x: "0.5vw", y: "46.5vh", scale: 1.0, rotation: -36 }, "32.16%": { x: "-1vw", y: "0.5vh", scale: 1.1, rotation: -41 }, "56.62%": { x: "-1vw", y: "0.5vh", scale: 0.5, rotation: -45 }, "83.74%": { x: "-23vw", y: "0vh", scale: 0.95, rotation: 110 }, "100%": { x: "-28vw", y: "-1vh", scale: 0.95, rotation: 115 }, easeEach: "sine.inOut" },
        duration: 24.6,
        ease: "none",
      }, I - 1.6);
    }
  }
  if (blobBgPreviewEl) {
    pinnedTl.to(blobBgPreviewEl, { opacity: 1, duration: 3, ease: "power2.out" }, 3.3 + I);
  }

  interface ExplosionParticle {
    scatteredX: number;
    scatteredY: number;
    gatheredX: number;
    gatheredY: number;
    size: number;
    colorIndex: number;
    maxScaleFactor: number;
  }
  interface ExplosionCanvas extends HTMLCanvasElement {
    _dpr?: number;
    _ctx?: CanvasRenderingContext2D;
    _initialized?: boolean;
    _particles?: ExplosionParticle[];
  }
  const EXPLOSION_COLORS = ["#fdeecf", "#fff4c9", "#f7f4d2", "#fff1d3", "#f7e7c6"];
  let explosionCanvas: ExplosionCanvas | null = null;
  const explosionAnimObj = { progress: 0, scaleProgress: 0, opacity: 0 };
  let explosionRenderActive = false;
  let explosionTickerFn: (() => void) | null = null;
  const renderExplosion = () => {
    if (!explosionCanvas?._ctx || !explosionCanvas?._particles) return;
    const ctx = explosionCanvas._ctx;
    const progress = explosionAnimObj.progress;
    const scaleProgress = explosionAnimObj.scaleProgress || 0;
    const particles = explosionCanvas._particles;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const PI2 = Math.PI * 2;
    for (let c = 0; c < EXPLOSION_COLORS.length; c++) {
      ctx.fillStyle = EXPLOSION_COLORS[c];
      ctx.beginPath();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.colorIndex !== c) continue;
        const currentX = p.gatheredX + (p.scatteredX - p.gatheredX) * progress;
        const currentY = p.gatheredY + (p.scatteredY - p.gatheredY) * progress;
        const baseSize = p.size * (0.4 + progress * 0.6);
        const scaleFactor = 1 + scaleProgress * (p.maxScaleFactor - 1);
        const currentSize = baseSize * scaleFactor;
        ctx.moveTo(currentX + currentSize, currentY);
        ctx.arc(currentX, currentY, currentSize, 0, PI2);
      }
      ctx.fill();
    }
  };
  const resizeExplosionCanvas = () => {
    if (isTouch && freezeFinal) return;
    if (!explosionCanvas || !explosionCanvas._ctx) return;
    const dpr = adaptiveDPR.get();
    explosionCanvas.width = window.innerWidth * dpr;
    explosionCanvas.height = window.innerHeight * dpr;
    explosionCanvas._dpr = dpr;
    explosionCanvas._ctx.setTransform(1, 0, 0, 1, 0, 0);
    explosionCanvas._ctx.scale(dpr, dpr);
    if (!explosionRenderActive && explosionCanvas._initialized) renderExplosion();
  };
  const initExplosionCanvas = () => {
    const canvas = document.createElement("canvas") as ExplosionCanvas;
    const dpr = adaptiveDPR.get();
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0;z-index:4;mix-blend-mode:luminosity;";
    canvas._dpr = dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    canvas._ctx = ctx;
    canvas._ctx.scale(dpr, dpr);
    canvas._initialized = false;
    if (blobCarrier?.parentNode) blobCarrier.parentNode.insertBefore(canvas, blobCarrier.nextSibling);
    else document.body.appendChild(canvas);
    const off = adaptiveDPR.onChange(resizeExplosionCanvas);
    window.addEventListener("resize", resizeExplosionCanvas);
    cleanups.push(() => {
      window.removeEventListener("resize", resizeExplosionCanvas);
      off();
    });
    return canvas;
  };
  const initExplosionPositions = () => {
    if (!explosionCanvas || explosionCanvas._initialized) return;
    const centerX = window.innerWidth / 2 - window.innerWidth * 0.3;
    const centerY = window.innerHeight * 0.49;
    const gatherWidth = window.innerWidth * 0.7;
    const gatherHeight = 30;
    const particles: ExplosionParticle[] = [];
    const particleCount = 400;
    for (let i = 0; i < particleCount; i++) {
      const colorIndex = Math.floor(Math.random() * EXPLOSION_COLORS.length);
      const randomValue = Math.pow(Math.random(), 3);
      particles.push({
        scatteredX: (Math.random() * 3.0 - 1.5) * (explosionCanvas.width || window.innerWidth),
        scatteredY: (Math.random() * 3.0 - 1.5) * (explosionCanvas.height || window.innerHeight),
        gatheredX: centerX + (Math.random() - 0.5) * gatherWidth,
        gatheredY: centerY + (Math.random() - 0.5) * gatherHeight,
        size: 1 + Math.random() * 3,
        colorIndex,
        maxScaleFactor: 1 + randomValue * 6,
      });
    }
    explosionCanvas._particles = particles;
    explosionCanvas._initialized = true;
  };
  const startExplosionRender = () => {
    if (explosionRenderActive) return;
    explosionRenderActive = true;
    explosionTickerFn = () => {
      if (document.hidden) return;
      if (!explosionRenderActive) return;
      renderExplosion();
      if (explosionAnimObj.progress >= 0.65) explosionRenderActive = false;
    };
    gsap.ticker.add(explosionTickerFn);
    tickerFns.push(explosionTickerFn);
  };

  explosionCanvas = initExplosionCanvas();
  if (explosionCanvas) {
    const explosionStart = 10.8 + I;
    const burstDur = 2.4;
    const hangDur = 9.6;
    pinnedTl.set(explosionCanvas, { opacity: 0, scale: 1, scaleX: -1, transformOrigin: "center center" }, explosionStart);
    pinnedTl.add(() => {
      initExplosionPositions();
      startExplosionRender();
    }, explosionStart);
    explosionAnimObj.progress = 0;
    explosionAnimObj.scaleProgress = 0;
    pinnedTl.to(explosionAnimObj, { progress: 0.42, duration: burstDur, ease: "none" }, explosionStart);
    pinnedTl.to(explosionAnimObj, { scaleProgress: 0.42, duration: burstDur, ease: "none" }, explosionStart);
    pinnedTl.to(explosionCanvas, { scaleX: -1.25, scaleY: 1.25, duration: burstDur, ease: "none" }, explosionStart);
    pinnedTl.to(explosionCanvas, { opacity: 1, duration: 0.04, ease: "none" }, explosionStart + 0.23);
    pinnedTl.to(explosionAnimObj, { opacity: 1, duration: 0.04, ease: "none" }, explosionStart + 0.23);
    pinnedTl.to(explosionAnimObj, { progress: 0.65, duration: hangDur, ease: "power2.out" }, explosionStart + burstDur);
    pinnedTl.to(explosionCanvas, { scaleX: -1.5, scaleY: 1.5, duration: hangDur, ease: "power1.out" }, explosionStart + burstDur);
    pinnedTl.to(explosionAnimObj, { scaleProgress: 0.65, duration: hangDur, ease: "power2.out" }, explosionStart + burstDur);
    cleanups.push(() => {
      explosionRenderActive = false;
      if (explosionCanvas?.parentNode) explosionCanvas.parentNode.removeChild(explosionCanvas);
      explosionCanvas = null;
    });
  }

  // "NIGDY" word sequence (plate + text + glow).
  const b3El = container.querySelector<HTMLElement>("#kinetic-block-3");
  const mobB3 = b3El?.querySelector<HTMLElement>(".block-3-mobile");
  const dskB3 = b3El?.querySelector<HTMLElement>(".block-3-desktop");
  const isMobileB3 = !!(mobB3 && window.getComputedStyle(mobB3).display !== "none");
  const b3Container = (isMobileB3 ? mobB3 : dskB3) || b3El || null;
  const nigdyPlate = b3Container?.querySelector<HTMLElement>(".nigdy-plate");
  const nigdyText = b3Container?.querySelector<HTMLElement>(".nigdy-text");
  const nigdyGlow = container.querySelector<HTMLElement>("#kinetic-nigdy-glow");
  if (nigdyGlow && nigdyText) {
    const positionNigdyGlow = () => {
      if (isTouch && freezeFinal) return;
      const nigdyRect = nigdyText.getBoundingClientRect();
      const stageRect = container.getBoundingClientRect();
      const glowLeft = nigdyRect.left + nigdyRect.width / 2 - stageRect.left;
      const glowTop = nigdyRect.top + nigdyRect.height / 2 - stageRect.top;
      const isMobileGlow = window.innerWidth < 600;
      const glowOffsetX = isMobileGlow ? 54 : -160;
      const glowOffsetY = isMobileGlow ? -43 : 0;
      nigdyGlow.style.left = glowLeft + glowOffsetX + "px";
      nigdyGlow.style.top = glowTop + glowOffsetY + "px";
    };
    requestAnimationFrame(positionNigdyGlow);
    window.addEventListener("resize", positionNigdyGlow);
    cleanups.push(() => window.removeEventListener("resize", positionNigdyGlow));
    gsap.set(nigdyGlow, { scale: 0, transformOrigin: "center center" });

    const bgStart = 13.8 + I;
    const textStart = 15.8 + I;
    const textDuration = 7.2;
    const bgIntroDuration = 9.2;
    const explosionStartGlow = 10.8 + I;
    pinnedTl.to(nigdyGlow, { opacity: 1, duration: bgIntroDuration * 0.25, ease: "power2.out" }, explosionStartGlow);
    pinnedTl.to(nigdyGlow, { scale: 1, duration: bgIntroDuration, ease: "power2.out" }, explosionStartGlow);

    if (nigdyPlate) {
      gsap.set(nigdyPlate, { xPercent: -50, yPercent: -50, scale: 0.5, rotation: 45, opacity: 0.3 });
      pinnedTl.to(nigdyPlate, { opacity: 1, scale: 0.85, rotation: -9, duration: bgIntroDuration, ease: "power2.out" }, bgStart);
    }
    pinnedTl.to(nigdyText, { scale: 1.2, fontWeight: 700, duration: textDuration, ease: "power2.out" }, textStart);
    pinnedTl.to(nigdyText, { rotation: -5, duration: textDuration, ease: "power2.out" }, textStart);
  }

  // P3.1: desktop large resize recovery.
  const initW = window.innerWidth;
  const initH = window.innerHeight;
  const THRESHOLD = 0.15;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  const reloadResizeHandler = () => {
    if (isTouch) return;
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      const deltaW = Math.abs(window.innerWidth - initW) / initW;
      const deltaH = Math.abs(window.innerHeight - initH) / initH;
      if (deltaW > THRESHOLD || deltaH > THRESHOLD) window.location.reload();
    }, 500);
  };
  window.addEventListener("resize", reloadResizeHandler);
  cleanups.push(() => {
    window.removeEventListener("resize", reloadResizeHandler);
    if (reloadTimer) clearTimeout(reloadTimer);
  });
  const _paused = { value: false };
  const pause = () => {
    if (_paused.value) return;
    _paused.value = true;
    tickerFns.forEach((fn) => gsap.ticker.remove(fn));
    gsapInstances.forEach((tl) => (tl as gsap.core.Timeline).pause?.());
  };
  const resume = () => {
    if (!_paused.value) return;
    _paused.value = false;
    tickerFns.forEach((fn) => gsap.ticker.add(fn));
    gsapInstances.forEach((tl) => (tl as gsap.core.Timeline).resume?.());
  };
  const kill = () => {
    pause();
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        // noop
      }
    });
    gsapInstances.forEach((tl) => {
      (tl as gsap.core.Timeline).scrollTrigger?.kill();
      (tl as gsap.core.Timeline).kill?.();
    });
    (window as Window & { pinnedTl?: gsap.core.Timeline | null }).pinnedTl = null;
    (window as Window & { BRIDGE_I?: number | null }).BRIDGE_I = null;
    (window as Window & { cylinder?: unknown; particleQmark?: unknown; blobTweens?: unknown }).cylinder = null;
    (window as Window & { cylinder?: unknown; particleQmark?: unknown; blobTweens?: unknown }).particleQmark = null;
    (window as Window & { cylinder?: unknown; particleQmark?: unknown; blobTweens?: unknown }).blobTweens = null;
    timerIds.forEach((id) => clearTimeout(id));
    (gsap.ticker as unknown as { fps: (value: number) => void }).fps(prevFps);
    freezeFinal = false;
    mobileResizeLock = false;
  };

  // Keep as window handle to mirror source contract.
  (window as Window & { kineticSection?: KineticHandle }).kineticSection = { kill, pause, resume };
  void mobileResizeLock;
  return { kill, pause, resume };
}
