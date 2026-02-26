"use client";

import { useEffect } from "react";
import { scrollRuntime } from "@/lib/scrollRuntime";

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    scrollRuntime.init();
    return () => scrollRuntime.kill();
  }, []);
  return <>{children}</>;
}
