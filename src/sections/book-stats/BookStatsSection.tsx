"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { runBookStats } from "./bookStatsEngine";
import "./book-stats-section.css";

/**
 * Sekcja book-stats: piętro obrazów (video statystyk + książka z klatkami) + piętro tekstów (H2 + liczniki).
 * Lewa kolumna: video banner-konwersja-strony.mp4. Prawa: klatki 1–23 z /Ksiazka-Klatki (AVIF, fallback WEBP).
 * Uwaga: Pierwsza sekcja "wrapowana" — kolejna sekcja będzie się pojawiać pod spodem przy połowie wylotu (do doprecyzowania).
 */
export function BookStatsSection() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = containerRef.current;
      if (!el) return;
      return runBookStats(el);
    },
    { scope: containerRef }
  );

  return (
    <section
      id="book-stats-section"
      ref={containerRef}
      className="section"
      style={{ isolation: "isolate" }}
    >
      <div id="book-frames-sentry" aria-hidden style={{ height: 0, overflow: "hidden", pointerEvents: "none" }} />
      <div className="container">
        <div className="cs-floor cs-floor--images">
          <div className="cs-floor__left">
            <div className="cs-img-placeholder cs-img--stats">
              <video
                src="/assets/banner-konwersja-strony.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="cs-stats-video"
                aria-hidden
              />
            </div>
          </div>
          <div className="cs-floor__right">
            <div className="cs-img-placeholder cs-img--book">
              <canvas id="book-frames-canvas" aria-hidden />
              <span className="cs-img-fallback">Książka · 1000 × 720</span>
            </div>
          </div>
        </div>

        <div className="cs-divider" />

        <div className="cs-floor cs-floor--texts">
          <div className="cs-floor__left">
            <div className="cs-text-block">
              <h2>
                Rezultaty,
                <br />
                obserwowane
                <br />
                po&nbsp;<strong style={{ fontWeight: 800 }}>10</strong>&nbsp;miesiącach.
              </h2>
              <p>
                Większość przedsiębiorców
                <br />
                obserwuje poprawę, w&nbsp;całym
                <br />
                procesie zdobywania klientów.
              </p>
            </div>
          </div>
          <div className="cs-floor__right">
            <div className="cs-stats-placeholder">
              <div className="cs-counters">
                <div className="cs-counter-row" data-counter-row>
                  <div className="cs-counter-digits" data-counter data-digits="5,3" data-suffix="%" />
                  <div className="cs-counter-suffix" data-suffix-slot />
                  <div className="cs-counter-label">
                    <span className="cs-counter-heading">Więcej zapytań</span>
                    <span className="cs-counter-sub">Pewność ciągłości zamówień</span>
                  </div>
                </div>
                <div className="cs-counter-row" data-counter-row>
                  <div className="cs-counter-digits" data-counter data-digits="3,9" data-suffix="%" />
                  <div className="cs-counter-suffix" data-suffix-slot />
                  <div className="cs-counter-label">
                    <span className="cs-counter-heading">Wzrostu przychodów</span>
                    <span className="cs-counter-sub">Więcej pieniędzy w kieszeni</span>
                  </div>
                </div>
                <div className="cs-counter-row" data-counter-row>
                  <div className="cs-counter-digits" data-counter data-digits="1,0" data-suffix="h" />
                  <div className="cs-counter-suffix" data-suffix-slot />
                  <div className="cs-counter-label">
                    <span className="cs-counter-heading">Odzyskanych tygodniowo</span>
                    <span className="cs-counter-sub">Na tłumaczeniu klientom oferty</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
