import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

// Lexical 0.46 emits two prod bundles with a pure annotation before `return`.
const lexicalReactProdModule =
  /node_modules[\\/]@lexical[\\/]react[\\/]dist[\\/]Lexical(ContentEditable|ErrorBoundary)\.prod\.mjs(?:\?.*)?$/;
const misplacedPureAnnotationBeforeReturn = /\/\*#__PURE__\*\/\s*(?=return\b)/g;

const stripMisplacedLexicalPureAnnotations = (): Plugin => ({
  name: "beep:strip-misplaced-lexical-pure-annotations",
  enforce: "pre",
  transform(code, id) {
    if (!lexicalReactProdModule.test(id)) {
      return null;
    }

    const sanitizedCode = code.replace(misplacedPureAnnotationBeforeReturn, "");

    return sanitizedCode === code ? null : { code: sanitizedCode, map: null };
  },
});

const initialVendorChunkGroups = [
  { name: "react-vendor", test: /node_modules[\\/](react|react-dom)[\\/]/, priority: 50 },
  { name: "mui-vendor", test: /node_modules[\\/](@mui|@emotion)[\\/]/, priority: 45 },
  { name: "effect-vendor", test: /node_modules[\\/]effect[\\/]/, priority: 40 },
  { name: "lexical-vendor", test: /node_modules[\\/](@lexical|lexical)[\\/]/, priority: 35 },
  {
    name: "ui-vendor",
    test: /node_modules[\\/](sonner|tailwind-merge|clsx|class-variance-authority|@base-ui|@phosphor-icons)[\\/]/,
    priority: 30,
  },
];

export default defineConfig({
  clearScreen: false,
  plugins: [stripMisplacedLexicalPureAnnotations(), react()],
  optimizeDeps: {
    // @cosmos.gl/graph imports CJS/UMD deps that need explicit handling:
    // keep cosmos itself un-prebundled, interop-wrap seedrandom, and route
    // gl-bench at its shipped ESM build (the package's `module` field is
    // ignored by the optimizer, which picks the default-less UMD `main`).
    // Oxigraph is a WASM-backed sidecar driver; do not let the web optimizer
    // initialize or prebundle it if a future webview path imports the package.
    exclude: ["@cosmos.gl/graph", "oxigraph"],
    include: ["seedrandom"],
  },
  build: {
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: initialVendorChunkGroups,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "gl-bench": fileURLToPath(new URL("../../node_modules/gl-bench/dist/gl-bench.module.js", import.meta.url)),
    },
  },
  server: {
    port: 1421,
    strictPort: true,
    proxy: {
      // Same-origin rpc: the vite dev server is the single origin, so the
      // webview's `/rpc` calls (see @beep/agents-client Chat.atoms.ts SERVER_URL)
      // ride this proxy to the loopback bun sidecar on :3939 (server/main.ts
      // CHAT_SIDECAR_PORT default). Dev runs the sidecar via `bun run dev:sidecar`.
      "/rpc": {
        target: "http://127.0.0.1:3939",
        changeOrigin: true,
      },
      // Same-origin OTLP for the webview's effect-native exporter (the client
      // observability global layer in @beep/agents-client). Vite proxies it to
      // the standard OTel collector so the browser needs no CORS setup; without
      // a collector listening the export just fails silently.
      "/otlp": {
        target: "http://localhost:4318",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/otlp/, ""),
      },
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
});
