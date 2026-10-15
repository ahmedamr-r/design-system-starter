// The demo links ../dist/tokens.css. Vite does not watch its own build folder,
// which is also called dist by default, so its build goes elsewhere and a token
// rebuild shows up in the open demo.
export default {
  build: { outDir: '.vite-build' },
};
