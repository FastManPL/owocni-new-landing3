"use client";

import { useRef, useEffect } from "react";
import "./revenue-reach-video-section.css";

const VIDEO_SRC = "/assets/header/tworzenie-stron-mini.mp4";
const BG_IMAGE_SRC = "/assets/dfgsrebern.jpg";

export function RevenueReachVideoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoMobileRef = useRef<HTMLVideoElement>(null);
  const videoDesktopRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const mobile = videoMobileRef.current;
    const desktop = videoDesktopRef.current;
    if (!section) return;

    const io = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (!e) return;
        const play = e.isIntersecting;
        [mobile, desktop].forEach((v) => {
          if (!v) return;
          if (play) v.play().catch(() => {});
          else v.pause();
        });
      },
      { threshold: 0.25 }
    );
    io.observe(section);
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="revenue-reach-video-section"
      ref={sectionRef}
      className="rrv-section"
      style={{ isolation: "isolate" }}
    >
      <div className="rrv-bg-strip" aria-hidden />
      <div className="rrv-wrap">
        <div className="rrv-card">
          <div className="rrv-inner">
            <div className="rrv-content">
              <p className="rrv-headline">
                W zasięgu ręki masz
                <br /> już <strong>35–45% więcej</strong>
                <br /> przychodów.
              </p>
              <p className="rrv-sub">Czas je odzyskać</p>
              <div className="rrv-cta-wrap">
                <a href="#wycena" className="rrv-cta active:scale-[0.97] transition-transform duration-75">
                  Zobacz demo
                </a>
              </div>
              <p className="rrv-note">
                Dane: Testy reklamowe klientów za 2025r. łączny budżet <strong>3,5 mln zł</strong>.
              </p>
            </div>
            <div className="rrv-video-wrap">
              <img
                src={BG_IMAGE_SRC}
                alt=""
                className="rrv-bg-img"
                loading="lazy"
              />
              <div className="rrv-video-mobile">
                <video
                  ref={videoMobileRef}
                  src={VIDEO_SRC}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  className="rrv-video-el"
                />
              </div>
              <div className="rrv-video-desktop">
                <video
                  ref={videoDesktopRef}
                  src={VIDEO_SRC}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  className="rrv-video-el"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
