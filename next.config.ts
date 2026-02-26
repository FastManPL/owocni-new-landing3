import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Konstytucja: reactCompiler annotation (wymaga: npm i -D babel-plugin-react-compiler).
  // experimental: { reactCompiler: { compilationMode: "annotation" } },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  transpilePackages: ["gsap", "lenis"],
};

export default nextConfig;
