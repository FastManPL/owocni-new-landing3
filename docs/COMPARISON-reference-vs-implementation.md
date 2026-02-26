# Porównanie: referencje HTML vs implementacja (adwokat diabła)

## book-stats-section (9).html vs BookStatsSection + bookStatsEngine

### Różnice w działaniu / renderowaniu

| Aspekt | Referencja (9).html | Implementacja | Status |
|--------|---------------------|--------------|--------|
| **Sentry – wczesny preload klatek** | `#book-frames-sentry` obserwowany przez IO z `rootMargin: '1000px 0px 1000px 0px'` — preload startuje gdy użytkownik jest ~1000px od sekcji. | Sentry używany w silniku: IO z `rootMargin: '1000px 0px 1000px 0px'` startuje `startPreload()`; bez sentry preload od razu. | **Wdrożone** |
| **Typ B: pause / resume** | `init()` zwraca `{ kill, pause, resume }`. `pause()` wywołuje `sectionST.disable()`, `resume()` — `sectionST.enable()`. | Silnik zwraca `{ kill, pause, resume }`; BookStatsSection używa `result.kill()` jako cleanup. | **Wdrożone** |
| **ScrollTrigger.config** | W `createScrollAnimation()`: `ScrollTrigger.config({ ignoreMobileResize: true })`. | GSAP rejestrowany w silniku, ale **config nie jest wywoływany w book-stats** (jest w `scrollRuntime.ts` globalnie — OK). | **OK** (globalnie w scrollRuntime). |
| **Lewa kolumna (stats)** | Placeholder tekst „Statystyki · 606 × 456”. | **Video** `banner-konwersja-strony.mp4` — celowa zmiana (zgodnie z życzeniem). | Celowa zmiana. |
| **Klatki książki** | Placeholdery generowane w JS lub production: `frame-001.webp` z BASE_URL. | Prawdziwe pliki z `/Ksiazka-Klatki/`, AVIF + WEBP, ta sama logika animacji. | **OK**. |
| **EAGER BUILD liczników** | Liczniki budowane od razu w init (`wrappers.forEach(buildCounter)`), IO tylko ustawia `ready` i dodaje `.visible` z opóźnieniem (i * 180 ms). | To samo — buildCounter od razu, IO dla `.visible`. | **OK**. |
| **Fallback aspect-ratio** | `@supports not (aspect-ratio: 1/1)` z `height: 0; padding-bottom: 75.25%` / `72%`. | Jest w `book-stats-section.css`. | **OK**. |
| **container-type / cqi** | `.cs-stats-placeholder`: `container-type: inline-size`, `contain-intrinsic-size: auto 30rem`. | To samo. | **OK**. |
| **Padding cyfr** | `.cs-counter-digits`: `padding-top: 0.725em`. | W CSS jest `0.725em`. | **OK** (reference ma 0.725em w jednym miejscu – sprawdzić dokładnie). |

### Podsumowanie book-stats

- **Wdrożone:**  
  1) **Sentry** — w silniku IO na `#book-frames-sentry` z `rootMargin: '1000px 0px 1000px 0px'`; przy wejściu wywołanie `startPreload()`.  
  2) **Typ B** — silnik zwraca `{ kill, pause, resume }`; sekcja używa `kill` jako cleanup. Pause/resume można podpiąć pod scrollRuntime przy „wrapowaniu”.

---

## hero-phase3-standardize (4).html vs HeroSection + hero-section.css

### Różnice w działaniu / renderowaniu

