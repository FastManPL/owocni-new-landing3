/**
 * Silnik hero: karuzela logotypów (marquee) + trail (obrazki podążające za myszką).
 * Logika 1:1 z oryginalnego heroSectionInit — wywoływane z useGSAP, scope: container.
 */

import gsap from "gsap";
import { scrollRuntime } from "@/lib/scrollRuntime";

function runMarquee(container: HTMLElement): () => void {
  const $id = (id: string) => container.querySelector<HTMLElement>("#" + id);
  const getRawScroll = () => scrollRuntime.getRawScroll();

  const MARQUEE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 615 209.6"><g fill="#dcd3c7"><path d="M78.5 165C-70 150.3 20.4-56.6 131.4 32l-15 14.9c-32.5-33.1-95.3-7.7-93.6 40.9-2.9 63.3 99.1 78.3 106.1 14.1H77.8v-21h71.6c9 41.8-23.6 86.6-70.9 84.1M257.6 115.3c.1 65.2-100.1 65.2-99.9 0-.2-65.3 100.1-65.3 99.9 0m-21.8 0c.4-39.4-56.4-39.4-56 0 .2 39.5 55.9 39.5 56 0M366.4 115.3c.1 65.2-100.1 65.2-99.9 0-.2-65.3 100.1-65.3 99.9 0m-22 0c.4-39.4-56.4-39.4-56 0 .2 39.5 55.9 39.5 56 0M470.6 157.8c2.8 62.9-75.4 65.6-91.5 22.4l19-8c9.9 26.6 53.4 23.3 51.6-11.5v-7.1c-25.9 26.9-76.2 1.6-74.7-38.1-1.4-39.9 48.4-65.3 74.7-38.8v-8.1h20.8v89.2zm-19.2-42.3c.3-40.4-54.1-39.4-54.2 0 .1 38.8 54.5 39.7 54.2 0M507.4 16v145.9h-21.8V16zM591.8 131.7l16.9 11.4c-22.8 37.8-91.6 24.7-90.8-27.6 2.2-63.3 79.3-63.8 91.8-12.3l-66.6 27.4c8.8 20.5 38.4 18.8 48.7 1.1m-52.3-17.8L584 95.3c-10.8-20.2-45.6-9.8-44.5 18.6"/></g></svg>';

  const logosOnScreen = 10;
  const baseDiv = document.createElement("div");
  baseDiv.innerHTML = MARQUEE_SVG;

  let currentMarqueeInstance: TidalDriftMarquee | null = null;
  let brandsHasBuilt = false;

  class TidalDriftMarquee {
    track: HTMLElement;
    limit: number;
    cfg = {
      baseSpeed: 0.35,
      lerp: 0.07,
      friction: 0.95,
      scrollGain: 5.0,
      maxBoost: 12,
      velocityClamp: 40,
    };
    x = 0;
    targetX = 0;
    velocity = 0;
    rawDelta = 0;
    _wheelFiredThisFrame = false;
    isPaused = false;
    isActive = false;
    lastScrollY = getRawScroll();
    _setX!: (v: number) => void;
    _lastRender = 0;

    constructor(trackElement: HTMLElement, loopLimitPx: number) {
      this.track = trackElement;
      this.limit = Math.abs(loopLimitPx);
      this._setX = gsap.quickSetter(trackElement, "x", "px") as (v: number) => void;
    }

    onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) > 1) {
        this.rawDelta += delta * 0.8;
        this._wheelFiredThisFrame = true;
      }
    };

    onScroll = () => {
      if (this._wheelFiredThisFrame) return;
      const currentY = getRawScroll();
      const delta = currentY - this.lastScrollY;
      this.lastScrollY = currentY;
      if (Math.abs(delta) > 500) return;
      if (Math.abs(delta) > 0) this.rawDelta += delta * 0.8;
    };

    update = () => {
      if (this.isPaused) return;
      const dt = gsap.ticker.deltaRatio(60);
      this.velocity += this.rawDelta * this.cfg.scrollGain * 0.01;
      this.velocity = Math.max(-this.cfg.velocityClamp, Math.min(this.cfg.velocityClamp, this.velocity));
      this.rawDelta = 0;
      this._wheelFiredThisFrame = false;
      this.velocity *= Math.pow(this.cfg.friction, dt);
      if (Math.abs(this.velocity) < 0.001) this.velocity = 0;
      const totalSpeed = (-this.cfg.baseSpeed + this.velocity) * dt;
      this.targetX += totalSpeed;
      const lerpFactor = 1 - Math.pow(1 - this.cfg.lerp, dt);
      this.x += (this.targetX - this.x) * lerpFactor;
      while (this.x <= -this.limit) {
        this.x += this.limit;
        this.targetX += this.limit;
      }
      while (this.x >= 0) {
        this.x -= this.limit;
        this.targetX -= this.limit;
      }
      const now = performance.now();
      if (now - this._lastRender >= 33.3) {
        this._setX(this.x);
        this._lastRender = now;
      }
    };

    start() {
      if (this.isActive) return;
      this.isActive = true;
      window.addEventListener("wheel", this.onWheel, { passive: true });
      window.addEventListener("scroll", this.onScroll, { passive: true });
      gsap.ticker.add(this.update);
    }

    stop() {
      if (!this.isActive) return;
      this.isActive = false;
      window.removeEventListener("wheel", this.onWheel);
      window.removeEventListener("scroll", this.onScroll);
      gsap.ticker.remove(this.update);
    }

    destroy() {
      this.stop();
      gsap.set(this.track, { clearProps: "transform" });
    }
  }

  function buildBrandsTrack(reentryDelay: number | null) {
    const track = $id("hero-brandsMarqueeTrack");
    if (!track) return;

    if (currentMarqueeInstance) {
      currentMarqueeInstance.destroy();
      currentMarqueeInstance = null;
    }

    track.innerHTML = "";
    track.style.animation = "none";
    track.style.transform = "translate3d(0,0,0)";

    const fragment = document.createDocumentFragment();
    const startOffset =
      reentryDelay != null
        ? reentryDelay
        : parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--marquee-offset")
          ) || 2.0;

    for (let i = 0; i < logosOnScreen; i++) {
      const div = baseDiv.cloneNode(true) as HTMLElement;
      div.className = "logo-item with-entry";
      const baseDelay = 0.08;
      const wave = Math.sin(i * 0.4) * 0.015;
      const delay = (startOffset + i * baseDelay + wave).toFixed(3);
      div.style.animationDelay = `${delay}s, ${delay}s`;
      div.addEventListener(
        "animationend",
        () => {
          div.classList.remove("with-entry");
        },
        { once: true }
      );
      fragment.appendChild(div);
    }

    const approxItemWidth = 166;
    const itemsNeededToFillScreen = Math.ceil(window.innerWidth / approxItemWidth);
    const bufferCount = Math.max(logosOnScreen + 2, itemsNeededToFillScreen + 4);
    for (let i = 0; i < bufferCount; i++) {
      const div = baseDiv.cloneNode(true) as HTMLElement;
      div.className = "logo-item";
      fragment.appendChild(div);
    }

    track.appendChild(fragment);

    requestAnimationFrame(() => {
      const items = track.children;
      if (items.length < logosOnScreen + 1) return;
      const firstItem = items[0] as HTMLElement;
      const duplicateStartItem = items[logosOnScreen] as HTMLElement;
      const rawDistance = duplicateStartItem.offsetLeft - firstItem.offsetLeft;
      const dpr = window.devicePixelRatio || 1;
      const scrollDistance = Math.round(rawDistance * dpr) / dpr;
      currentMarqueeInstance = new TidalDriftMarquee(track, scrollDistance);
      currentMarqueeInstance.start();
      brandsHasBuilt = true;
    });
  }

  const wrapper = $id("hero-brandsMarqueeWrapper");
  let io: IntersectionObserver | null = null;
  if (wrapper) {
    io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            if (currentMarqueeInstance) {
              currentMarqueeInstance.destroy();
              currentMarqueeInstance = null;
            }
            const track = $id("hero-brandsMarqueeTrack");
            if (track) {
              track.innerHTML = "";
              track.style.transform = "translate3d(0,0,0)";
            }
          } else if (brandsHasBuilt && !currentMarqueeInstance) {
            buildBrandsTrack(0);
          }
        });
      },
      { threshold: 0 }
    );
    io.observe(wrapper);
  }

  let resizeTimeout: ReturnType<typeof setTimeout>;
  let lastWidth = window.innerWidth;
  const onResize = () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => buildBrandsTrack(0), 200);
  };
  window.addEventListener("resize", onResize);

  requestAnimationFrame(() => {
    buildBrandsTrack(null);
  });

  return () => {
    if (currentMarqueeInstance) {
      currentMarqueeInstance.destroy();
      currentMarqueeInstance = null;
    }
    io?.disconnect();
    window.removeEventListener("resize", onResize);
  };
}

