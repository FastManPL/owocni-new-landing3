# Owocni — Landing Page

Landing page zgodna z **Konstytucją v2.5** (Next.js App Router, React 19, Tailwind, GSAP, Lenis).

## Wymagania

- Node.js 20+
- npm / yarn / pnpm

## Rozwój

```bash
npm install
npm run dev
```

Aplikacja: [http://localhost:3000](http://localhost:3000). Build: `npm run build`.

## Wdrożenie (Vercel + GitHub)

1. **Repozytorium GitHub**  
   Zainicjuj git i wypchnij kod:
   ```bash
   git init
   git add .
   git commit -m "Initial: Next.js + hero section"
   git remote add origin https://github.com/TWOJ_ORG/owocni-landing.git
   git push -u origin main
   ```

2. **Vercel**  
   - [vercel.com](https://vercel.com) → **Add New Project** → zaimportuj repozytorium.  
   - Framework: **Next.js** (wykryty automatycznie).  
   - Root Directory: `.` (domyślnie).  
   - Build Command: `npm run build` (domyślne).  
   - Deploy.

Kolejne pushy na `main` będą automatycznie budować i wdrażać projekt.

## Struktura (Konstytucja)

- `src/app/` — layout, page (DCI), loading, globals.css  
- `src/sections/hero/` — pierwsza sekcja (HeroSection, CSS, manifest)  
- `src/lib/` — scrollRuntime, autoTier (moduleLoader przy kolejnych sekcjach)  
- `src/config/variants.ts` — warianty DCI (server-only)  
- `src/components/` — SmoothScrollProvider  

Wytyczne: `CONSTITUTION_v2.5.md`, `cursorrules.txt`.

## Opcjonalnie: React Compiler (annotation)

Konstytucja zaleca `reactCompiler: { compilationMode: 'annotation' }`. Aby włączyć:

```bash
npm i -D babel-plugin-react-compiler
```

W `next.config.ts` odkomentuj:

```ts
experimental: {
  reactCompiler: { compilationMode: "annotation" },
},
```
