import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initBlok45Stars } from "./blok45Stars";

type Blok45Handle = { kill: () => void; pause: () => void; resume: () => void };
type StarsBridge = { triggerAuto: number; triggerManual: number; btnElement: HTMLElement | null; wake?: () => void };

const getStarsBridge = (): StarsBridge => {
  const w = window as Window & { _blok45StarsState?: StarsBridge };
  if (!w._blok45StarsState) {
    w._blok45StarsState = { triggerAuto: 0, triggerManual: 0, btnElement: null };
  }
  return w._blok45StarsState;
};

export function runBlok45(container: HTMLElement, waveWrap: HTMLElement): Blok45Handle {
  gsap.registerPlugin(ScrollTrigger);
  const starsBridge = getStarsBridge();
  const primaryBtn = container.querySelector<HTMLElement>("#blok-4-5-btn");
  if (primaryBtn) starsBridge.btnElement = primaryBtn;
  const stars = initBlok45Stars(container);

  const gsapInstances: Array<gsap.core.Animation | ScrollTrigger> = [];
  const cleanups: Array<() => void> = [];
  const pauseHooks: Array<() => void> = [];
  const resumeHooks: Array<() => void> = [];
  const wavePaths = Array.from(waveWrap.querySelectorAll<SVGPathElement>(".wave-path"));
  gsap.set(waveWrap, { autoAlpha: 0 });

  if (wavePaths.length === 4) {
    const PI = Math.PI;
    const PI2 = PI * 2;
    const NUM_PATHS = 4;
    const NUM_POINTS = 8;
    const SEG = NUM_POINTS - 1;
    const DELAY_MAX = 180;
    const PER_PATH = [
      { delay: 0, duration: 850 },
      { delay: 90, duration: 900 },
      { delay: 200, duration: 950 },
      { delay: 340, duration: 480 },
    ];

    const r2 = (x: number) => Math.round(x * 100) / 100;
    const elasticOut = (t: number, amplitude: number, period: number) => {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      const s = (period / PI2) * Math.asin(1 / amplitude);
      return amplitude * Math.pow(2, -10 * t) * Math.sin(((t - s) * PI2) / period) + 1;
    };
    const backOut = (t: number, ov: number) => {
      const u = t - 1;
      return u * u * ((ov + 1) * u + ov) + 1;
    };
    const power3Out = (t: number) => {
      const u = 1 - t;
      return 1 - u * u * u;
    };

    const easeFns = [
      (t: number) => elasticOut(t, 1.0, 0.35),
      (t: number) => elasticOut(t, 1.0, 0.45),
      (t: number) => backOut(t, 1.2),
      (t: number) => power3Out(t),
    ];

    const delayPoints = new Float64Array(NUM_POINTS);
    for (let i = 0; i < NUM_POINTS; i++) {
      delayPoints[i] = (i / (NUM_POINTS - 1)) * DELAY_MAX;
    }

    const P = new Float64Array(SEG);
    const CP = new Float64Array(SEG);
    const INV = 100 / SEG;
    for (let i = 0; i < SEG; i++) {
      P[i] = Math.round((i + 1) * INV * 100) / 100;
      CP[i] = Math.round((P[i] - INV / 2) * 100) / 100;
    }

    const TPL_PRE: string[] = [];
    const TPL_MID: string[] = [];
    const TPL_POST: string[] = [];
    for (let i = 0; i < SEG; i++) {
      TPL_PRE[i] = " C " + CP[i] + " ";
      TPL_MID[i] = " " + CP[i] + " ";
      TPL_POST[i] = " " + P[i] + " ";
    }

    let maxTime = 0;
    for (let p = 0; p < NUM_PATHS; p++) {
      const t = PER_PATH[p].delay + PER_PATH[p].duration + DELAY_MAX;
      if (t > maxTime) maxTime = t;
    }

    const pointsBuf = new Float64Array(NUM_POINTS);

    const updatePath = (time: number, duration: number, pathIdx: number) => {
      const ease = easeFns[pathIdx];
      for (let i = 0; i < NUM_POINTS; i++) {
        const raw = (time - delayPoints[i]) / duration;
        const t = raw < 0 ? 0 : raw > 1 ? 1 : raw;
        pointsBuf[i] = r2(100 - ease(t) * 100);
      }
      let s = "M 0 100 V " + pointsBuf[0];
      for (let i = 0; i < SEG; i++) {
        s += TPL_PRE[i] + pointsBuf[i] + TPL_MID[i] + pointsBuf[i + 1] + TPL_POST[i] + pointsBuf[i + 1];
      }
      return s + " V 100 H 0";
    };

    const render = (time: number) => {
      const clamped = Math.max(0, Math.min(maxTime, time));
      for (let i = 0; i < NUM_PATHS; i++) {
        const d = updatePath(clamped - PER_PATH[i].delay, PER_PATH[i].duration, i);
        wavePaths[i].setAttribute("d", d);
      }
    };

    let currentTime = 0;
    let isAnimating = false;
    let reverse = false;
    let lastNow = 0;
    let tickFn: (() => void) | null = null;
    let isOpened = false;

    const stopTicker = () => {
      if (!tickFn) return;
      gsap.ticker.remove(tickFn);
      tickFn = null;
      isAnimating = false;
    };

    const tick = () => {
      const now = performance.now();
      const elapsed = lastNow > 0 ? now - lastNow : 0;
      lastNow = now;
      if (!isAnimating) return;

      currentTime += reverse ? -elapsed : elapsed;
      if (currentTime <= 0) {
        currentTime = 0;
        render(0);
        stopTicker();
        isOpened = false;
        gsap.set(waveWrap, { autoAlpha: 0 });
        return;
      }
      if (currentTime >= maxTime) {
        currentTime = maxTime;
        render(maxTime);
        stopTicker();
        isOpened = true;
        return;
      }
      render(currentTime);
    };

    const startTicker = () => {
      if (tickFn) return;
      lastNow = performance.now();
      tickFn = tick;
      isAnimating = true;
      gsap.ticker.add(tickFn);
    };

    const playOpen = () => {
      if (isOpened && !isAnimating) return;
      gsap.set(waveWrap, { autoAlpha: 1 });
      reverse = false;
      startTicker();
    };

    const playClose = () => {
      if (!isOpened && !isAnimating && currentTime <= 0) return;
      gsap.set(waveWrap, { autoAlpha: 1 });
      reverse = true;
      startTicker();
    };

    // Init in fully closed state.
    render(0);
    currentTime = 0;
    isOpened = false;
    gsap.set(waveWrap, { autoAlpha: 0 });

    const openTarget = container.querySelector<HTMLElement>("#blok-4-5-ludzie-wchodza");
    if (openTarget) {
      const stWaveOpen = ScrollTrigger.create({
        trigger: openTarget,
        start: "top 85%",
        onEnter: () => playOpen(),
      });
      gsapInstances.push(stWaveOpen);
    }

    const closeTarget = container.querySelector<HTMLElement>("#blok-4-5-voidSectionWrapper");
    if (closeTarget) {
      const stWaveClose = ScrollTrigger.create({
        trigger: closeTarget,
        start: "bottom bottom",
        onLeaveBack: () => playClose(),
      });
      gsapInstances.push(stWaveClose);
    }

    cleanups.push(() => {
      stopTicker();
      isOpened = false;
      currentTime = 0;
      render(0);
      gsap.set(waveWrap, { autoAlpha: 0 });
    });
  }

  const initUnderlineSVG = () => {
    const ellipseBox = container.querySelector<HTMLElement>("#blok-4-5-ellipseBox");
    const zmienicText = container.querySelector<HTMLElement>("#blok-4-5-zmienicText");
    if (!ellipseBox) return;
    ellipseBox.querySelectorAll<SVGPathElement>("path").forEach((path) => {
      if (!path.getTotalLength) return;
      const length = path.getTotalLength();
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
    });
    ellipseBox.classList.add("active");
    if (zmienicText) zmienicText.classList.add("active");
  };

  const stUnderline = ScrollTrigger.create({
    trigger: container.querySelector("#blok-4-5-mozemy-to-zmienic"),
    start: "top 35%",
    once: true,
    onEnter: () => {
      const id = setTimeout(initUnderlineSVG, 100);
      cleanups.push(() => clearTimeout(id));
    },
  });
  gsapInstances.push(stUnderline);

  // =========================================================
  // GLOW + BUTTON ANIMATION (1:1 z HTML)
  // =========================================================
  const glowEl = container.querySelector<HTMLElement>("#blok-4-5-glow");
  const btnWrap = container.querySelector<HTMLElement>("#blok-4-5-btnWrap");
  const btn = container.querySelector<HTMLButtonElement>("#blok-4-5-btn");
  const kw = container.querySelector<HTMLElement>(".konwersja-wrap");

  if (glowEl && btnWrap && btn && kw) {
    const easeOutPower4 = (t: number) => {
      const u = 1 - t;
      const u2 = u * u;
      return 1 - u2 * u2;
    };
    const easeInPower4 = (t: number) => {
      const t2 = t * t;
      return t2 * t2;
    };

    let mouseOver = false;
    const GLOW_RISE_DUR = 2000;
    const GLOW_FALL_DUR = 1500;
    let glowValue = 0;
    let glowTarget = 0;
    let glowFrom = 0;
    let glowStartTime = 0;
    let glowSettled = true;
    let glowWillChangeActive = false;

    const setGlowTarget = (newTarget: number, now: number) => {
      if (newTarget === glowTarget) return;
      glowFrom = glowValue;
      glowStartTime = now;
      glowTarget = newTarget;
      glowSettled = false;
      if (!glowWillChangeActive) {
        glowEl.style.willChange = "transform, opacity";
        glowWillChangeActive = true;
      }
    };

    const updateGlow = (now: number) => {
      if (glowSettled) return;
      const elapsed = now - glowStartTime;
      const dur = glowTarget === 1 ? GLOW_RISE_DUR : GLOW_FALL_DUR;
      const t = Math.min(elapsed / dur, 1);
      if (glowTarget === 1) {
        glowValue = glowFrom + (1 - glowFrom) * easeOutPower4(t);
      } else {
        glowValue = glowFrom * (1 - easeInPower4(t));
      }
      let opacity = 0;
      if (glowValue >= 0.2) opacity = 1;
      else if (glowTarget === 1) opacity = glowValue / 0.2;
      else {
        const t2 = glowValue / 0.2;
        opacity = t2 * t2 * t2;
      }
      if (t >= 1) {
        glowValue = glowTarget;
        opacity = glowTarget === 1 ? 1 : 0;
        glowSettled = true;
        if (glowTarget === 0 && glowWillChangeActive) {
          glowEl.style.willChange = "auto";
          glowWillChangeActive = false;
        }
      }
      glowEl.style.transform = "translate(-50%, -50%) scale(" + glowValue + ")";
      glowEl.style.opacity = String(opacity);
    };

    const CYCLE = 7000;
    const AUTO_GLOW_ON_END = 2000;
    const AUTO_BTN_ON_END = 2600;
    const INITIAL_DELAY = 600;
    let cycleStart = 0;
    let lastMouseLeaveTime = 0;
    const MOUSE_COOLDOWN = 3000;
    let lastTouchTime = 0;
    let prevBtnEffective = false;
    let hoverClassApplied = false;
    let tickIOVisible = false;
    let autoWakeTimer = 0;
    let glowTicking = false;

    starsBridge.btnElement = btn;

    const needsTickFrames = (now: number) => {
      const inCooldown = now - lastMouseLeaveTime < MOUSE_COOLDOWN && lastMouseLeaveTime > 0;
      const e = (now - (cycleStart || 0)) % CYCLE;
      const autoActive = !inCooldown && e < AUTO_BTN_ON_END;
      return mouseOver || !glowSettled || autoActive;
    };

    const stopGlowTick = () => {
      if (!glowTicking) return;
      gsap.ticker.remove(glowTickFn);
      glowTicking = false;
    };
    const startGlowTick = () => {
      if (!tickIOVisible || document.hidden || glowTicking) return;
      gsap.ticker.add(glowTickFn);
      glowTicking = true;
    };

    const scheduleAutoWake = () => {
      if (autoWakeTimer) clearTimeout(autoWakeTimer);
      const now = performance.now();
      const inCooldown = now - lastMouseLeaveTime < MOUSE_COOLDOWN && lastMouseLeaveTime > 0;
      let delay = 0;
      if (inCooldown) {
        delay = MOUSE_COOLDOWN - (now - lastMouseLeaveTime) + 50;
      } else {
        const e = (now - (cycleStart || 0)) % CYCLE;
        delay = CYCLE - e + 10;
      }
      autoWakeTimer = window.setTimeout(startGlowTick, delay);
    };

    const glowTickFn = () => {
      const now = performance.now();
      if (!tickIOVisible || document.hidden) {
        stopGlowTick();
        scheduleAutoWake();
        return;
      }
      if (!cycleStart) cycleStart = now - (CYCLE - INITIAL_DELAY);
      const inCooldown = now - lastMouseLeaveTime < MOUSE_COOLDOWN && lastMouseLeaveTime > 0;
      const e = (now - cycleStart) % CYCLE;
      const autoGlowWants = !inCooldown && e < AUTO_GLOW_ON_END;
      const autoBtnWants = !inCooldown && e < AUTO_BTN_ON_END;
      const btnEffective = autoBtnWants || mouseOver;
      const glowEffective = autoGlowWants || mouseOver;

      if (btnEffective && !prevBtnEffective) {
        if (mouseOver) starsBridge.triggerManual += 1;
        else starsBridge.triggerAuto += 1;
        starsBridge.wake?.();
      }
      prevBtnEffective = btnEffective;

      if (btnEffective && !hoverClassApplied) {
        btnWrap.classList.add("anim-hover");
        hoverClassApplied = true;
      } else if (!btnEffective && hoverClassApplied) {
        btnWrap.classList.remove("anim-hover");
        hoverClassApplied = false;
      }

      const newGlowTarget = glowEffective ? 1 : 0;
      if (newGlowTarget !== glowTarget) setGlowTarget(newGlowTarget, now);
      updateGlow(now);
      if (!needsTickFrames(now)) {
        stopGlowTick();
        scheduleAutoWake();
      }
    };

    const onBtnTouchStart = () => {
      lastTouchTime = performance.now();
      mouseOver = true;
      startGlowTick();
    };
    const onBtnTouchEnd = () => {
      lastTouchTime = performance.now();
      mouseOver = false;
      lastMouseLeaveTime = performance.now();
      cycleStart = performance.now() + MOUSE_COOLDOWN - CYCLE;
    };
    const onBtnMouseEnter = () => {
      if (performance.now() - lastTouchTime < 1000) return;
      mouseOver = true;
      startGlowTick();
    };
    const onBtnMouseLeave = () => {
      mouseOver = false;
      lastMouseLeaveTime = performance.now();
      cycleStart = performance.now() + MOUSE_COOLDOWN - CYCLE;
    };
    const onBtnClick = () => {
      starsBridge.triggerManual += 1;
      starsBridge.wake?.();
    };
    const onBtnPointerDown = () => btnWrap.classList.add("is-active");
    const onBtnPointerUp = () => btnWrap.classList.remove("is-active");

    btn.addEventListener("touchstart", onBtnTouchStart, { passive: true });
    btn.addEventListener("touchend", onBtnTouchEnd, { passive: true });
    btn.addEventListener("touchcancel", onBtnTouchEnd, { passive: true });
    btn.addEventListener("mouseenter", onBtnMouseEnter);
    btn.addEventListener("mouseleave", onBtnMouseLeave);
    btn.addEventListener("click", onBtnClick);
    btn.addEventListener("pointerdown", onBtnPointerDown);
    btn.addEventListener("pointerup", onBtnPointerUp);
    btn.addEventListener("pointercancel", onBtnPointerUp);

    const glowIO = new IntersectionObserver(
      (entries) => {
        tickIOVisible = entries[0]?.isIntersecting ?? false;
        if (tickIOVisible && !document.hidden) startGlowTick();
        else {
          stopGlowTick();
          scheduleAutoWake();
        }
      },
      { threshold: 0.1 }
    );
    glowIO.observe(kw);

    const onVisChange = () => {
      if (document.hidden) stopGlowTick();
      else if (tickIOVisible) startGlowTick();
    };
    document.addEventListener("visibilitychange", onVisChange);

    cleanups.push(() => {
      stopGlowTick();
      if (autoWakeTimer) clearTimeout(autoWakeTimer);
      btn.removeEventListener("touchstart", onBtnTouchStart);
      btn.removeEventListener("touchend", onBtnTouchEnd);
      btn.removeEventListener("touchcancel", onBtnTouchEnd);
      btn.removeEventListener("mouseenter", onBtnMouseEnter);
      btn.removeEventListener("mouseleave", onBtnMouseLeave);
      btn.removeEventListener("click", onBtnClick);
      btn.removeEventListener("pointerdown", onBtnPointerDown);
      btn.removeEventListener("pointerup", onBtnPointerUp);
      btn.removeEventListener("pointercancel", onBtnPointerUp);
      btnWrap.classList.remove("anim-hover", "is-active");
      document.removeEventListener("visibilitychange", onVisChange);
      glowIO.disconnect();
    });

    pauseHooks.push(() => stopGlowTick());
    resumeHooks.push(() => {
      if (tickIOVisible) startGlowTick();
    });
  }

  const closePopup = () => {
    const overlay = container.querySelector<HTMLElement>("#blok-4-5-popupOverlay");
    if (!overlay) return;
    overlay.classList.remove("visible", "content-reveal");
    const popupWrapper = container.querySelector<HTMLElement>(".popup-wrapper");
    if (popupWrapper) popupWrapper.style.cssText = "";
    const onTransitionEnd = () => {
      if (!overlay.classList.contains("visible")) overlay.style.display = "none";
      overlay.removeEventListener("transitionend", onTransitionEnd);
    };
    overlay.addEventListener("transitionend", onTransitionEnd);
  };

  const showPopup = () => {
    const overlay = container.querySelector<HTMLElement>("#blok-4-5-popupOverlay");
    const popup = container.querySelector<HTMLElement>("#blok-4-5-popup");
    const popupWrapper = container.querySelector<HTMLElement>(".popup-wrapper");
    if (!overlay || !popup || !popupWrapper) return;

    overlay.style.display = "grid";
    requestAnimationFrame(() => overlay.classList.add("visible"));
    popupWrapper.style.transform = "scale(0.3)";
    popupWrapper.style.opacity = "0";
    popupWrapper.style.transition = "all 450ms cubic-bezier(0.22, 1, 0.36, 1)";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        popupWrapper.style.transform = "scale(1)";
        popupWrapper.style.opacity = "1";
      });
    });
    popup.classList.add("popup--animated");
    const id = setTimeout(() => overlay.classList.add("content-reveal"), 400);
    cleanups.push(() => clearTimeout(id));
  };

  const initPopup = () => {
    const btns = Array.from(container.querySelectorAll<HTMLButtonElement>("[data-reveal]"));
    const tileWraps = Array.from(container.querySelectorAll<HTMLElement>(".tile-wrap"));

    btns.forEach((btn) => {
      const onClick = () => {
        const id = btn.dataset.reveal;
        if (!id) return;
        const chosen = container.querySelector<HTMLElement>('.tile-wrap[data-tile="' + id + '"]');
        if (!chosen) return;
        chosen.classList.add("chosen");
        tileWraps.forEach((tw) => {
          if (tw.dataset.tile !== id) tw.classList.add("dimmed");
        });
        btns.forEach((other) => {
          if (other === btn) return;
          other.disabled = true;
          other.textContent = "Niedostępne";
        });
        showPopup();
      };
      btn.addEventListener("click", onClick);
      cleanups.push(() => btn.removeEventListener("click", onClick));
    });

    const topClose = container.querySelector<HTMLElement>("#blok-4-5-popupClose");
    const bottomClose = container.querySelector<HTMLElement>("#blok-4-5-popupBottomClose");
    if (topClose) {
      topClose.addEventListener("click", closePopup);
      cleanups.push(() => topClose.removeEventListener("click", closePopup));
    }
    if (bottomClose) {
      bottomClose.addEventListener("click", closePopup);
      cleanups.push(() => bottomClose.removeEventListener("click", closePopup));
    }
  };
  initPopup();

  // =========================
  // Walking + mana core runtime
  // =========================
  const DRAG_MULT = [2.8, 2.1, 1.7, 1.3, 1.1, 0.8, 0.8, 0.8, 0.8, 0.8];
  const MASS_TABLE = [1.2, 1.0, 0.7, 0.7, 0.7, 0.4, 0.4, 0.4, 0.4, 0.4];
  const EMIT_CHANCE = [0.9, 0.9, 0.9, 0.5, 0.5, 0.2, 0.2, 0.05, 0.05];
  const WORD_POOL = [
    "Spieszę się.",
    "Później wrócę.",
    "Szkoda czasu.",
    "Muszę lecieć.",
    "Innym razem.",
    "Tylko oglądam.",
    "Może kiedyś.",
    "Nie rozumiem tego.",
    "Kto to jest?",
    "Jeszcze pomyślę.",
    "Może później.",
    "Hm?",
    "Ej!",
    "Serio?",
    "Daj spokój",
    "Osz!",
    "Niee!",
    "Aaaaa",
    "Pomocy!",
    "Weź...",
    "Znowu?",
    "Puszczaj!",
  ];
  const CONFIG = { text: "wychodzą.", walkStride: 20, walkLift: 6, walkSpeed: 0.05 };
  const MANA_MAX = 375;

  type FxParticle = {
    type: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    decay: number;
    size: number;
    growRate: number;
    rotation: number;
    rSpeed: number;
    gravity: number;
    drag: number;
    hue: number;
    alpha: number;
    lineWidth: number;
    charIndex: number;
    offsetX: number;
    localBaseY: number;
    maxRise: number;
    anchorX: number;
    anchorY: number;
    localX: number;
    localY: number;
    colorA: string;
    colorB: string;
    debrisColor: string;
  };

  const chars: HTMLElement[] = [];
  const charStates: Array<{
    pullRot: number;
    pullSkew: number;
    pullRotY: number;
    pullSqueeze: number;
    pullX: number;
    elasticY: number;
    mass: number;
    finalX: number;
    finalY: number;
    baseOffsetLeft: number;
  }> = [];

  let walkTime = 0;
  let wordOffsetX = 0;
  let anchorScrollY = window.scrollY;
  let anchorOffsetX = 0;
  let lastScrollY = window.scrollY;
  let scrollUpVelocity = 0;
  let pullStrength = 0;
  let isScrollingDown = false;
  let currentMode: "escape" | "pull" = "escape";
  let visualBlend = 0;
  let hasStarted = false;
  let isDead = false;
  let isReturning = false;
  let elasticTime = 0;
  let elasticActive = false;

  let mana = 0;
  let manaActivated = false;
  let manaComplete = false;
  let bubbleFirstPullDone = false;
  let lastTriggerTime = 0;
  let manaContainer = container.querySelector<HTMLElement>("#blok-4-5-manaContainer");
  let manaBar = container.querySelector<HTMLElement>("#blok-4-5-manaBar");
  let burstCanvas = container.querySelector<HTMLCanvasElement>("#blok-4-5-burstCanvas");
  let burstCtx = burstCanvas?.getContext("2d") ?? null;
  let morphGhost = container.querySelector<HTMLElement>("#blok-4-5-morphGhost");
  const sparksCanvas = container.querySelector<HTMLCanvasElement>("#blok-4-5-sparksCanvas");
  const sparksCtx = sparksCanvas?.getContext("2d") ?? null;

  const bubbles = {
    b1: null as HTMLDivElement | null,
    b2: null as HTMLDivElement | null,
    b3: null as HTMLDivElement | null,
  };
  const bubbleTypes: Record<"b1" | "b2" | "b3", "speech" | "thought"> = { b1: "speech", b2: "thought", b3: "speech" };
  const activeTargets: Record<"b1" | "b2" | "b3", number | null> = { b1: null, b2: null, b3: null };
  let activeBubbleCount = 0;
  let lastUsedWords: string[] = [];
  let smokeCanvas: HTMLCanvasElement | null = null;
  let smokeCtx: CanvasRenderingContext2D | null = null;
  let iStarCanvas = container.querySelector<HTMLCanvasElement>("#blok-4-5-iHeatCanvas");
  let iStarCtx = iStarCanvas?.getContext("2d") ?? null;
  let iStarWrapper = container.querySelector<HTMLElement>("#blok-4-5-iHeatWrapper");
  const STAR_CANVAS_SIZE = 800;
  let starsAnimating = false;

  const SPRITES = {
    smoke: null as HTMLCanvasElement | null,
    star: null as HTMLCanvasElement | null,
    fire: null as HTMLCanvasElement | null,
  };
  const POOL_SIZE = 400;
  const POOL: FxParticle[] = [];
  let poolActive = 0;
  const fireQueue: FxParticle[] = new Array(64);
  let fireCount = 0;
  const canvasOffsetX = 100;
  const canvasOffsetY = 50;

  const initSpritesAndPool = () => {
    const sm = document.createElement("canvas");
    sm.width = 64;
    sm.height = 64;
    const sCtx = sm.getContext("2d");
    if (sCtx) {
      const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "hsla(40, 15%, 55%, 0.5)");
      grad.addColorStop(0.5, "hsla(40, 10%, 65%, 0.25)");
      grad.addColorStop(1, "transparent");
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 64, 64);
    }
    SPRITES.smoke = sm;

    const st = document.createElement("canvas");
    st.width = 32;
    st.height = 32;
    const stCtx = st.getContext("2d");
    if (stCtx) {
      stCtx.fillStyle = "#fec708";
      stCtx.shadowColor = "#fec708";
      stCtx.shadowBlur = 8;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / 5;
      stCtx.beginPath();
      stCtx.moveTo(16, 2);
      for (let i = 0; i < 5; i++) {
        stCtx.lineTo(16 + Math.cos(rot) * 14, 16 + Math.sin(rot) * 14);
        rot += step;
        stCtx.lineTo(16 + Math.cos(rot) * 5.6, 16 + Math.sin(rot) * 5.6);
        rot += step;
      }
      stCtx.closePath();
      stCtx.fill();
    }
    SPRITES.star = st;

    const fi = document.createElement("canvas");
    fi.width = 64;
    fi.height = 64;
    const fCtx = fi.getContext("2d");
    if (fCtx) {
      const fGrad = fCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      fGrad.addColorStop(0, "#fff");
      fGrad.addColorStop(0.3, "#ffaa44");
      fGrad.addColorStop(1, "rgba(224, 88, 27, 0)");
      fCtx.fillStyle = fGrad;
      fCtx.fillRect(0, 0, 64, 64);
    }
    SPRITES.fire = fi;

    for (let i = 0; i < POOL_SIZE; i++) {
      POOL[i] = {
        type: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, decay: 0, size: 0, growRate: 0, rotation: 0, rSpeed: 0, gravity: 0, drag: 1,
        hue: 0, alpha: 0, lineWidth: 0, charIndex: -1, offsetX: 0, localBaseY: 0, maxRise: 0, anchorX: 0, anchorY: 0, localX: 0, localY: 0,
        colorA: "", colorB: "", debrisColor: "",
      };
    }
  };

  const spawnParticle = (type: number, x: number, y: number, opts: { idx?: number; by?: number; offsetX?: number }) => {
    if (poolActive >= POOL_SIZE) return null;
    const p = POOL[poolActive++];
    if (!p) return null;
    const fontScale = chars[0] ? parseFloat(getComputedStyle(chars[0]).fontSize) / 40 : 1;
    p.type = type;
    p.x = x;
    p.y = y;
    p.life = 1.0;
    p.vx = 0;
    p.vy = 0;
    p.gravity = 0;
    p.drag = 1;
    p.rotation = 0;
    p.rSpeed = 0;
    p.size = 0;
    p.growRate = 0;
    p.charIndex = -1;
    p.offsetX = 0;
    p.localBaseY = 0;
    p.maxRise = 0;
    p.anchorX = 0;
    p.anchorY = 0;
    p.localX = 0;
    p.localY = 0;

    if (type === 0) {
      p.charIndex = opts.idx ?? -1;
      p.localBaseY = opts.by ?? 0;
      p.maxRise = 15 + Math.random() * 5;
      p.offsetX = (Math.random() - 0.5) * 15 * fontScale;
      p.vy = -0.2 - Math.random() * 0.3;
      p.drag = 0.96;
      p.decay = 0.0077 + Math.random() * 0.004;
      p.size = (5 + Math.random() * 4) * fontScale;
      p.growRate = 0.2 * fontScale;
      p.rotation = Math.random() * Math.PI * 2;
      p.rSpeed = (Math.random() - 0.5) * 0.01;
      p.alpha = 0.4;
    } else if (type === 4) {
      p.vx = (Math.random() - 0.5) * 12;
      p.vy = (Math.random() - 0.5) * 12;
      p.gravity = 0.15;
      p.decay = Math.random() * 0.012 + 0.008;
      p.size = Math.random() * 8 + 5;
      p.rotation = Math.random() * Math.PI * 2;
      p.rSpeed = (Math.random() - 0.5) * 0.2;
    } else if (type === 5) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 1;
      p.gravity = 0.15;
      p.drag = 0.95;
      p.decay = 0.02 + Math.random() * 0.02;
      p.size = (2 + Math.random() * 4) * fontScale;
      p.charIndex = 0;
      p.anchorX = opts.offsetX ?? 0;
    } else {
      const angle = ((15 + Math.random() * 20) * Math.PI) / 180;
      const speed = (type === 1 ? 4 + Math.random() * 5 : 6 + Math.random() * 7.5) * fontScale;
      p.vx = -Math.cos(angle) * speed;
      p.vy = -Math.sin(angle) * speed * 0.8;
      p.gravity = (type === 1 ? 0.15 : 0.2) * fontScale;
      p.decay = type === 1 ? 0.02 + Math.random() * 0.02 : 0.015 + Math.random() * 0.02;
      p.size = (type === 1 ? 1 + Math.random() * 1.5 : (2 + Math.random() * 2) * 1.3) * fontScale;
      p.hue = type === 1 ? 30 + Math.random() * 30 : 60 + Math.random() * 60;
      p.lineWidth = (1 + Math.random() * 1.5) * fontScale;
      p.rSpeed = type === 2 ? (Math.random() - 0.5) * 0.25 : 0;
      p.rotation = type === 2 ? Math.random() * Math.PI * 2 : 0;
      if (type === 1) {
        p.colorA = "hsla(" + p.hue + ", 100%, 60%, 1)";
        p.colorB = "hsla(" + p.hue + ", 100%, 50%, 0)";
      } else {
        p.debrisColor = "rgb(" + p.hue + "," + p.hue + "," + p.hue + ")";
      }
    }
    return p;
  };

  const walkContainer = container.querySelector<HTMLElement>("#blok-4-5-walkingContainer");
  if (walkContainer) {
    walkContainer.innerHTML = "";
    CONFIG.text.split("").forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "walking-char";
      span.textContent = ch;
      span.style.transformOrigin = i >= 5 ? "50% 100%" : "0% 100%";
      walkContainer.appendChild(span);
      chars.push(span);
      charStates.push({
        pullRot: 0,
        pullSkew: 0,
        pullRotY: 0,
        pullSqueeze: 0,
        pullX: 0,
        elasticY: 0,
        mass: MASS_TABLE[i] + (i >= 2 && i < 5 ? Math.random() * 0.3 : 0),
        finalX: 0,
        finalY: 0,
        baseOffsetLeft: 0,
      });
    });
    requestAnimationFrame(() => {
      chars.forEach((c, i) => {
        if (charStates[i]) charStates[i].baseOffsetLeft = c.offsetLeft;
      });
      cacheBaseMetrics();
    });
  }

  const frameCache = {
    containerPageLeft: 0,
    containerPageTop: 0,
    anchorPageBottom: 0,
    charOffsetTop: 0,
    charOffsetHeight: 0,
    charOffsetWidths: [] as number[],
    containerLeft: 0,
    containerTop: 0,
    containerTransformX: 0,
    anchorBottom: 0,
    firstLeft: 0,
    firstBottom: 0,
    firstRight: 0,
    cachedFloorOffset: -16,
    valid: false,
  };

  const cacheBaseMetrics = () => {
    if (!walkContainer) return;
    const cr = walkContainer.getBoundingClientRect();
    frameCache.containerPageLeft = cr.left + window.scrollX;
    frameCache.containerPageTop = cr.top + window.scrollY;
    const anchor = container.querySelector<HTMLElement>("#blok-4-5-anchorChar");
    if (anchor) {
      const ar = anchor.getBoundingClientRect();
      frameCache.anchorPageBottom = ar.bottom + window.scrollY;
    }
    if (chars[0]) {
      frameCache.charOffsetTop = chars[0].offsetTop;
      frameCache.charOffsetHeight = chars[0].offsetHeight;
      const fs = parseFloat(getComputedStyle(chars[0]).fontSize);
      frameCache.cachedFloorOffset = -0.4 * fs;
    }
    frameCache.charOffsetWidths = chars.map((c) => c.offsetWidth);
  };

  const updateFrameCache = () => {
    if (!walkContainer) {
      frameCache.valid = false;
      return;
    }
    const sy = window.scrollY;
    frameCache.containerTransformX = wordOffsetX * visualBlend;
    frameCache.containerLeft = frameCache.containerPageLeft - window.scrollX;
    frameCache.containerTop = frameCache.containerPageTop - sy;
    frameCache.anchorBottom = frameCache.anchorPageBottom - sy;
    if (chars[0] && charStates[0]) {
      const fLeft = frameCache.containerLeft + frameCache.containerTransformX + charStates[0].baseOffsetLeft + charStates[0].finalX;
      const fTop = frameCache.containerTop + frameCache.charOffsetTop + charStates[0].finalY;
      frameCache.firstLeft = fLeft;
      frameCache.firstBottom = fTop + frameCache.charOffsetHeight;
      frameCache.firstRight = fLeft + (frameCache.charOffsetWidths[0] || chars[0].offsetWidth);
    }
    frameCache.valid = true;
  };

  const initBubbles = () => {
    const layer = container.querySelector<HTMLElement>("#blok-4-5-bubble-layer");
    if (!layer) return;
    layer.innerHTML = "";
    (["b1", "b2", "b3"] as const).forEach((k) => {
      const b = document.createElement("div");
      b.className = bubbleTypes[k] === "thought" ? "thought-bubble" : "speech-bubble";
      layer.appendChild(b);
      bubbles[k] = b;
    });
  };

  const getUniqueWord = () => {
    let available = WORD_POOL.filter((w) => !lastUsedWords.includes(w));
    if (!available.length) {
      lastUsedWords = [];
      available = [...WORD_POOL];
    }
    const word = available[Math.floor(Math.random() * available.length)] ?? WORD_POOL[0];
    lastUsedWords.push(word);
    if (lastUsedWords.length > 10) lastUsedWords.shift();
    return word;
  };

  const triggerSpeechSequence = () => {
    const freeSlots = (["b1", "b2", "b3"] as const).filter((k) => activeTargets[k] === null);
    if (!freeSlots.length) return;
    const rand = Math.random();
    const wantedCount = rand < 0.5 ? 2 : 3;
    const count = Math.min(wantedCount, freeSlots.length);
    if (!count) return;
    const patterns3 = [
      [0, 3, 6],
      [1, 4, 7],
      [0, 4, 8],
      [2, 5, 8],
    ];
    const allIndices =
      count === 3
        ? patterns3[Math.floor(Math.random() * 4)]!
        : count === 2
        ? [0, 4].sort(() => Math.random() - 0.5)
        : [Math.floor(Math.random() * 6)];
    const indices = allIndices.slice(0, count);
    const scales = [0.85, 1.0, 1.15].sort(() => Math.random() - 0.5);
    indices.forEach((charIndex, i) => {
      const key = freeSlots[i];
      if (!key) return;
      const bubble = bubbles[key];
      if (!bubble) return;
      activeTargets[key] = charIndex;
      const word = getUniqueWord();
      const startDelay = i === 0 ? 0 : Math.random() * 300;
      const tid1 = window.setTimeout(() => {
        bubble.textContent = word;
        bubble.style.fontSize = (scales[i] || 1) + "em";
        bubble.classList.add("visible");
        activeBubbleCount++;
      }, startDelay);
      cleanups.push(() => clearTimeout(tid1));
      const lifeTime = 1500 + Math.random() * 500;
      const tid2 = window.setTimeout(() => {
        bubble.classList.remove("visible");
        activeTargets[key] = null;
        activeBubbleCount = Math.max(0, activeBubbleCount - 1);
      }, startDelay + lifeTime);
      cleanups.push(() => clearTimeout(tid2));
    });
  };

  const updateBubblesPosition = () => {
    if (activeBubbleCount === 0 || !frameCache.valid) return;
    (["b1", "b2", "b3"] as const).forEach((key) => {
      const idx = activeTargets[key];
      const bubble = bubbles[key];
      if (idx === null || !bubble || !chars[idx] || !charStates[idx]) return;
      const s = charStates[idx];
      const x =
        frameCache.containerLeft +
        frameCache.containerTransformX +
        s.baseOffsetLeft +
        s.finalX +
        (frameCache.charOffsetWidths[idx] || chars[idx].offsetWidth) / 2;
      const yOff = bubbleTypes[key] === "thought" ? -55 : -25;
      const y = frameCache.containerTop + frameCache.charOffsetTop + s.finalY + yOff;
      const visScale = bubble.classList.contains("visible") ? "scale(1) translateY(0)" : "scale(0.8) translateY(5px)";
      bubble.style.transform = "translate3d(" + x + "px, " + y + "px, 0) translateX(-50%) " + visScale;
    });
  };

  const initCanvases = () => {
    if (!walkContainer) return;
    smokeCanvas = document.createElement("canvas");
    smokeCanvas.id = "blok-4-5-particleCanvas";
    walkContainer.insertBefore(smokeCanvas, walkContainer.firstChild);
    smokeCtx = smokeCanvas.getContext("2d");
    const resizeCanvases = () => {
      if (smokeCanvas) {
        smokeCanvas.width = window.innerWidth + 200;
        smokeCanvas.height = 150;
      }
      if (sparksCanvas) {
        sparksCanvas.width = window.innerWidth;
        sparksCanvas.height = window.innerHeight;
      }
      cacheBaseMetrics();
      Object.values(bubbles).forEach((b) => b?.classList.remove("visible"));
      (["b1", "b2", "b3"] as const).forEach((k) => (activeTargets[k] = null));
      activeBubbleCount = 0;
    };
    resizeCanvases();
    window.addEventListener("resize", resizeCanvases);
    cleanups.push(() => window.removeEventListener("resize", resizeCanvases));
    cleanups.push(() => {
      if (smokeCanvas?.parentElement) smokeCanvas.parentElement.removeChild(smokeCanvas);
    });
  };

  const updateStarCanvasPosition = () => {
    const anchor = container.querySelector<HTMLElement>("#blok-4-5-anchorChar");
    if (!anchor || !iStarWrapper || !iStarCanvas) return;
    const rect = anchor.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.25;
    iStarWrapper.style.width = STAR_CANVAS_SIZE + "px";
    iStarWrapper.style.height = STAR_CANVAS_SIZE + "px";
    iStarWrapper.style.left = cx - STAR_CANVAS_SIZE / 2 + "px";
    iStarWrapper.style.top = cy - STAR_CANVAS_SIZE / 2 + "px";
    iStarCanvas.width = STAR_CANVAS_SIZE;
    iStarCanvas.height = STAR_CANVAS_SIZE;
  };

  const animateStars = () => {
    if (!iStarCtx) {
      starsAnimating = false;
      return;
    }
    let hasStars = false;
    iStarCtx.clearRect(0, 0, STAR_CANVAS_SIZE, STAR_CANVAS_SIZE);
    const starNow = Date.now();
    for (let i = poolActive - 1; i >= 0; i--) {
      const p = POOL[i];
      if (!p || p.type !== 4) continue;
      hasStars = true;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rSpeed;
      p.life -= p.decay;
      if (p.life <= 0) {
        poolActive--;
        const tmp = POOL[i];
        POOL[i] = POOL[poolActive]!;
        POOL[poolActive] = tmp!;
        continue;
      }
      const twinkle = 0.8 + Math.sin(starNow * 0.02 + p.rotation) * 0.2;
      iStarCtx.save();
      iStarCtx.translate(p.x, p.y);
      iStarCtx.rotate(p.rotation);
      iStarCtx.globalAlpha = p.life * twinkle;
      const scale = p.size / 16;
      iStarCtx.scale(scale, scale);
      if (SPRITES.star) iStarCtx.drawImage(SPRITES.star, -16, -16);
      iStarCtx.restore();
    }
    if (hasStars) requestAnimationFrame(animateStars);
    else starsAnimating = false;
  };

  const spawnStars = () => {
    updateStarCanvasPosition();
    const cx = STAR_CANVAS_SIZE / 2;
    const burst = (n: number) => {
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 15;
        spawnParticle(4, cx + Math.cos(angle) * r, cx + Math.sin(angle) * r, {});
      }
      if (!starsAnimating) {
        starsAnimating = true;
        requestAnimationFrame(animateStars);
      }
    };
    const tid1 = window.setTimeout(() => burst(25), 150);
    const tid2 = window.setTimeout(() => burst(8), 350);
    cleanups.push(() => clearTimeout(tid1));
    cleanups.push(() => clearTimeout(tid2));
  };

  const processParticles = () => {
    if (!frameCache.valid) return;
    const isActiveScrollUp = scrollUpVelocity < -2;
    if (isActiveScrollUp && hasStarted && !isDead && chars.length > 0) {
      const mass = charStates[0]?.mass || 1;
      if (Math.random() < pullStrength * 3.5 * mass * 1.15 && frameCache.valid) {
        const type = Math.random() < 0.15 ? 1 : 2;
        if (type === 1 || Math.random() < 0.575) {
          spawnParticle(type, frameCache.firstLeft, frameCache.anchorBottom + frameCache.cachedFloorOffset, {});
        }
      }
    }
    if (currentMode === "pull" && pullStrength > 0.15 && hasStarted && !isDead && chars.length > 0 && frameCache.valid) {
      const count = 2 + Math.floor(Math.random() * 3);
      const charWidth = frameCache.firstRight - frameCache.firstLeft;
      for (let i = 0; i < count; i++) {
        const offsetX = Math.random() * (charWidth / 3);
        spawnParticle(5, frameCache.firstLeft + offsetX, frameCache.firstBottom, { offsetX });
      }
    }
    if (currentMode === "pull" && pullStrength > 0.1 && hasStarted && !isDead && chars.length > 0) {
      const localFloorY = frameCache.charOffsetTop + frameCache.charOffsetHeight;
      for (let ci = 0; ci < chars.length; ci++) {
        if (Math.random() > EMIT_CHANCE[ci]!) continue;
        const s = charStates[ci] as typeof charStates[number] & { prevVaporX?: number };
        const lx = s.baseOffsetLeft + s.finalX + (frameCache.charOffsetWidths[ci] || 0) / 2;
        if (s.prevVaporX === undefined) s.prevVaporX = lx;
        const dx = lx - s.prevVaporX;
        if (Math.abs(dx) > 2) {
          const steps = Math.min(Math.ceil(Math.abs(dx) / 10), 20);
          for (let k = 0; k <= steps; k++) {
            spawnParticle(0, s.prevVaporX + dx * (k / steps) + canvasOffsetX, localFloorY + canvasOffsetY, { idx: ci, by: localFloorY });
          }
        }
        s.prevVaporX = lx;
      }
    }
    if (poolActive === 0) return;
    if (smokeCtx && smokeCanvas) smokeCtx.clearRect(0, 0, smokeCanvas.width, smokeCanvas.height);
    if (sparksCtx && sparksCanvas) {
      sparksCtx.clearRect(0, 0, sparksCanvas.width, sparksCanvas.height);
      sparksCtx.lineCap = "round";
    }
    fireCount = 0;
    for (let i = poolActive - 1; i >= 0; i--) {
      const p = POOL[i];
      if (!p || p.type === 4) continue;
      let dead = false;
      if (p.type === 0) {
        p.y += p.vy;
        p.vy *= p.drag;
        const minY = p.localBaseY + canvasOffsetY - p.maxRise;
        if (p.y < minY) {
          p.y = minY;
          p.vy = 0;
        }
        p.size = p.life > 0.5 ? p.size + p.growRate : p.size * 0.96;
        p.rotation += p.rSpeed;
        if (!smokeCanvas || p.life <= 0 || p.size < 1 || p.x < 0 || p.x > smokeCanvas.width) dead = true;
      } else if (p.type === 5) {
        p.localX += p.vx;
        p.localY += p.vy;
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.size *= 0.96;
        if (p.life <= 0 || p.size < 0.5) dead = true;
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.vy *= 0.99;
        if (p.type === 2) p.rotation += p.rSpeed;
        if (p.life <= 0 || p.y > window.innerHeight + 50 || p.x < -100) dead = true;
      }
      p.life -= p.decay;
      if (dead) {
        poolActive--;
        const tmp = POOL[i];
        POOL[i] = POOL[poolActive]!;
        POOL[poolActive] = tmp!;
        continue;
      }
      if (p.type === 0 && smokeCtx && SPRITES.smoke) {
        const scale = p.size / 32;
        const cos = Math.cos(p.rotation) * scale;
        const sin = Math.sin(p.rotation) * scale;
        smokeCtx.globalAlpha = p.life * p.alpha;
        smokeCtx.setTransform(cos, sin, -sin * 0.7, cos * 0.7, p.x, p.y);
        smokeCtx.drawImage(SPRITES.smoke, -32, -32);
      } else if (p.type === 1 && sparksCtx) {
        sparksCtx.globalAlpha = p.life;
        const grad = sparksCtx.createLinearGradient(p.x, p.y, p.x - p.vx * 2, p.y - p.vy * 2);
        grad.addColorStop(0, p.colorA);
        grad.addColorStop(1, p.colorB);
        sparksCtx.strokeStyle = grad;
        sparksCtx.lineWidth = p.lineWidth;
        sparksCtx.beginPath();
        sparksCtx.moveTo(p.x, p.y);
        sparksCtx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
        sparksCtx.stroke();
      } else if (p.type === 2 && sparksCtx) {
        sparksCtx.globalAlpha = p.life;
        const cos = Math.cos(p.rotation);
        const sin = Math.sin(p.rotation);
        sparksCtx.setTransform(cos, sin, -sin, cos, p.x, p.y);
        sparksCtx.fillStyle = p.debrisColor;
        sparksCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else if (p.type === 5) {
        fireQueue[fireCount++] = p;
      }
    }
    if (smokeCtx) smokeCtx.setTransform(1, 0, 0, 1, 0, 0);
    if (sparksCtx) sparksCtx.setTransform(1, 0, 0, 1, 0, 0);
    if (fireCount > 0 && frameCache.valid && sparksCtx && SPRITES.fire) {
      sparksCtx.globalCompositeOperation = "lighter";
      for (let fi = 0; fi < fireCount; fi++) {
        const p = fireQueue[fi];
        if (!p) continue;
        const screenX = frameCache.firstLeft + p.anchorX + p.localX;
        const screenY = frameCache.firstBottom + p.anchorY + p.localY;
        sparksCtx.globalAlpha = p.life;
        const scale = p.size / 32;
        sparksCtx.setTransform(scale, 0, 0, scale, screenX, screenY);
        sparksCtx.drawImage(SPRITES.fire, -32, -32);
      }
      sparksCtx.setTransform(1, 0, 0, 1, 0, 0);
      sparksCtx.globalCompositeOperation = "source-over";
    }
    if (smokeCtx) smokeCtx.globalAlpha = 1;
    if (sparksCtx) sparksCtx.globalAlpha = 1;
  };

  initSpritesAndPool();
  initBubbles();
  initCanvases();
  updateStarCanvasPosition();
  window.addEventListener("resize", updateStarCanvasPosition);
  cleanups.push(() => window.removeEventListener("resize", updateStarCanvasPosition));

  const textSection = container.querySelector<HTMLElement>("#blok-4-5-voidSectionWrapper");
  if (textSection && manaContainer) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isDead) manaContainer?.classList.add("in-viewport");
          else manaContainer?.classList.remove("in-viewport");
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(textSection);
    cleanups.push(() => observer.disconnect());
  }

  const killMana = () => {
    if (!manaContainer) return;
    manaContainer.classList.remove("visible", "in-viewport");
  };

  const onManaComplete = () => {
    manaComplete = true;
    if (manaContainer) manaContainer.style.width = manaContainer.offsetWidth + "px";
    manaBar?.classList.add("complete");
    Object.values(bubbles).forEach((b) => b?.classList.remove("visible"));
    activeBubbleCount = 0;
    const anchor = container.querySelector<HTMLElement>("#blok-4-5-anchorChar");
    anchor?.classList.add("mana-active");
    isReturning = true;
    currentMode = "escape";
    visualBlend = 0;
  };

  const updateMana = () => {
    if (manaComplete) return;
    if (currentMode === "pull" && scrollUpVelocity < -1) {
      if (!manaActivated) {
        manaActivated = true;
        manaContainer?.classList.add("visible");
      }
      const vel = Math.abs(scrollUpVelocity);
      const gain = 2.0 + Math.min(vel / 25, 1.0);
      mana = Math.min(MANA_MAX, mana + gain);
      if (manaBar) manaBar.style.width = (mana / MANA_MAX) * 100 + "%";
      if (mana >= MANA_MAX) onManaComplete();
    }
  };

  const showPopupWithBurst = () => {
    const overlay = container.querySelector<HTMLElement>("#blok-4-5-popupOverlay");
    const popup = container.querySelector<HTMLElement>("#blok-4-5-popup");
    const popupWrapper = container.querySelector<HTMLElement>(".popup-wrapper");
    if (!overlay || !popup || !popupWrapper || !manaContainer || !burstCanvas || !burstCtx || !morphGhost) return;

    const manaRect = manaContainer.getBoundingClientRect();
    const cx = manaRect.left + manaRect.width / 2;
    const cy = manaRect.top + manaRect.height / 2;
    burstCanvas.width = window.innerWidth;
    burstCanvas.height = window.innerHeight;
    burstCanvas.style.display = "block";

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      life: number;
      decay: number;
      gravity: number;
      drag: number;
    }> = [];
    const COLORS = ["#fec708", "#fc7900", "#fd9b00", "#fa4900", "#298f61", "#8cd3b3"];
    const COUNT = 80;
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 8;
      particles.push({
        x: cx + (Math.random() - 0.5) * manaRect.width,
        y: cy + (Math.random() - 0.5) * manaRect.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1,
        decay: 0.015 + Math.random() * 0.01,
        gravity: 0.08,
        drag: 0.97,
      });
    }

    manaContainer.style.opacity = "0";
    manaContainer.style.pointerEvents = "none";
    Object.assign(morphGhost.style, {
      left: manaRect.left + "px",
      top: manaRect.top + "px",
      width: manaRect.width + "px",
      height: manaRect.height + "px",
      borderRadius: "20px",
      opacity: "1",
      background: "white",
      boxShadow: "0 0 60px rgba(254,199,8,0.6), 0 0 120px rgba(254,199,8,0.3)",
      transition: "all 200ms ease-out",
      zIndex: "10000",
    });
    requestAnimationFrame(() => {
      morphGhost!.style.transform = "scale(1.15)";
      morphGhost!.style.opacity = "0";
    });

    let running = true;
    let frame = 0;
    const animateBurst = () => {
      if (!running || !burstCtx || !burstCanvas) return;
      burstCtx.clearRect(0, 0, burstCanvas.width, burstCanvas.height);
      let alive = 0;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.life -= p.decay;
        const radius = p.size * Math.max(0, p.life);
        if (radius <= 0) continue;
        burstCtx.globalAlpha = Math.max(0, p.life);
        burstCtx.fillStyle = p.color;
        burstCtx.beginPath();
        burstCtx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        burstCtx.fill();
      }
      burstCtx.globalAlpha = 1;
      frame++;
      if (alive > 0 && frame < 60) requestAnimationFrame(animateBurst);
      else {
        running = false;
        burstCtx.clearRect(0, 0, burstCanvas.width, burstCanvas.height);
        burstCanvas.width = burstCanvas.height = 1;
        burstCanvas.style.display = "none";
      }
    };
    requestAnimationFrame(animateBurst);

    const tid1 = setTimeout(() => {
      overlay.style.display = "grid";
      requestAnimationFrame(() => overlay.classList.add("visible"));
      popupWrapper.style.transform = "scale(0.3)";
      popupWrapper.style.opacity = "0";
      popupWrapper.style.transition = "all 450ms cubic-bezier(0.22, 1, 0.36, 1)";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          popupWrapper.style.transform = "scale(1)";
          popupWrapper.style.opacity = "1";
        });
      });
      popup.classList.add("popup--animated");
    }, 180);
    const tid2 = setTimeout(() => {
      overlay.classList.add("content-reveal");
    }, 400);
    cleanups.push(() => clearTimeout(tid1));
    cleanups.push(() => clearTimeout(tid2));
  };

  const transformToZostaja = () => {
    spawnStars();
    const newText = "zostają!";
    const targetChars = newText.split("");
    const wc = container.querySelector<HTMLElement>("#blok-4-5-walkingContainer");
    if (!wc) return;
    const containerRect = wc.getBoundingClientRect();

    const measure = document.createElement("span");
    measure.style.cssText =
      "position:absolute;visibility:hidden;white-space:pre;font-family:" +
      getComputedStyle(wc).fontFamily +
      ";font-size:" +
      getComputedStyle(wc).fontSize +
      ";font-weight:" +
      getComputedStyle(wc).fontWeight;
    const measureChars = targetChars.map((ch) => {
      const s = document.createElement("span");
      s.textContent = ch;
      s.style.display = "inline-block";
      measure.appendChild(s);
      return s;
    });
    document.body.appendChild(measure);
    const mRect = measure.getBoundingClientRect();
    const targetPos = measureChars.map((s) => ({ left: s.getBoundingClientRect().left - mRect.left }));
    document.body.removeChild(measure);
    const currentPos = chars.map((c) => ({ left: c.getBoundingClientRect().left - containerRect.left }));

    wc.style.position = "relative";
    wc.style.width = mRect.width + "px";
    wc.style.height = containerRect.height + "px";
    chars.forEach((c, i) => {
      c.style.position = "absolute";
      c.style.left = (currentPos[i]?.left ?? 0) + "px";
      c.style.top = "0";
    });

    const total = targetChars.length;
    chars.forEach((c, i) => {
      const delay = i * 0.06;
      if (i < total) {
        const mid = (total - 1) / 2;
        const norm = (i - mid) / mid;
        const arcY = Math.cos(norm * Math.PI * 0.5) * 5;
        const arcRot = norm * 2;
        const tl = gsap.timeline({ delay });
        gsapInstances.push(tl);
        tl.to(c, {
          y: -20,
          opacity: 0,
          duration: 0.15,
          ease: "power2.out",
          onComplete: () => {
            c.textContent = targetChars[i];
            c.style.left = (targetPos[i]?.left ?? 0) + "px";
          },
        });
        tl.to(c, { y: arcY, opacity: 1, rotation: arcRot, duration: 0.35, ease: "back.out(1.7)" });
      } else {
        const tw = gsap.to(c, {
          opacity: 0,
          duration: 0.2,
          delay,
          onComplete: () => {
            c.style.display = "none";
          },
        });
        gsapInstances.push(tw);
      }
    });

    const tid = setTimeout(() => {
      isDead = true;
      gsap.ticker.remove(mainLoop);
      mainLoopTicking = false;
      if (sparksCanvas) sparksCanvas.width = sparksCanvas.height = 1;
      if (smokeCanvas) smokeCanvas.width = smokeCanvas.height = 1;
      killMana();
      const tid2 = setTimeout(showPopupWithBurst, 200);
      cleanups.push(() => clearTimeout(tid2));
    }, (total - 1) * 60 + 800);
    cleanups.push(() => clearTimeout(tid));
  };

  const handleScroll = () => {
    const y = window.scrollY;
    const d = y - lastScrollY;
    if (d < 0) {
      scrollUpVelocity = d;
      isScrollingDown = false;
    } else if (d > 0) {
      scrollUpVelocity = 0;
      isScrollingDown = true;
    }
    lastScrollY = y;
  };

  const mainLoop = () => {
    if (!hasStarted) {
      scrollUpVelocity *= 0.9;
      return;
    }
    if (isDead) return;

    if (walkTime * CONFIG.walkStride > window.innerWidth + 200) {
      isDead = true;
      killMana();
      gsap.ticker.remove(mainLoop);
      mainLoopTicking = false;
      if (sparksCanvas) sparksCanvas.width = sparksCanvas.height = 1;
      if (smokeCanvas) smokeCanvas.width = smokeCanvas.height = 1;
      return;
    }

    updateFrameCache();

    if (isScrollingDown) {
      pullStrength *= 0.8;
      if (pullStrength < 0.01) {
        pullStrength = 0;
        isScrollingDown = false;
      }
    } else {
      if (scrollUpVelocity < 0) pullStrength += (Math.min(1.0, Math.abs(scrollUpVelocity) / 35) - pullStrength) * 0.3;
      else pullStrength *= 0.978;
    }
    if (pullStrength < 0.01) pullStrength = 0;
    scrollUpVelocity *= 0.9;

    const shouldPull = pullStrength > (currentMode === "escape" ? 0.08 : 0.02);
    if (!isReturning) {
      if (shouldPull && currentMode === "escape") {
        currentMode = "pull";
        anchorScrollY = lastScrollY;
        anchorOffsetX = walkTime * CONFIG.walkStride;
        wordOffsetX = anchorOffsetX;
        elasticActive = true;
        elasticTime = 0;
      } else if (!shouldPull && currentMode === "pull") {
        currentMode = "escape";
        walkTime = Math.max(0, wordOffsetX / CONFIG.walkStride);
        elasticActive = true;
        elasticTime = 0;
        if (!bubbleFirstPullDone) bubbleFirstPullDone = true;
      }
    }

    if (elasticActive) {
      elasticTime += 0.016;
      if (elasticTime > 0.5) elasticActive = false;
    }
    if (currentMode === "escape" && !isReturning) walkTime += CONFIG.walkSpeed;

    if (isReturning) {
      walkTime -= CONFIG.walkSpeed * 2;
      if (walkTime <= 0) {
        walkTime = 0;
        isReturning = false;
        gsap.ticker.remove(mainLoop);
        mainLoopTicking = false;
        poolActive = 0;
        if (smokeCtx && smokeCanvas) smokeCtx.clearRect(0, 0, smokeCanvas.width, smokeCanvas.height);
        if (sparksCtx && sparksCanvas) sparksCtx.clearRect(0, 0, sparksCanvas.width, sparksCanvas.height);
        chars.forEach((c) => {
          c.style.transform = "none";
        });
        if (walkContainer) walkContainer.style.transform = "none";
        transformToZostaja();
        return;
      }
    }

    if (currentMode === "pull") {
      const d = anchorScrollY - lastScrollY;
      wordOffsetX += (Math.max(0, anchorOffsetX - Math.max(0, d) * 0.8) - wordOffsetX) * 0.12;
    }
    const targetBlend = currentMode === "pull" ? 1 : 0;
    visualBlend += (targetBlend - visualBlend) * 0.15;
    const newTx = wordOffsetX * visualBlend;
    if (walkContainer) {
      walkContainer.style.transform = newTx > -0.1 && newTx < 0.1 ? "none" : "translateX(" + newTx + "px)";
    }

    const len = chars.length;
    for (let i = 0; i < len; i++) {
      const c = chars[i];
      const s = charStates[i];
      if (!c || !s) continue;
      const rev = len - 1 - i;
      const cycle = Math.max(0, walkTime - rev * 0.11);
      let ex = 0;
      let ey = 0;
      let er = 0;
      if (cycle > 0) {
        const phase = cycle % 1;
        const idx = Math.floor(cycle);
        if (phase < 0.55) {
          const p = phase / 0.55;
          const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          ex = (idx + ease) * CONFIG.walkStride;
          ey = -Math.sin(p * Math.PI) * CONFIG.walkLift * (1 + (i % 2) * 0.5);
          er = Math.sin(p * Math.PI) * 5;
        } else ex = (idx + 1) * CONFIG.walkStride;
      }
      let tr = 0;
      let tryY = 0;
      if (pullStrength > 0) {
        tr = pullStrength * 25 * DRAG_MULT[i];
        if (i >= 5) tryY = (54 + ((i - 5) / 3) * 48) * pullStrength;
      }
      const eff = Math.min(tr, 30);
      const spd = Math.max(0.15, 0.5 - i * 0.05);
      s.pullRot += Math.max(-spd, Math.min(spd, eff - s.pullRot));
      s.pullSkew = -s.pullRot * 1.5;
      s.pullX = pullStrength > 0 ? (i === 0 ? 3 : 1.5) * (Math.random() - 0.5) * pullStrength : s.pullX * 0.8;
      s.pullRotY += (tryY - s.pullRotY) * 0.08;
      s.pullSqueeze += (((i >= 5 ? -((i - 5) / 3) * 25 : 0) * pullStrength) - s.pullSqueeze) * 0.08;
      if (elasticActive) {
        const t = Math.max(0, elasticTime - i * 0.03);
        s.elasticY = Math.sin(t * 25) * Math.exp(-t * 8) * 4 * (1 - i / len);
      } else s.elasticY *= 0.9;
      const vb = visualBlend;
      s.finalX = ex * (1 - vb) + (s.pullX + s.pullSqueeze) * vb;
      s.finalY = ey * (1 - vb) + s.elasticY;
      const rz = er * (1 - vb) + s.pullRot * vb;
      const qx = (((s.finalX * 100) | 0) as number) / 100;
      const qy = (((s.finalY * 100) | 0) as number) / 100;
      const qry = ((((s.pullRotY * vb) * 100) | 0) as number) / 100;
      const qrz = (((rz * 100) | 0) as number) / 100;
      const qsk = ((((s.pullSkew * vb) * 100) | 0) as number) / 100;
      c.style.transform =
        "translate3d(" + qx + "px," + qy + "px,0) rotateY(" + qry + "deg) rotateZ(" + qrz + "deg) skewX(" + qsk + "deg)";
    }
    processParticles();
    updateMana();
    if (bubbleFirstPullDone && scrollUpVelocity < -1 && !manaComplete && activeBubbleCount === 0 && Date.now() - lastTriggerTime > 800) {
      triggerSpeechSequence();
      lastTriggerTime = Date.now();
    }
    updateBubblesPosition();
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  cleanups.push(() => window.removeEventListener("scroll", handleScroll));
  const onResizeMain = () => {
    cacheBaseMetrics();
    Object.values(bubbles).forEach((b) => b?.classList.remove("visible"));
    (["b1", "b2", "b3"] as const).forEach((k) => (activeTargets[k] = null));
    activeBubbleCount = 0;
  };
  window.addEventListener("resize", onResizeMain);
  cleanups.push(() => window.removeEventListener("resize", onResizeMain));

  const stWalking = ScrollTrigger.create({
    trigger: container.querySelector("#blok-4-5-voidSection"),
    start: "top 35%",
    once: true,
    onEnter: () => {
      hasStarted = true;
      anchorScrollY = lastScrollY;
    },
  });
  gsapInstances.push(stWalking);
  gsap.ticker.add(mainLoop);
  let mainLoopTicking = true;
  cleanups.push(() => {
    gsap.ticker.remove(mainLoop);
    mainLoopTicking = false;
  });

  const kill = () => {
    stars?.kill();
    starsBridge.btnElement = null;
    gsapInstances.forEach((instance) => instance.kill());
    cleanups.forEach((cleanup) => cleanup());
    gsap.set(waveWrap, { autoAlpha: 0 });
  };

  const pause = () => {
    stars?.pause();
    if (mainLoopTicking) {
      gsap.ticker.remove(mainLoop);
      mainLoopTicking = false;
    }
    pauseHooks.forEach((fn) => fn());
    gsapInstances.forEach((instance) => {
      if ("disable" in instance && typeof instance.disable === "function") {
        instance.disable(false, true);
      }
    });
  };

  const resume = () => {
    stars?.resume();
    if (!mainLoopTicking && !isDead) {
      gsap.ticker.add(mainLoop);
      mainLoopTicking = true;
    }
    resumeHooks.forEach((fn) => fn());
    gsapInstances.forEach((instance) => {
      if ("enable" in instance && typeof instance.enable === "function") {
        instance.enable(false, true);
      }
    });
  };

  return { kill, pause, resume };
}