function runTrail(container: HTMLElement, heroInitT0: number): () => void {
  const $id = (id: string) => container.querySelector<HTMLElement>("#" + id);
  const trailEl = $id("hero-trailContainer");
  if (!trailEl || window.innerWidth <= 1200) return () => {};
  const trailContainer = trailEl;

  const vw = window.innerWidth;
  const SIZE_SCALE = vw >= 2000 ? 1 : vw <= 1200 ? 0.7 : 0.7 + ((vw - 1200) / 800) * 0.3;

  const V = {
    ASPECT: 231 / 300,
    SIZE_MAX: Math.round(240 * SIZE_SCALE),
    SIZE_MIN_RATIO: 0.8,
    SPACING_SLOW: 250,
    SPACING_FAST: 130,
    SPEED_FLOOR: 0.15,
    SPEED_CEIL: 2.5,
    HISTORY_MS: 200,
    LIFESPAN_BASE: 1100,
    LIFESPAN_MAX: 1800,
    MAX_VISIBLE: 3,
    IN_S: 0.6,
    OUT_S: 0.8,
    OUT_S_FAST: 0.2,
    MAX_ROT: 8,
    ENTRY_ROT_MIN: 10,
    ENTRY_ROT_MAX: 30,
    IN_EASE: "back.out(1.4)" as const,
    IN_ROT_EASE: "power2.out" as const,
    OUT_EASE: "power2.in" as const,
    BORDER_RADIUS: 4,
    INNER_BLEED: 20,
    INNER_MASK_START: 0.35,
    BRIGHT_START: 200,
    DRIFT_MULT: 110,
    DRIFT_CAP: 1.2,
    DRIFT_S: 1.5,
    DRIFT_EASE: "power4" as const,
  };

  const COLORS = [
    "#e8734a", "#d4a373", "#c2956b", "#b07d62",
    "#e09f5a", "#cc8844", "#d9765b", "#c47a5c",
    "#b5835a", "#d68c5e", "#e4956a", "#c9704e",
    "#bf8f6e", "#d4a07a",
  ];

  const iconTemplate = document.createElement("div");
  iconTemplate.className = "photo-icon";
  iconTemplate.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48" fill="none" preserveAspectRatio="none">
    <circle cx="48" cy="12" r="8" fill="rgba(255,255,255,0.9)"/>
    <path d="M0 48 L16 22 L28 34 L40 14 L64 48 Z" fill="rgba(255,255,255,0.75)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
    <path d="M0 48 L16 22 L28 34 L0 48Z" fill="rgba(255,255,255,0.55)"/>
  </svg>`;

  const marqueeEl = $id("hero-brandsMarqueeWrapper");
  let containerRect = trailContainer.getBoundingClientRect();
  let trailMaxY = containerRect.bottom;
  let rectDirty = false;

  const cleanups: (() => void)[] = [];
  const tickFns: (() => void)[] = [];

  function updateContainerRect() {
    containerRect = trailContainer.getBoundingClientRect();
    if (marqueeEl) trailMaxY = marqueeEl.getBoundingClientRect().bottom;
    rectDirty = false;
  }

  const resizeHandler = () => updateContainerRect();
  const scrollHandler = () => {
    rectDirty = true;
  };
  window.addEventListener("resize", resizeHandler);
  window.addEventListener("scroll", scrollHandler, { passive: true });
  cleanups.push(() => {
    window.removeEventListener("resize", resizeHandler);
    window.removeEventListener("scroll", scrollHandler);
  });
  updateContainerRect();

  const trail: Array<{
    wrap: HTMLElement;
    inner: HTMLElement;
    animTarget: HTMLElement;
    rot: number;
    born: number;
    die: number;
  }> = [];
  const dying = new Set<typeof trail[0]>();
  const history: Array<{ x: number; y: number; t: number }> = [];
  let mx = 0,
    my = 0,
    lmx = 0,
    lmy = 0,
    cmx = 0,
    cmy = 0;
  let isMoving = false;
  let lastMoveT = 0;
  let ci = 0;
  let zIdx = 1;
  let trailWasEmpty = true;

  const sizeMin = () => Math.round(V.SIZE_MAX * V.SIZE_MIN_RATIO);
  const getSize = (t: number) => V.SIZE_MAX - (V.SIZE_MAX - sizeMin()) * t;
  const getSpacing = (t: number) => V.SPACING_SLOW + (V.SPACING_FAST - V.SPACING_SLOW) * t;
  const dist = (ax: number, ay: number, bx: number, by: number) =>
    Math.hypot(ax - bx, ay - by);
  const lerp = (a: number, b: number, n: number) => (1 - n) * a + n * b;

  const pushHistory = (x: number, y: number) => {
    const now = performance.now();
    history.push({ x, y, t: now });
    while (history.length > 1 && now - history[0].t > V.HISTORY_MS) history.shift();
  };

  const getSpeed = () => {
    if (history.length < 2) return 0;
    const f = history[0],
      l = history[history.length - 1];
    const dt = l.t - f.t;
    if (dt < 4) return 0;
    return Math.hypot(l.x - f.x, l.y - f.y) / dt;
  };

  const speedNorm = () =>
    Math.min(1, Math.max(0, (getSpeed() - V.SPEED_FLOOR) / (V.SPEED_CEIL - V.SPEED_FLOOR)));

  const getLifespan = () => {
    let alive = 0;
    for (let i = 0; i < trail.length; i++) {
      if (!dying.has(trail[i])) alive++;
    }
    const ratio = 1 - Math.min(alive / V.MAX_VISIBLE, 1);
    return V.LIFESPAN_BASE + (V.LIFESPAN_MAX - V.LIFESPAN_BASE) * ratio;
  };

  const kill = (
    obj: (typeof trail)[0],
    outS: number
  ) => {
    if (dying.has(obj)) return;
    dying.add(obj);
    if (obj.animTarget) {
      gsap.killTweensOf(obj.animTarget);
      gsap.killTweensOf(obj.wrap);
    }
    if (obj.animTarget) {
      gsap.to(obj.animTarget, {
        scale: 3,
        duration: outS,
        ease: V.OUT_EASE,
        overwrite: "auto",
      });
    }
    gsap.to(obj.inner, {
      scale: 0,
      duration: outS,
      ease: V.OUT_EASE,
      overwrite: "auto",
    });
    gsap.to(obj.wrap, {
      rotation: obj.rot + 360,
      duration: outS,
      ease: V.OUT_EASE,
      overwrite: "auto",
      onComplete: () => {
        obj.wrap.remove();
        dying.delete(obj);
      },
    });
  };

  const spawn = (t: number) => {
    const color = COLORS[ci];
    ci = (ci + 1) % COLORS.length;
    const w = getSize(t);
    const h = w * V.ASPECT;
    const rot = (Math.random() - 0.5) * V.MAX_ROT * 2;
    const lifespan = getLifespan();
    const entryExtra =
      (V.ENTRY_ROT_MIN + Math.random() * (V.ENTRY_ROT_MAX - V.ENTRY_ROT_MIN)) *
      (Math.random() < 0.5 ? -1 : 1);
    const startRot = rot + entryExtra;

    const x = mx - containerRect.left;
    const y = my - containerRect.top;
    const cx = cmx - containerRect.left;
    const cy = cmy - containerRect.top;

    const wrap = document.createElement("div");
    wrap.className = "trail-wrap hw-hint";
    wrap.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;

    const inner = document.createElement("div");
    inner.className = "trail-block is-photo";
    inner.style.borderRadius = V.BORDER_RADIUS + "px";

    const photoInner = document.createElement("div");
    photoInner.className = "photo-inner";
    photoInner.style.cssText =
      `top:${-V.INNER_BLEED / 2}px;left:${-V.INNER_BLEED / 2}px;` +
      `width:calc(100% + ${V.INNER_BLEED}px);height:calc(100% + ${V.INNER_BLEED}px);` +
      `background:${color};`;

    const icon = iconTemplate.cloneNode(true);
    photoInner.appendChild(icon);
    inner.appendChild(photoInner);
    wrap.appendChild(inner);
    trailContainer.appendChild(wrap);

    ++zIdx;

    const dx = mx - cmx;
    const dy = my - cmy;
    const cdist = Math.sqrt(dx * dx + dy * dy);
    let ndx = 0,
      ndy = 0;
    if (cdist > 0) {
      ndx = dx / cdist;
      ndy = dy / cdist;
    }
    const rawDrift = cdist / 100;
    const driftScale =
      rawDrift <= 1 ? rawDrift : Math.min(1 + Math.sqrt(rawDrift - 1) * 0.2, V.DRIFT_CAP);
    ndx *= driftScale;
    ndy *= driftScale;

    gsap.set(wrap, {
      xPercent: -50,
      yPercent: -50,
      rotation: startRot,
      opacity: 1,
      zIndex: zIdx,
    });

    gsap.fromTo(
      wrap,
      { x: cx - x, y: cy - y, scale: 0 },
      { x: 0, y: 0, scale: 1, duration: V.IN_S, ease: V.IN_EASE, overwrite: "auto" }
    );
    gsap.to(wrap, {
      rotation: rot,
      duration: V.IN_S,
      ease: V.IN_ROT_EASE,
      overwrite: "auto",
    });
    gsap.fromTo(
      photoInner,
      { scale: V.INNER_MASK_START, filter: `brightness(${V.BRIGHT_START}%)` },
      { scale: 1, filter: "brightness(100%)", duration: V.IN_S, ease: V.IN_EASE }
    );
    gsap.to(wrap, {
      x: `+=${ndx * V.DRIFT_MULT}`,
      y: `+=${ndy * V.DRIFT_MULT}`,
      duration: V.DRIFT_S,
      ease: V.DRIFT_EASE,
      delay: 0.05,
    });

    trail.push({
      wrap,
      inner,
      animTarget: photoInner,
      rot,
      born: performance.now(),
      die: performance.now() + lifespan,
    });
  };

  const isInContainer = (x: number, y: number) =>
    x >= containerRect.left &&
    x <= containerRect.right &&
    y >= containerRect.top &&
    y <= trailMaxY;

  const trySpawn = () => {
    if (!isMoving) return;
    if (!isInContainer(mx, my)) return;
    const t = speedNorm();
    if (!trailWasEmpty && dist(mx, my, lmx, lmy) < getSpacing(t)) return;
    lmx = mx;
    lmy = my;
    trailWasEmpty = false;
    spawn(t);
  };

  const cleanupLoop = () => {
    const now = performance.now();
    let alive = 0;
    for (let i = 0; i < trail.length; i++) {
      if (!dying.has(trail[i])) alive++;
    }
    if (alive === 0 && zIdx !== 1) zIdx = 1;
    let i = 0;
    while (alive > V.MAX_VISIBLE && i < trail.length) {
      if (!dying.has(trail[i])) {
        kill(trail[i], V.OUT_S_FAST);
        alive--;
      }
      i++;
    }
    while (trail.length && !dying.has(trail[0]) && now >= trail[0].die) {
      kill(trail[0], V.OUT_S);
      trail.shift();
    }
    while (trail.length && dying.has(trail[0])) trail.shift();
  };

  const tick = () => {
    if (isMoving && performance.now() - lastMoveT > 100) isMoving = false;
    cmx = lerp(cmx, mx, 0.1);
    cmy = lerp(cmy, my, 0.1);
    if (rectDirty) updateContainerRect();
    if (!isMoving && trail.length === 0) return;
    let alive = 0;
    for (let i = 0; i < trail.length; i++) {
      if (!dying.has(trail[i])) alive++;
    }
    if (alive === 0) trailWasEmpty = true;
    trySpawn();
    cleanupLoop();
  };

  const mouseoverInit = (e: MouseEvent) => {
    mx = lmx = cmx = e.clientX;
    my = lmy = cmy = e.clientY;
    pushHistory(mx, my);
    document.removeEventListener("mouseover", mouseoverInit);
  };
  document.addEventListener("mouseover", mouseoverInit);
  cleanups.push(() => document.removeEventListener("mouseover", mouseoverInit));

  const mousemoveHandler = (e: MouseEvent) => {
    mx = e.clientX;
    my = e.clientY;
    pushHistory(mx, my);
    isMoving = true;
    lastMoveT = performance.now();
  };

  const TRAIL_MIN_DELAY = 3500;

  const activateTrail = () => {
    document.addEventListener("mousemove", mousemoveHandler, { passive: true });
    tickFns.push(tick);
    gsap.ticker.add(tick);
  };

  const tryActivate = () => {
    const elapsed = performance.now() - heroInitT0;
    if (elapsed >= TRAIL_MIN_DELAY) {
      activateTrail();
    } else {
      const t = setTimeout(activateTrail, TRAIL_MIN_DELAY - elapsed);
      cleanups.push(() => clearTimeout(t));
    }
  };

  if (document.readyState === "complete") {
    tryActivate();
  } else {
    const onLoad = () => tryActivate();
    window.addEventListener("load", onLoad);
    cleanups.push(() => window.removeEventListener("load", onLoad));
  }

  return () => {
    tickFns.forEach(() => gsap.ticker.remove(tick));
    trail.forEach((obj) => {
      try {
        obj.wrap.remove();
      } catch (_) {}
    });
    cleanups.forEach((c) => c());
  };
}

/** Season pill: tekst zależny od daty (jak w referencji). */
function seasonPillPL(): string {
  const now = new Date();
  const m = now.getMonth();
  const d = now.getDate();
  const hard = d >= 15;
  if (m === 0 || m === 1) return hard ? "Ostatnie terminy na start roku" : "Zacznij rok z nową stroną";
  if (m === 2 || m === 3) return hard ? "Ostatnie terminy na majówkę" : "Strona gotowa na majówkę";
  if (m === 4 || m === 5) return hard ? "Ostatnie terminy przed urlopami" : "Start przed urlopami";
  if (m === 6) return "Strona gotowa na wrzesień";
  if (m === 7) return hard ? "Ostatnie terminy na wrzesień" : "Strona gotowa na wrzesień";
  if (m === 8 || m === 9) return hard ? "Ostatnie terminy na jesień" : "Strona gotowa na jesień";
  if (m === 10) return hard ? "Ostatnie terminy przed świętami" : "Strona gotowa przed świętami";
  return hard ? "Ostatnie terminy w tym roku" : "Domknij projekt w tym roku";
}

/** CTA: tooltip (najechanie na pendulum / season pill) + season pill tekst od daty. */
function runCtaTooltipAndSeasonPill(container: HTMLElement): () => void {
  const $ = (sel: string) => container.querySelector<HTMLElement>(sel);
  const $id = (id: string) => container.querySelector<HTMLElement>("#" + id);
  const cleanups: (() => void)[] = [];

  const seasonPill = $id("hero-season-pill");
  if (seasonPill) {
    seasonPill.textContent = seasonPillPL();
  }

  const ctaPendulum = $(".pendulum-container");
  const ctaTooltip = $id("hero-brainTooltip");
  const ctaCloseBtn = ctaTooltip?.querySelector<HTMLElement>(".tooltip-close");

  if (ctaTooltip) {
    let ctaHoverTimer: ReturnType<typeof setTimeout> | null = null;
    let ctaIsDismissed = false;

    const showCtaTooltip = () => {
      if (ctaIsDismissed || window.innerWidth < 600) return;
      ctaTooltip.classList.add("visible");
    };
    const hideCtaTooltip = () => {
      ctaTooltip.classList.remove("visible");
      ctaIsDismissed = true;
    };

    if (ctaPendulum) {
      ctaPendulum.addEventListener("mouseenter", showCtaTooltip);
      cleanups.push(() => ctaPendulum.removeEventListener("mouseenter", showCtaTooltip));
    }
    if (seasonPill) {
      seasonPill.addEventListener("mouseenter", showCtaTooltip);
      cleanups.push(() => seasonPill.removeEventListener("mouseenter", showCtaTooltip));
    }

    const ctaBtn = $(".cta-button");
    const TRIGGER_AT_TAP2_CYCLE2 = 8105;
    if (ctaBtn) {
      const onCtaEnter = () => {
        if (ctaIsDismissed || window.innerWidth < 600) return;
        ctaHoverTimer = setTimeout(showCtaTooltip, TRIGGER_AT_TAP2_CYCLE2);
      };
      const onCtaLeave = () => {
        if (ctaHoverTimer) {
          clearTimeout(ctaHoverTimer);
          ctaHoverTimer = null;
        }
      };
      ctaBtn.addEventListener("mouseenter", onCtaEnter);
      ctaBtn.addEventListener("mouseleave", onCtaLeave);
      cleanups.push(() => {
        if (ctaHoverTimer) clearTimeout(ctaHoverTimer);
        ctaBtn.removeEventListener("mouseenter", onCtaEnter);
        ctaBtn.removeEventListener("mouseleave", onCtaLeave);
      });
    }

    const onResize = () => {
      if (ctaHoverTimer) {
        clearTimeout(ctaHoverTimer);
        ctaHoverTimer = null;
      }
      ctaTooltip.classList.remove("visible");
    };
    window.addEventListener("resize", onResize);
    cleanups.push(() => window.removeEventListener("resize", onResize));

    if (ctaCloseBtn) {
      ctaCloseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        hideCtaTooltip();
      });
    }
  }

  return () => cleanups.forEach((c) => c());
}

/** Badge 20 lat: animacja wejścia (przechylony tekst PRZEWAGA/DOŚWIADCZENIA) + pendulum (delikatny ruch). */
function runBadge20Lat(container: HTMLElement): () => void {
  const $ = (sel: string) => container.querySelector<HTMLElement>(sel);
  const cleanups: (() => void)[] = [];

  const wrapper = $(".badge-20lat-wrapper");
  const svg = $(".badge-20lat-wrapper .rotating-svg");
  const badge = $(".badge-20lat");
  const number = $(".badge-20lat .number-20");
  const label = $(".badge-20lat-wrapper .label-lat");
  const textTop = $(".badge-20lat-wrapper .rotating-text.text-top");
  const textBottom = $(".badge-20lat-wrapper .rotating-text.text-bottom");

  if (!wrapper || !svg || !badge || !number || !label) return () => {};

  let pendulum: gsap.core.Tween | null = null;
  let timeScaleController: gsap.core.Timeline | null = null;
  const hoverTweens: (gsap.core.Tween | undefined)[] = [];
  let isEntryComplete = false;
  let isHoverActive = false;
  let autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  const MOBILE_HOVER_DURATION = 2500;
  const hasHover = (typeof window !== "undefined" && window.matchMedia?.("(hover: hover)")?.matches) ?? false;

  function killHoverTweens() {
    hoverTweens.forEach((t) => t?.kill?.());
    hoverTweens.length = 0;
  }

  function killAllAnimations() {
    pendulum?.kill?.();
    timeScaleController?.kill?.();
    killHoverTweens();
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    pendulum = null;
    timeScaleController = null;
    isEntryComplete = false;
    isHoverActive = false;
    [wrapper, svg, badge, number, label].forEach((el) => {
      if (el) gsap.set(el, { clearProps: "all" });
    });
    if (textTop && textBottom) gsap.set([textTop, textBottom], { clearProps: "all" });
    if (wrapper) gsap.set(wrapper, { autoAlpha: 0 });
  }

  function playEntry() {
    if (typeof window !== "undefined" && window.innerWidth < 650) return;
    killAllAnimations();
    [wrapper, svg, badge, number, label, textTop, textBottom].forEach((el) => {
      if (el) gsap.killTweensOf(el);
    });
    gsap.set(wrapper, { autoAlpha: 0 });
    gsap.set(svg, { rotation: 180, scale: 0.8, opacity: 0, y: -26, transformOrigin: "50% 50%" });
    gsap.set(badge, { scale: 0.5, opacity: 0 });
    gsap.set(number, { y: 20, opacity: 0, color: "#f7f6f4" });
    gsap.set(label, { opacity: 0, xPercent: -50, x: 1, y: 15, scale: 1 });
    if (textTop && textBottom) gsap.set([textTop, textBottom], { opacity: 0.8 });

    const badge20Delay =
      parseFloat(
        typeof getComputedStyle !== "undefined"
          ? getComputedStyle(document.documentElement).getPropertyValue("--badge-20lat-delay")
          : ""
      ) || 1.25;
    const master = gsap.timeline({ delay: badge20Delay });

    master.to(wrapper, { autoAlpha: 1, duration: 0.01 }, 0);
    master.to(
      svg,
      { rotation: 33, scale: 1, opacity: 1, duration: 1.4, ease: "power2.out", transformOrigin: "50% 50%" },
      0
    );
    master.to(badge, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.7)" }, 0.4);
    master.to(number, { y: -5, opacity: 1, duration: 0.6, ease: "power2.out" }, 0.7);
    master.to(label, { opacity: 0.8, duration: 0.4, ease: "power2.out" }, 0.9);
    master.call(
      () => {
        isEntryComplete = true;
        pendulum = gsap.to(svg, {
          rotation: -33,
          duration: 9.75,
          ease: "sine.inOut",
          transformOrigin: "50% 50%",
          yoyo: true,
          repeat: -1,
        });
      },
      [],
      1.4
    );
    cleanups.push(() => master.kill());
  }

  function handleHoverEnter() {
    if (!isEntryComplete || !pendulum) return;
    if (isHoverActive) return;
    isHoverActive = true;
    killHoverTweens();
    hoverTweens.push(
      gsap.to(badge, { scale: 0.85, duration: 1.5, ease: "power2.out", overwrite: "auto" }),
      gsap.to(number, {
        color: "transparent",
        textShadow: "1px 1px 0px rgba(255,255,255,0.2), -1px -1px 0px rgba(0,0,0,0)",
        duration: 1,
        overwrite: "auto",
      }),
      gsap.to(label, { opacity: 1, color: "#b0b0b0", scale: 0.85, duration: 0.6, ease: "power2.out", overwrite: "auto" }),
      gsap.to(svg, { scale: 1.1, duration: 2.0, ease: "elastic.out(1, 0.3)", transformOrigin: "50% 50%", overwrite: "auto" })
    );
    if (textTop && textBottom) {
      hoverTweens.push(
        gsap.to([textTop, textBottom], {
          opacity: 0.5,
          duration: 2.0,
          ease: "elastic.out(1, 0.3)",
          overwrite: "auto",
        })
      );
    }
    timeScaleController?.kill?.();
    timeScaleController = gsap
      .timeline()
      .to(pendulum, { timeScale: 12, duration: 4, ease: "sine.in" })
      .to(pendulum, { timeScale: 1, duration: 6, ease: "sine.out" });
  }

  function handleHoverLeave() {
    if (!isEntryComplete) return;
    if (!isHoverActive) return;
    isHoverActive = false;
    killHoverTweens();
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    hoverTweens.push(
      gsap.to(badge, { scale: 1, duration: 1.5, overwrite: "auto" }),
      gsap.to(number, {
        color: "#f7f6f4",
        textShadow: "-2px -2px 3px rgba(255,255,255,1), 2px 2px 3px rgba(0,0,0,0.15)",
        duration: 1,
        overwrite: "auto",
      }),
      gsap.to(label, { opacity: 0.8, color: "#a0a0a0", scale: 1, duration: 0.6, ease: "power2.out", overwrite: "auto" }),
      gsap.to(svg, { scale: 1, duration: 2.0, ease: "elastic.out(1, 0.3)", transformOrigin: "50% 50%", overwrite: "auto" })
    );
    if (textTop && textBottom) {
      hoverTweens.push(
        gsap.to([textTop, textBottom], {
          opacity: 0.8,
          duration: 2.0,
          ease: "elastic.out(1, 0.3)",
          overwrite: "auto",
        })
      );
    }
  }

  const onWrapperEnter = () => {
    if (!hasHover) return;
    handleHoverEnter();
  };
  const onWrapperLeave = () => {
    if (!hasHover) return;
    handleHoverLeave();
  };
  const onWrapperClick = () => {
    if (hasHover) return;
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    if (isHoverActive) {
      autoCloseTimer = setTimeout(handleHoverLeave, MOBILE_HOVER_DURATION);
      return;
    }
    handleHoverEnter();
    autoCloseTimer = setTimeout(handleHoverLeave, MOBILE_HOVER_DURATION);
  };
  wrapper.addEventListener("mouseenter", onWrapperEnter);
  wrapper.addEventListener("mouseleave", onWrapperLeave);
  wrapper.addEventListener("click", onWrapperClick);
  cleanups.push(() => {
    wrapper.removeEventListener("mouseenter", onWrapperEnter);
    wrapper.removeEventListener("mouseleave", onWrapperLeave);
    wrapper.removeEventListener("click", onWrapperClick);
  });

  const pendulumIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (pendulum) {
          if (e.isIntersecting) pendulum.resume();
          else pendulum.pause();
        }
      });
    },
    { rootMargin: "50px" }
  );
  pendulumIO.observe(wrapper);
  cleanups.push(() => pendulumIO.disconnect());

  if (typeof window !== "undefined") {
    (window as Window & { badge20LatReplay?: () => void; badge20LatKill?: () => void }).badge20LatReplay = playEntry;
    (window as Window & { badge20LatKill?: () => void }).badge20LatKill = killAllAnimations;
  }

  const t = requestAnimationFrame(() => playEntry());
  cleanups.push(() => cancelAnimationFrame(t));

  return () => {
    killAllAnimations();
    cleanups.forEach((c) => c());
    if (typeof window !== "undefined") {
      delete (window as Window & { badge20LatReplay?: () => void }).badge20LatReplay;
      delete (window as Window & { badge20LatKill?: () => void }).badge20LatKill;
    }
  };
}

/** Uruchamia marquee + trail + badge 20 lat + CTA tooltip/season pill. Zwraca funkcję cleanup. */
export function runHeroEngine(container: HTMLElement): () => void {
  const heroInitT0 = performance.now();
  const cleanupMarquee = runMarquee(container);
  const cleanupTrail = runTrail(container, heroInitT0);
  const cleanupBadge20 = runBadge20Lat(container);
  const cleanupCta = runCtaTooltipAndSeasonPill(container);

  return () => {
    cleanupMarquee();
    cleanupTrail();
    cleanupBadge20();
    cleanupCta();
  };
}
