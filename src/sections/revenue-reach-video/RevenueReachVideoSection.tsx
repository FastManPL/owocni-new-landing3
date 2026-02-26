"use client";

import { useRef, useEffect } from "react";
import "./revenue-reach-video-section.css";

const VIDEO_SRC = "/assets/banner-konwersja-strony.mp4";

export function RevenueReachVideoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;

    const io = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (!e) return;
        if (e.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
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
              <video
                ref={videoRef}
                src={VIDEO_SRC}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
