/**
 * Silnik sekcji book-stats: liczniki (reels) + sekwencja klatek książki (canvas + ScrollTrigger).
 * Klatki z /Ksiazka-Klatki: frame-001 … frame-023 w AVIF i WEBP (AVIF w pierwszej kolejności, fallback WEBP).
 * Sposób działania animacji bez zmian — tylko źródło to prawdziwe IMG z folderu.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollRuntime } from "@/lib/scrollRuntime";

const FRAME_COUNT = 23;
const FRAMES_BASE = "/Ksiazka-Klatki";

function getFrameExtension(): Promise<"avif" | "webp"> {
  return fetch(`${FRAMES_BASE}/frame-001.avif`).then((r) => (r.ok ? "avif" : "webp")).catch(() => "webp");
}

export function runBookStats(container: HTMLElement): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const $ = (sel: string) => container.querySelector<HTMLElement>(sel);
  const $$ = (sel: string) => container.querySelectorAll<HTMLElement>(sel);
  const $id = (id: string) => container.querySelector<HTMLElement>("#" + id);

  const getScroll = () => scrollRuntime.getScroll();

  const cleanups: (() => void)[] = [];
  const gsapInstances: Array<{ revert?: () => void; kill?: () => void }> = [];
  const timerIds: ReturnType<typeof setTimeout>[] = [];
  const observers: IntersectionObserver[] = [];
  let sectionST: ScrollTrigger | null = null;

  const statsContainer = $(".cs-stats-placeholder");
  const rows = Array.from($$("[data-counter-row]"));
  const wrappers = Array.from($$("[data-counter]"));
  let ready = false;
  let spun = false;

  function buildReel(
    parent: HTMLElement,
    target: number,
    fullRotations: number
  ): HTMLElement {
    const reel = document.createElement("div");
    reel.className = "cs-reel";
    for (let n = 0; n <= 9; n++) {
      const d = document.createElement("div");
      d.className = "cs-digit";
      d.textContent = String(n);
      reel.appendChild(d);
    }
    for (let r = 0; r < fullRotations; r++) {
      for (let n = 0; n <= 9; n++) {
        const d = document.createElement("div");
        d.className = "cs-digit";
        d.textContent = String(n);
        reel.appendChild(d);
      }
    }
    if (fullRotations > 0 && target > 0) {
      for (let n = 0; n <= target; n++) {
        const d = document.createElement("div");
        d.className = "cs-digit";
        d.textContent = String(n);
        reel.appendChild(d);
      }
    }
    (reel as unknown as { _totalSteps: number })._totalSteps = fullRotations * 10 + target;
    parent.appendChild(reel);
    return reel;
  }

  function buildCounter(w: HTMLElement) {
    w.innerHTML = "";
    const digits = (w.dataset.digits ?? "").split(",").map(Number);
    digits.forEach((digit) => {
      const rotations = digit === 0 ? 1 : 0;
      buildReel(w, digit, rotations);
    });
    const suffixSlot = w.closest("[data-counter-row]")?.querySelector("[data-suffix-slot]");
    if (suffixSlot) {
      suffixSlot.innerHTML = "";
      const sym = document.createElement("span");
      sym.className = "cs-suffix-symbol";
      sym.textContent = w.dataset.suffix ?? "";
      suffixSlot.appendChild(sym);
    }
    (w as HTMLElement & { _reels?: HTMLElement[] })._reels = Array.from(w.querySelectorAll(".cs-reel"));
  }

  function spinAll() {
    if (spun) return;
    spun = true;
    const allReels: HTMLElement[] = [];
    wrappers.forEach((w) => {
      const ww = w as HTMLElement & { _reels?: HTMLElement[] };
      if (!ww._reels) return;
      ww._reels.forEach((reel) => allReels.push(reel));
    });
    allReels.forEach((r) => (r.style.willChange = "transform"));
    wrappers.forEach((w) => {
      const ww = w as HTMLElement & { _reels?: HTMLElement[] };
      if (!ww._reels) return;
      ww._reels.forEach((reel, i) => {
        reel.style.transitionDelay = `${i * 120}ms`;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const steps = (reel as unknown as { _totalSteps: number })._totalSteps;
            reel.style.transform = `translateY(-${steps * 1.05}em)`;
          });
        });
      });
    });
    const lastReel = allReels[allReels.length - 1];
    if (lastReel) {
      const cleanupLayers = () => {
        lastReel.removeEventListener("transitionend", onSpinEnd);
        clearTimeout(fallbackTimer);
        allReels.forEach((r) => (r.style.willChange = "auto"));
      };
      const onSpinEnd = (e: TransitionEvent) => {
        if (e.propertyName !== "transform") return;
        cleanupLayers();
      };
      lastReel.addEventListener("transitionend", onSpinEnd);
      const fallbackTimer = setTimeout(cleanupLayers, 2500);
      cleanups.push(cleanupLayers);
    }
    const headings = Array.from(container.querySelectorAll<HTMLElement>(".cs-counter-heading"));
    headings.forEach((h, i) => {
      const tween = gsap.to(h, {
        backgroundPosition: "0% 0",
        duration: 3,
        delay: 0.3 + i * 0.15,
        ease: "bounce.out",
      });
      gsapInstances.push(tween);
    });
  }

  wrappers.forEach((w) => buildCounter(w));

  if (statsContainer) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !ready) {
          ready = true;
          rows.forEach((row, i) => {
            const tid = setTimeout(() => row.classList.add("visible"), i * 180);
            timerIds.push(tid);
          });
          counterObserver.disconnect();
        }
      },
      { threshold: 0.01 }
    );
    counterObserver.observe(statsContainer);
    observers.push(counterObserver);
  }

  const onScroll = () => {
    if (!ready || spun || !statsContainer) return;
    const rect = statsContainer.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.8) {
      spinAll();
      window.removeEventListener("scroll", onScroll);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener("scroll", onScroll));

  const bookContainer = $(".cs-img--book");
  const canvas = $id("book-frames-canvas") as HTMLCanvasElement | null;
  if (!bookContainer || !canvas) {
    return () => {
      cleanups.forEach((c) => c());
      observers.forEach((o) => o.disconnect());
      timerIds.forEach((id) => clearTimeout(id));
      gsapInstances.forEach((i) => i.revert?.());
    };
  }
  const bookEl = bookContainer;
  const canvasEl = canvas;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) {
    return () => {
      cleanups.forEach((c) => c());
      observers.forEach((o) => o.disconnect());
      timerIds.forEach((id) => clearTimeout(id));
      gsapInstances.forEach((i) => i.revert?.());
    };
  }
  const ctxEl = ctx;

  const frames: (ImageBitmap | HTMLImageElement | null)[] = new Array(FRAME_COUNT);
  const loaded: boolean[] = new Array(FRAME_COUNT).fill(false);
  let loadedCount = 0;
  let displayIndex = -1;
  const playhead = { frame: 0 };
  let bookTl: gsap.core.Timeline | null = null;
  let bookST: ScrollTrigger | null = null;
  let bookRO: ResizeObserver | null = null;
  let allLoaded = false;
  const cached = { cw: 0, ch: 0, sx: 0, sy: 0, sw: 0, sh: 0 };
  let roRafId = 0;

  function findNearestLoaded(target: number): number {
    if (loaded[target]) return target;
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (target - d >= 0 && loaded[target - d]) return target - d;
      if (target + d < FRAME_COUNT && loaded[target + d]) return target + d;
    }
    return 0;
  }

  function setupCanvasDPR() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = bookEl.getBoundingClientRect();
    const cw = Math.round(rect.width);
    const ch = Math.round(rect.height);
    if (cw === cached.cw && ch === cached.ch) return;
    const newW = Math.round(rect.width * dpr);
    const newH = Math.round(rect.height * dpr);
    if (canvasEl.width !== newW || canvasEl.height !== newH) {
      canvasEl.width = newW;
      canvasEl.height = newH;
      ctxEl.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const iw = 1000,
      ih = 720;
    const scale = Math.max(cw / iw, ch / ih);
    cached.cw = cw;
    cached.ch = ch;
    cached.sw = Math.round(iw * scale);
    cached.sh = Math.round(ih * scale);
    cached.sx = Math.round((cw - cached.sw) / 2);
    cached.sy = Math.round((ch - cached.sh) / 2);
    if (loadedCount > 0) {
      displayIndex = -1;
      drawFrame(findNearestLoaded(Math.round(playhead.frame)));
    }
  }

  function drawFrame(index: number) {
    if (index === displayIndex) return;
    const img = frames[index];
    if (!img) return;
    displayIndex = index;
    ctxEl.clearRect(0, 0, cached.cw, cached.ch);
    ctxEl.drawImage(img, cached.sx, cached.sy, cached.sw, cached.sh);
  }

  function onFrameLoaded(index: number) {
    loaded[index] = true;
    loadedCount++;
    if (loadedCount === FRAME_COUNT) allLoaded = true;
    const target = Math.round(playhead.frame);
    const bestNow = allLoaded ? target : findNearestLoaded(target);
    if (
      Math.abs(bestNow - target) < Math.abs(displayIndex - target) ||
      bestNow === target
    ) {
      drawFrame(bestNow);
    }
  }

  function createScrollAnimation() {
    const floorImages = $(".cs-floor--images");
    if (!floorImages) return;
    if (!floorImages) return;
    bookTl = gsap.timeline({
      scrollTrigger: {
        trigger: floorImages,
        start: () => {
          const elH = floorImages.offsetHeight;
          const vh = window.innerHeight;
          const idealTop =
            elH < vh
              ? Math.round((vh - elH) / 2)
              : Math.max(150, Math.round(vh * 0.25));
          return `top ${idealTop}`;
        },
        end: () => `+=${Math.round(Math.max(400, window.innerHeight * 0.45))}`,
        scrub: true,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    bookTl.to(playhead, {
      frame: FRAME_COUNT - 1,
      snap: "frame",
      ease: "none",
      onUpdate: () => {
        const target = Math.round(playhead.frame);
        drawFrame(allLoaded ? target : findNearestLoaded(target));
      },
    });
    bookST = bookTl.scrollTrigger!;
    sectionST = bookST;
    scrollRuntime.requestRefresh("book-frames-loaded");
  }

  let frameExt: "avif" | "webp" = "webp";

  function preloadSingleFrame(index: number): Promise<number> {
    const num = String(index + 1).padStart(3, "0");
    const url = `${FRAMES_BASE}/frame-${num}.${frameExt}`;
    return fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.blob();
      })
      .then((blob) => {
        if (typeof createImageBitmap !== "undefined") {
          return createImageBitmap(blob).then((bmp) => {
            frames[index] = bmp;
            return index;
          });
        }
        return new Promise<number>((resolve) => {
          const img = new Image();
          const objUrl = URL.createObjectURL(blob);
          img.onload = () => {
            URL.revokeObjectURL(objUrl);
            if (img.decode) {
              img.decode().then(() => {
                frames[index] = img;
                resolve(index);
              }).catch(() => {
                frames[index] = img;
                resolve(index);
              });
            } else {
              frames[index] = img;
              resolve(index);
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(objUrl);
            resolve(index);
          };
          img.src = objUrl;
        });
      });
  }

  const loadOrder: number[] = [];
  const added: Record<number, boolean> = {};
  function add(idx: number) {
    const i = Math.round(idx);
    if (i < 0 || i >= FRAME_COUNT || added[i]) return;
    added[i] = true;
    loadOrder.push(i);
  }
  add(0);
  add(FRAME_COUNT - 1);
  let step = FRAME_COUNT;
  while (step > 1) {
    step = step / 2;
    for (let i = step; i < FRAME_COUNT; i += step) add(i);
  }
  for (let j = 0; j < FRAME_COUNT; j++) add(j);

  const PRIORITY_COUNT = 5;
  const loadQueue = loadOrder.slice();
  let concurrency = 0;
  const MAX_CONCURRENT = 3;

  function loadNext() {
    while (concurrency < MAX_CONCURRENT && loadQueue.length > 0) {
      const idx = loadQueue.shift()!;
      concurrency++;
      preloadSingleFrame(idx)
        .then((loadedIdx) => {
          concurrency--;
          onFrameLoaded(loadedIdx);
          if (loadedCount >= PRIORITY_COUNT && !bookST) {
            canvasEl.classList.add("is-ready");
            createScrollAnimation();
            if (typeof ResizeObserver !== "undefined" && !bookRO) {
              bookRO = new ResizeObserver(() => {
                cancelAnimationFrame(roRafId);
                roRafId = requestAnimationFrame(setupCanvasDPR);
              });
              bookRO.observe(bookEl);
            }
          }
          loadNext();
        })
        .catch(() => {
          concurrency--;
          loadNext();
        });
    }
  }

  getFrameExtension().then((ext) => {
    frameExt = ext;
    preloadSingleFrame(loadOrder[0]).then((idx) => {
      onFrameLoaded(idx);
      setupCanvasDPR();
      drawFrame(0);
      canvasEl.classList.add("is-ready");
      loadQueue.shift();
      loadNext();
    }).catch(() => {
      loadNext();
    });
  });

  cleanups.push(() => {
    if (bookST) {
      bookST.kill();
      bookST = null;
      sectionST = null;
    }
    if (bookTl) {
      bookTl.kill();
      bookTl = null;
    }
    cancelAnimationFrame(roRafId);
    if (bookRO) {
      bookRO.disconnect();
      bookRO = null;
    }
    if (canvas) {
      canvasEl.width = 1;
      canvasEl.height = 1;
      canvasEl.classList.remove("is-ready");
    }
    frames.forEach((f) => {
      if (f && typeof (f as ImageBitmap).close === "function") (f as ImageBitmap).close();
    });
  });

  return () => {
    cleanups.forEach((c) => c());
    observers.forEach((o) => o.disconnect());
    timerIds.forEach((id) => clearTimeout(id));
    gsapInstances.forEach((i) => i.revert?.());
  };
}
