"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { runKinetic } from "./kineticEngine";
import "./kinetic-section.css";

export function KineticSection() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = containerRef.current;
      if (!el) return;
      return runKinetic(el);
    },
    { scope: containerRef }
  );

  return (
    <section id="kinetic-section" ref={containerRef} className="stage stage-pinned">
      <div className="nigdy-glow" id="kinetic-nigdy-glow" />

      <div className="blob-carrier" id="kinetic-blob-carrier">
        <div className="blob-bg-preview" id="kinetic-blob-bg-preview" />
        <div className="blob blob-1" id="kinetic-blob1" />
        <div className="blob blob-2" id="kinetic-blob2" />
        <div className="blob blob-3" id="kinetic-blob3" />
      </div>

      <canvas id="kinetic-tunnel-canvas" />
      <canvas id="kinetic-particle-qmark-canvas" />

      <div className="content-wrapper">
        <div className="text-block" id="kinetic-block-1">
          <div className="line">W internecie</div>
          <div className="line">jest więcej klientów,</div>
          <div style={{ height: "0.72rem" }} />
          <div className="line bold-line line-large">niż Twoja firma jest</div>
          <div className="line bold-line line-large">w stanie obsłużyć.</div>
        </div>

        <div className="text-block" id="kinetic-block-2">
          <div className="line bold-line line-xlarge" id="kinetic-problem-line">
            W czym problem?
          </div>
        </div>

        <div className="text-block" id="kinetic-block-3">
          <div className="small-header">
            Wg badań <span className="highlight">GEMIUS</span>:
          </div>

          <div className="block-3-desktop">
            <div className="line">98% osób, które odwiedzi</div>
            <div className="line">
              stronę polskiej firmy&nbsp;
              <span className="word-anchor">
                <span className="bg-layer">
                  <span className="nigdy-plate" id="kinetic-nigdy-plate" />
                </span>
                <span className="text-layer">
                  <span className="nigdy-text" id="kinetic-word-nigdy">
                    nigdy
                  </span>
                </span>
              </span>
            </div>
            <div className="line bold-line">nie stanie się jej klientami.</div>
          </div>

          <div className="block-3-mobile">
            <div className="line">98% osób,</div>
            <div className="line">które odwiedzi</div>
            <div className="line">stronę polskiej firmy</div>
            <div className="line">
              <span className="word-anchor">
                <span className="bg-layer">
                  <span className="nigdy-plate" id="kinetic-nigdy-plate-mobile" />
                </span>
                <span className="text-layer">
                  <span className="nigdy-text" id="kinetic-word-nigdy-mobile">
                    nigdy
                  </span>
                </span>
              </span>
              &nbsp;<span className="bold-text">nie stanie</span>
            </div>
            <div className="line bold-line">się jej klientami.</div>
          </div>
        </div>
      </div>

      <div id="kinetic-cylinder-wrapper">
        <canvas id="kinetic-cylinder-canvas" />
      </div>
    </section>
  );
}
