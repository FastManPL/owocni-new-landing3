"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { runBlok45 } from "./blok45Engine";
import "./blok45-section.css";

export function Blok45Section() {
  const sectionRef = useRef<HTMLElement>(null);
  const waveWrapRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const sectionEl = sectionRef.current;
      const waveWrapEl = waveWrapRef.current;
      if (!sectionEl || !waveWrapEl) return;
      return runBlok45(sectionEl, waveWrapEl);
    },
    { scope: sectionRef }
  );

  return (
    <>
      <div id="blok-4-5-wave-wrap" ref={waveWrapRef}>
        <svg id="blok-4-5-wave-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="wave-path" />
          <path className="wave-path" />
          <path className="wave-path" />
          <path className="wave-path" />
        </svg>
      </div>

      <section id="blok-4-5-section" ref={sectionRef}>
        <canvas id="blok-4-5-sparksCanvas" />
        <div id="blok-4-5-bubble-layer" />
        <div className="morph-ghost" id="blok-4-5-morphGhost" />
        <canvas id="blok-4-5-burstCanvas" />

        <div className="overlay" id="blok-4-5-popupOverlay">
          <div className="popup-wrapper">
            <button className="close" id="blok-4-5-popupClose" aria-label="Zamknij">
              ✕
            </button>
            <section className="popup" id="blok-4-5-popup">
              <div className="popup-inner">
                <div className="burst-bg">
                  <div className="burst-container">
                    <div className="burst-ripple burst-ripple--1" />
                    <div className="burst-ripple burst-ripple--2" />
                    <div className="burst-ripple burst-ripple--3" />
                    <div className="burst-ripple burst-ripple--4" />
                  </div>
                </div>
                <div className="content">
                  <div className="hero">
                    <div className="heading">
                      <span className="heading-light">Zatrzymuj klientów na owocnej stronie</span>
                      <span className="heading-bold">z dobrą promocją!</span>
                    </div>
                    <p className="subtitle">Odbierz swój kod — możesz odsłonić jeden.</p>
                  </div>
                  <div className="divider">
                    <span className="divider-diamond">◆</span>
                  </div>
                  <div className="tiles">
                    <div className="tile-wrap" data-tile="1">
                      <div className="tile-glow" />
                      <div className="tile-conic" />
                      <article className="tile">
                        <div className="tile-label">Konkretny rabat</div>
                        <div className="tile-desc">Obniżamy końcową fakturę o kwotę.</div>
                        <div className="tile-bottom">
                          <div className="tile-value">750 zł</div>
                          <button className="popup-btn" data-reveal="1">
                            Zobacz kod
                          </button>
                          <div className="codebox">
                            Przy wycenie podaj kod: <span>"Zostają 750"</span>
                          </div>
                        </div>
                      </article>
                    </div>
                    <div className="tile-wrap" data-tile="2">
                      <div className="tile-glow" />
                      <div className="tile-conic" />
                      <article className="tile">
                        <div className="tile-label">SOCIAL MEDIA PACK</div>
                        <div className="tile-desc">Profile firmowe — spójne z nową stroną.</div>
                        <div className="tile-bottom">
                          <div className="tile-value">"WOW!"</div>
                          <button className="popup-btn" data-reveal="2">
                            Zobacz kod
                          </button>
                          <div className="codebox">
                            Przy wycenie podaj kod: <span>"Zostają sociale"</span>
                          </div>
                        </div>
                      </article>
                    </div>
                  </div>
                  <div className="bottom-close">
                    <button className="bottom-close-btn" id="blok-4-5-popupBottomClose">
                      <span className="x-icon">✕</span> Zamknij
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div id="blok-4-5-block-4">
          <div className="illustration-container">
            <div className="text-above-illustration">
              <div className="blok45-intro-line1">Potencjalni klienci</div>
              <div className="blok45-intro-line2" id="blok-4-5-ludzie-wchodza">
                wchodzą na stronę
              </div>
              <div className="blok45-intro-line3">rozglądają się...</div>
            </div>

            <div className="text-on-illustration-top">
              <div className="void-section-wrapper" id="blok-4-5-voidSectionWrapper">
                <div className="void-section" id="blok-4-5-voidSection">
                  <span id="blok-4-5-anchorChar" style={{ fontWeight: 700 }}>
                    i&nbsp;
                  </span>
                  <span id="blok-4-5-walkingContainer" className="walking-text-container" />
                  <div id="blok-4-5-iHeatWrapper">
                    <canvas id="blok-4-5-iHeatCanvas" />
                  </div>
                </div>
              </div>
            </div>

            <div className="full-width-image">
              <picture>
                <source media="(max-width: 599px)" srcSet="Ludzie-Small.avif" type="image/avif" />
                <source media="(max-width: 599px)" srcSet="Ludzie-Small.webp" type="image/webp" />
                <source media="(min-width: 600px)" srcSet="Ludzie.avif" type="image/avif" />
                <source media="(min-width: 600px)" srcSet="Ludzie.webp" type="image/webp" />
                <img src="Ludzie.webp" alt="Ilustracja - ludzie" loading="lazy" />
              </picture>
            </div>

            <div className="text-on-illustration-bottom" id="blok-4-5-mozemy-to-zmienic">
              <h2 className="line hero-h1" style={{ flexDirection: "column" }}>
                <span>Możemy</span>
                <span>
                  to{" "}
                  <span className="highlight-container">
                    <span className="gradient-text-reveal" id="blok-4-5-zmienicText">
                      zmienić
                    </span>
                    <div className="highlight-svg-box" id="blok-4-5-ellipseBox">
                      <svg viewBox="0 0 400 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                        <path
                          d="M15,25 Q200,85 385,25"
                          stroke="#1a1a1a"
                          strokeWidth="18"
                          fill="none"
                          className="draw-anim"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </span>
                </span>
              </h2>
            </div>
          </div>

          <div style={{ height: "clamp(2rem, 6vw, 6rem)" }} />

          <div id="blok-4-5-block-5-content">
            <div className="line line-small body-copy-block">
              Tworzymy strony zdolne zamieniać odwiedzających w prawdziwych, <span className="bold-line">płacących klientów.</span>
            </div>
            <div style={{ height: "clamp(1rem, 3vw, 3rem)" }} />
            <div className="line line-small">Ta zdolność to</div>
            <div style={{ height: "clamp(0.5rem, 1.5vw, 1.5rem)" }} />
            <div className="konwersja-wrap">
              <div className="glow" id="blok-4-5-glow" />
              <div className="button-wrap" id="blok-4-5-btnWrap">
                <button id="blok-4-5-btn">
                  <span>Konwersja!</span>
                </button>
                <div className="button-shadow" />
              </div>
            </div>
            <div style={{ height: "clamp(0.5rem, 1.5vw, 1.5rem)" }} />
            <div className="line line-small">
              Czyli <span className="bold-line" style={{ marginLeft: "0.2em" }}>realne pieniądze.</span>
            </div>
            <div style={{ height: "clamp(4.2rem, 12.6vw, 12.6rem)" }} />
            <h2
              className="line hero-h1 body-copy-block"
              id="blok-4-5-zobaczH1"
              style={{
                color: "#252030",
                backgroundImage: "linear-gradient(135deg, #252030 2%, #2a2130 44%, #382630 56.7%, #512b2b 67.5%, #7d3527 80.2%, #7d3527 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              <span style={{ fontWeight: 700 }}>Zobacz ile pieniędzy odzyskasz</span>
              <br className="br-desktop-only" /> <span style={{ fontWeight: 200 }}>po naprawie konwersji strony</span>
            </h2>
          </div>
        </div>

        <div className="mana-container" id="blok-4-5-manaContainer">
          <div className="mana-progress">
            <div className="mana-bar" id="blok-4-5-manaBar" />
          </div>
        </div>

        <div id="blok-4-5-stars-canvas" />
        <div id="blok-4-5-res-debug" />
      </section>
    </>
  );
}
