"use client";

import { useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import type { Tier } from "@/lib/autoTier";
import { runHeroEngine } from "./heroEngine";
import "./hero-section.css";

export interface HeroSectionProps {
  headline: string;
  sub: string;
  tier: Tier;
}

const LOGO_SVG = (
  <svg className="main-logo" xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" viewBox="0 0 504 196">
    <path
      className="st1"
      d="M235 104c1 13 11 23 23 23h3c11-2 21-10 28-18 9-11 14-28 14-41l-2-8c1-5 0-9-3-12-3-5-10-7-17-6-11 2-25 11-34 22a59 59 0 0 0-12 40zm31-31c7-10 15-14 18-14 4 0 3 13 0 21-2 5-5 12-9 17-5 6-10 10-14 10h-1c-1 0-3 0-3-5-1-8 3-20 9-29zm228-1-4 2c-9 22-19 25-22 25-1 0-2 0-3-3 0-7 2-20 18-44l2-3c0-5-5-9-11-9s-9 3-12 7l-13 25c-9 17-19 24-25 25v-1c0-3 3-10 6-15l2-3c5-11 9-20 9-28s-5-13-13-13h-1c-8 1-16 6-25 17l-1 1 2-7c0-6-5-10-12-10-2 0-6 0-7 3l-8 21c-6 14-27 37-43 39h-2c-2 0-4 0-5-6a72 72 0 0 1 15-35c5-6 8-7 10-7h1l-2 6-5 5-1 4c1 3 4 5 8 5h1c4 0 7-3 9-8 3-4 4-10 3-15-1-7-7-12-15-12h-2c-8 1-15 4-22 11-7 6-13 14-18 23-4 9-6 17-5 25 2 15 10 24 22 24h3c10-1 21-9 32-19l-1 5c0 5 2 8 4 9 2 2 5 3 9 3h2c4 0 7-2 7-5 0-11 5-26 16-42s18-16 20-16l2 1c0 4-3 9-7 17l-5 11c-3 6-6 13-5 20 1 8 6 13 14 13h3c7-1 16-7 23-16 2 13 10 19 18 19h1c14-2 31-22 37-41 1-2 0-5-1-7l-3-1zm-23 65c-136-11-305 8-347 24-16 6-17 18-17 23 1 5 3 9 7 10l2-1c33-20 181-55 362-49 6 0 4-6-7-7zM111 14c-6 0-12 1-18 4-3-2-8-2-14 0C43 33 2 86 2 134c0 32 21 48 41 48h5c14-2 32-14 45-30 23-29 41-72 41-102s-13-36-23-36zM44 154c-5 0-9-7-9-18 0-18 8-40 20-61l-1 12c0 7 2 11 3 13l5 2 2-2c3-39 28-67 40-67 2 0 7 0 7 14 0 44-43 107-67 107zm100-12c12 0 21-9 28-22 4 10 11 14 18 14 22 0 47-34 47-77 0-13-5-19-13-19s-14 6-14 7c10 41-3 67-14 67-3 0-5-3-5-9s3-15 11-25c2-2-13-16-23-2-3 4-6 12-8 19-5 12-13 23-19 23-4 0-6-3-6-9 0-16 16-36 26-41 3-1-12-17-27-2-7 8-21 30-21 49s11 27 20 27zM500 16l-7-4-2-7c0-2-1-3-3-3l-3 1-6 5h-8c-1-1-3 0-3 1l-1 4 4 7-3 7v4l4 2 8-1 6 5h3c2 0 3-1 3-3l2-7 6-4 2-4-2-3z"
    />
  </svg>
);

// Dev StrictMode (mount->unmount->mount) może podwójnie odpalić sekwencję wejścia.
// W oryginale HTML choreografia uruchamia się raz na load.
let hasPlayedHeroEntrySequence = false;

export function HeroSection({ headline, sub, tier }: HeroSectionProps) {
  const containerRef = useRef<HTMLElement>(null);

  // HAAT: ustawienie data-h1-tier / data-desc-tier na html (CSS w hero-section.css)
  useEffect(() => {
    document.documentElement.setAttribute("data-h1-tier", tier);
    document.documentElement.setAttribute("data-desc-tier", tier);
    return () => {
      document.documentElement.removeAttribute("data-h1-tier");
      document.documentElement.removeAttribute("data-desc-tier");
    };
  }, [tier]);

  // Premium gradient (oklch) — włączony gdy przeglądarka wspiera oklch
  useEffect(() => {
    if (typeof CSS === "undefined" || !CSS.supports) return;
    const oklch = CSS.supports("color", "oklch(0.6 0.3 30)");
    const conic = CSS.supports("background-image", "conic-gradient(from 0deg, red, blue)");
    const mask =
      CSS.supports("mask-image", "radial-gradient(circle, #000 0%, transparent 70%)") ||
      CSS.supports("-webkit-mask-image", "radial-gradient(circle, #000 0%, transparent 70%)");
    const supportsPremium = oklch && conic && mask;
    document.documentElement.classList.toggle("fx-premium", supportsPremium);
  }, []);

  // Animacja startowa — 1:1 oryginał (playEntrySequence → 50ms → startGradient): ukrycie, willChange, reflow, double rAF, .animate
  useEffect(() => {
    if (hasPlayedHeroEntrySequence) return;
    hasPlayedHeroEntrySequence = true;

    const el = containerRef.current;
    if (!el) return;
    const gradient = el.querySelector<HTMLElement>(".startup-gradient");
    const burst = el.querySelector(".burst-container");

    let raf1: number | null = null;
    let raf2: number | null = null;

    const start = () => {
      if (gradient) {
        gradient.style.visibility = "hidden";
        gradient.style.opacity = "0";
        gradient.style.transition = "none";
        gradient.style.willChange =
          "mask-image, background-image, --hero-radial-center, --hero-conic-rotate";
        void gradient.offsetWidth;
      }
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (gradient) {
            gradient.style.transition = "";
            gradient.style.visibility = "";
            gradient.style.opacity = "";
            gradient.classList.add("animate");
          }
          burst?.classList.add("animate");
        });
      });
    };
    const t = window.setTimeout(start, 50);
    return () => {
      window.clearTimeout(t);
      if (raf1 !== null) cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, []);

  // Silnik: karuzela logotypów (marquee) + trail (obrazki za myszką) — Typ B, cleanup w return
  useGSAP(
    () => {
      const el = containerRef.current;
      if (!el) return;
      return runHeroEngine(el);
    },
    { scope: containerRef }
  );

  return (
    <section
      id="hero-section"
      ref={containerRef}
      className="banner-section"
      style={{ isolation: "isolate" }}
    >
      <div className="trail-container" id="hero-trailContainer" />
      <div className="gradient-perf-wrapper">
        <div className="startup-gradient" />
      </div>
      <div className="burst-container" id="hero-burstContainer">
        <div className="burst-ripple burst-ripple--1" />
        <div className="burst-ripple burst-ripple--2" />
        <div className="burst-ripple burst-ripple--3" />
        <div className="burst-ripple burst-ripple--4" />
      </div>
      <div className="content-layer">
        <div className="center-wrapper">
          <div className="logo-area">{LOGO_SVG}</div>
          <div className="hero-content">
            <div className="blob-mask" />
            <div className="hero-title-wrapper">
              <h1 className="hero-title">{headline}</h1>
              <div className="lottie-laur-container lottie-laur-left" id="hero-lottieLaurLeft" />
              <div className="lottie-laur-container lottie-laur-right" id="hero-lottieLaurRight" />
            </div>
            <p className="hero-description">{sub}</p>
            <div className="hero-brands-marquee">
              <p className="hero-brands-text hero-brands-text--desktop">
                <strong>4500+ projektów.</strong> Zaufanie marek, które znasz.
              </p>
              <p className="hero-brands-text hero-brands-text--mobile">
                <strong>4500+</strong> Udanych projektów.
              </p>
              <div className="luxury-wrapper" id="hero-brandsMarqueeWrapper">
                <div className="marquee-track" id="hero-brandsMarqueeTrack" />
              </div>
            </div>
          </div>
          <div className="action-area">
            <div className="badge-20lat-wrapper">
              <svg className="rotating-svg" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <path id="hero-arc-top" d="M 11,74 A 59,59 0 0,1 129,74" />
                  <path id="hero-arc-bottom" d="M 11,74 A 59,59 0 0,0 129,74" />
                </defs>
                <text className="rotating-text text-top" textAnchor="middle">
                  <textPath href="#hero-arc-top" xlinkHref="#hero-arc-top" startOffset="50%">
                    PRZEWAGA
                  </textPath>
                </text>
                <text className="rotating-text text-bottom" textAnchor="middle">
                  <textPath href="#hero-arc-bottom" xlinkHref="#hero-arc-bottom" startOffset="50%">
                    DOŚWIADCZENIA
                  </textPath>
                </text>
              </svg>
              <span className="label-lat">LAT</span>
              <button type="button" className="badge-20lat active:scale-[0.97] transition-transform duration-75">
                <div className="pulse" />
                <div className="typography-container">
                  <span className="number-20">20</span>
                </div>
              </button>
            </div>
            <div className="trust-column">
              <div className="badge-wrapper" id="hero-badgeSatysfakcjiWrapper">
                <div className="badge">
                  <div className="gold">
                    <div className="number-stack">
                      <span className="layer-gold layer-common">100%</span>
                      <div className="layer-black layer-common">
                        <span className="char" style={{ ["--i" as string]: 0 }}>1</span>
                        <span className="char" style={{ ["--i" as string]: 1 }}>0</span>
                        <span className="char" style={{ ["--i" as string]: 2 }}>0</span>
                        <span className="char" style={{ ["--i" as string]: 3 }}>%</span>
                      </div>
                    </div>
                    <div className="shine" />
                  </div>
                  <div className="badge-text">
                    <span className="main">SATYSFAKCJI</span>
                    <span className="sub">lub zwrot pieniędzy</span>
                  </div>
                </div>
                <p className="badge-caption">
                  Jedyni w Polsce oferujemy
                  <br />
                  pełną <strong>Gwarancję wyników.</strong>
                </p>
              </div>
            </div>
            <div className="trust-column">
              <div className="badge-google-wrapper active entrance-playing" id="hero-badgeGoogleWrapper">
                <div className="badge-google" id="hero-badgeGoogle">
                  <svg className="google-icon" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <div className="google-content">
                    <div className="stars" id="hero-googleStars" />
                    <span className="google-text">150+ OPINII</span>
                  </div>
                </div>
                <p className="badge-caption highlight">
                  <strong>98% pozytywnych opinii</strong>
                  <br />
                  na temat owocnych stron
                </p>
              </div>
            </div>
            <div className="cta-group">
              <div className="brain-tooltip" id="hero-brainTooltip">
                <button type="button" className="tooltip-close" aria-label="Zamknij" />
                <div className="tooltip-header">
                  <span className="brain-tip">#BRAIN TIP:71</span> Ludzie widzą to, co chcą widzieć.
                </div>
                <div className="tooltip-sub">
                  Żółta kropka kręci się lewo–prawo? A może lata przód–tył?
                  <br />
                  <strong>
                    <em>PS: „Skup się, a zmienisz to myśląc o tym."</em>
                  </strong>
                </div>
              </div>
              <div className="btn-wrapper-wave">
                <a href="#wycena" className="cta-button active:scale-[0.97] transition-transform duration-75">
                  <span className="btn-hole" />
                  <span className="btn-cap" />
                  <span className="btn-text" data-text="Otrzymaj wycenę teraz">
                    Otrzymaj wycenę teraz
                  </span>
                </a>
              </div>
              <div className="cta-note-wrapper">
                <div className="pendulum-container">
                  <canvas className="cta-royal-canvas" id="hero-royalCanvas" width={16} height={16} />
                  <div className="aura" />
                  <div className="sonar" />
                </div>
                <span className="cta-note" id="hero-season-pill">
                  Ostatnie terminy na lato
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
