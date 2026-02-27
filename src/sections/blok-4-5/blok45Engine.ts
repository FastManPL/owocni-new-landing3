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
  const CONFIG = { text: "wychodzą.", walkStride: 20, walkLift: 6, walkSpeed: 0.05 };
  const MANA_MAX = 375;

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
  let manaContainer = container.querySelector<HTMLElement>("#blok-4-5-manaContainer");
  let manaBar = container.querySelector<HTMLElement>("#blok-4-5-manaBar");
  let burstCanvas = container.querySelector<HTMLCanvasElement>("#blok-4-5-burstCanvas");
  let burstCtx = burstCanvas?.getContext("2d") ?? null;
  let morphGhost = container.querySelector<HTMLElement>("#blok-4-5-morphGhost");

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
    });
  }

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
    manaBar?.classList.add("complete");
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
      return;
    }

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
    updateMana();
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  cleanups.push(() => window.removeEventListener("scroll", handleScroll));
  const onResizeMain = () => {
    // lightweight: width check only
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
