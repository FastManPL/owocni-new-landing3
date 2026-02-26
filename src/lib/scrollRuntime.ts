/**
 * C1: Jeden właściciel scrolla — singleton scrollRuntime.
 * Sekcje importują z modułu, NIGDY window.__scroll / new Lenis() / ScrollTrigger.refresh().
 * C3: Lenis autoRaf: false, GSAP ticker = master, Lenis slave (prioritize: true).
 * C6: requestRefresh przez brokera, debounce 120ms + double rAF.
 */

import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const DEBOUNCE_MS = 120;
let lenis: Lenis | null = null;
let refreshScheduled: ReturnType<typeof setTimeout> | null = null;
let initDone = false;

function doRefresh() {
  if (typeof window === "undefined") return;
  ScrollTrigger.refresh(true);
  refreshScheduled = null;
}

export const scrollRuntime = {
  init() {
    if (typeof window === "undefined" || initDone) return;
    ScrollTrigger.config({ ignoreMobileResize: true });
    lenis = new Lenis({ autoRaf: false, lerp: 0.08 });
    (window as Window & { __scroll?: Lenis }).__scroll = lenis;

    const raf = (time: number) => {
      lenis?.raf(time * 1000);
      gsap.ticker.add(raf, true, true);
    };
    gsap.ticker.add(raf, true, true);

    window.addEventListener("orientationchange", () => {
      this.requestRefresh("orientationchange");
    });

    initDone = true;
  },

  getScroll(): number {
    return lenis?.scroll ?? (typeof window !== "undefined" ? window.scrollY : 0);
  },

  getRawScroll(): number {
    return lenis?.targetScroll ?? (typeof window !== "undefined" ? window.scrollY : 0);
  },

  requestRefresh(reason: string) {
    if (!initDone) return;
    if (refreshScheduled) clearTimeout(refreshScheduled);
    refreshScheduled = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(doRefresh);
      });
      refreshScheduled = null;
    }, DEBOUNCE_MS);
  },

  kill() {
    lenis?.destroy();
    lenis = null;
    initDone = false;
    if (refreshScheduled) clearTimeout(refreshScheduled);
    refreshScheduled = null;
    if (typeof window !== "undefined") (window as Window & { __scroll?: Lenis }).__scroll = undefined;
  },
};