| Aspekt | Referencja (4).html | Implementacja | Status |
|--------|---------------------|---------------|--------|
| **HAAT – osobne tiery H1 i opisu** | Osobne konfiguracje: H1 (tierL: 35, tierM: 75, monsterWord: 14), Description (tierL: 150, tierM: 220, monsterWord: 18). Na `<html>` ustawiane **dwa** atrybuty: `data-h1-tier` i `data-desc-tier`. | **Jeden** tier z `autoTier(variant.h1)` używany dla **obu**: `data-h1-tier` i `data-desc-tier`. Opis (sub) **nie** ma własnego tieru; brak logiki „monster word”. | **Brak** – wspólny tier, brak osobnego tieru opisu i monster word. |
| **HAAT – client-side correction** | Po renderze: `countLines()` na H1 i desc; na desktop jeśli H1 > 2 linii lub desc > 3 linii — **degradacja tieru w dół** (L→M→S); `useLayoutEffect`, przed paintem. | **Brak** – brak `useLayoutEffect`, brak liczenia linii i degradacji. Tylko server-side tier z autoTier. | **Brak** – możliwe przepełnienie 2/3 linii na desktop. |
| **HAAT – normalizacja tekstu** | Przed obliczeniem tieru: `normalizeText` (usunięcie `<br>`, wielokrotnych spacji). | `autoTier` tylko `replace(/\s+/g, ' ').trim()` — **brak** usuwania `<br>`. | Różnica przy treści z `<br>`. |
| **Struktura / klasy** | `.hero-content`, `.blob-mask`, `.hero-title-wrapper`, laury Lottie, `.hero-description`, marquee, `.action-area`, badge’y, CTA, brain tooltip, royal canvas. | Odpowiednie elementy i klasy (blob-mask, hero-title-wrapper, hero-description, action-area, badge’y, CTA, brain tooltip, royal canvas). | Do weryfikacji wizualnej. |
| **Zmienne CSS / breakpointy** | Długi zestaw `--*` i media (601px, 1200px, 1300px, 1450px, 1600px, 600px, 350px itd.). | hero-section.css zawiera zmienne i media. | Do porównania breakpoint po breakpoint. |
| **Animacja gradientu / burst** | DOWNFALL (color-mix) + PREMIUM (oklch, `.fx-premium`). Keyframes `hero-gradient-expand`, `hero-zen-flow-dynamic`. | `.startup-gradient`, `.burst-container`, `.fx-premium`, keyframes w CSS. | Do weryfikacji wizualnej. |
| **Mobile – bg-cutoff** | Na ≤600px: `--bg-cutoff` ustawiane przez JS (dolna krawędź hero-content); `.gradient-perf-wrapper` i `::after` używają `var(--bg-cutoff, 60%)`. | Sprawdzić czy heroEngine ustawia `--bg-cutoff` na sekcji i czy CSS go używa. | **Do sprawdzenia.** |
| **Logo / content lift** | `--content-lift`, `--logo-height`, `--center-padding-top`, skomplikowany `transform: translateY(clamp(...))` na logo. | Zmienne i clamp w CSS. | Do weryfikacji wizualnej. |

### Podsumowanie hero

- **Do wdrożenia:**  
  1) **HAAT w pełni:** osobny tier dla opisu (np. `autoTierDesc(sub)` z progiem 150/220 i monster word 18), osobne `data-h1-tier` i `data-desc-tier`.  
  2) **Monster word w autoTier:** słowo ≥14 znaków (H1) / ≥18 (desc) wymusza degradację (M lub S).  
  3) **Client-side correction:** `useLayoutEffect` – liczba linii H1/desc na desktop; jeśli H1 > 2 lub desc > 3 — degradacja tieru w dół i aktualizacja atrybutów na `<html>`.  
  4) **Normalizacja:** przed tierem usuwać `<br>` (np. `replace(/<br\s*\/?>/gi, ' ')`).  
  5) **Mobile --bg-cutoff:** jeśli w referencji JS ustawia `--bg-cutoff` na podstawie pozycji hero-content, to samo w heroEngine + odpowiednie użycie w CSS.

---

## Szybka checklista napraw

- [x] **book-stats:** Sentry IO z rootMargin 1000px do startu preload klatek.  
- [x] **book-stats:** Zwracać z runBookStats `{ kill, pause, resume }` i podpiąć pause/resume pod scrollRuntime (Typ B).  
- [ ] **hero:** Osobne tiery H1 vs desc + monster word w autoTier / osobnej funkcji.  
- [ ] **hero:** Client-side correction (useLayoutEffect, countLines, degradacja).  
- [ ] **hero:** Normalizacja tekstu (usunięcie `<br>`) przed obliczeniem tieru.  
- [ ] **hero:** Sprawdzenie ustawiania `--bg-cutoff` na mobile i użycia w CSS.
