/* C2: window.__scroll wyłącznie do debug — produkcyjny kod NIGDY nie czyta */
declare global {
  interface Window {
    __scroll?: import("lenis").default;
  }
}
export {};
