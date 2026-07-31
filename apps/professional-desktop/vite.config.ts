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

// Vite treats an explicit `.ts` suffix as an exact filename, while the repository
// convention intentionally uses `.ts` specifiers for both `.ts` and `.tsx` sources.
// fallow-ignore-next-line code-duplication -- composition-root plugin mirrors Storybook's .ts-to-.tsx resolver by design
const resolveUniformTypeScriptSourceSpecifiers = (): Plugin => ({
  name: "beep:resolve-uniform-typescript-source-specifiers",
  enforce: "pre",
  resolveId(source, importer, options) {
    if (importer === undefined || !source.startsWith(".") || !source.endsWith(".ts")) {
      return null;
    }

    return this.resolve(source, importer, { ...options, skipSelf: true }).then((exactSource) =>
      exactSource === null
        ? this.resolve(source.replace(/\.ts$/, ".tsx"), importer, { ...options, skipSelf: true })
        : exactSource
    );
  },
});

const initialChunkGroups = [
  {
    name: "iana-media-types",
    test: /packages[\\/]foundation[\\/]primitive[\\/]data[\\/]src[\\/]generated[\\/]iana-media-types\.ts$/,
    priority: 60,
  },
  { name: "react-vendor", test: /node_modules[\\/](react|react-dom)[\\/]/, priority: 50 },
  { name: "mui-vendor", test: /node_modules[\\/](@mui|@emotion)[\\/]/, priority: 45 },
  { name: "effect-vendor", test: /node_modules[\\/]effect[\\/]/, priority: 40 },
  { name: "lexical-vendor", test: /node_modules[\\/](@lexical|lexical)[\\/]/, priority: 35 },
  {
    name: "ui-vendor",
    test: /node_modules[\\/](sonner|tailwind-merge|clsx|class-variance-authority|@base-ui|@phosphor-icons)[\\/]/,
    priority: 30,
  },
  { name: "pretext-vendor", test: /node_modules[\\/]@chenglou[\\/]pretext[\\/]/, priority: 25 },
];

export default defineConfig({
  clearScreen: false,
  plugins: [resolveUniformTypeScriptSourceSpecifiers(), stripMisplacedLexicalPureAnnotations(), react()],
  optimizeDeps: {
    // @cosmos.gl/graph imports CJS/UMD deps that need explicit handling:
    // keep cosmos itself un-prebundled, interop-wrap seedrandom, and route
    // gl-bench at its shipped ESM build (the package's `module` field is
    // ignored by the optimizer, which picks the default-less UMD `main`).
    // Oxigraph is a WASM-backed sidecar driver; do not let the web optimizer
    // initialize or prebundle it if a future webview path imports the package.
    exclude: ["@cosmos.gl/graph", "oxigraph"],
    // three is only reached through @beep/graph-3d's lazy import on the first
    // 3D-toggle; without pre-bundling, Vite discovers it mid-session,
    // re-optimizes, and the stale hashed chunk URL 404s ("Failed to fetch
    // dynamically imported module: .../.vite/deps/three.js").
    include: ["seedrandom", "three", "three/addons/controls/TrackballControls.js"],
  },
  build: {
    // Three.js and Mermaid's generated parser each ship as one irreducible
    // upstream module. Keep the cap just above those modules while splitting
    // our generated IANA data out of the application entry chunk below.
    chunkSizeWarningLimit: 750,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: initialChunkGroups,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "gl-bench": fileURLToPath(new URL("../../node_modules/gl-bench/dist/gl-bench.module.js", import.meta.url)),
      // micromark dependency whose `browser` build calls document.createElement
      // at module top level — a ReferenceError if any barrel leaks it into a
      // module worker (vite resolves workers with browser conditions). The
      // default build is DOM-free and behaves identically on the main thread.
      "decode-named-character-reference": fileURLToPath(
        new URL("../../node_modules/decode-named-character-reference/index.js", import.meta.url)
      ),
    },
  },
  server: {
    // Port and strictPort come from the portless-wrapped `dev` script
    // (`--port "${PORT:-1421}" --strictPort`): portless assigns PORT for the
    // named route, and the 1421 fallback keeps the PORTLESS=0 diagnostic
    // bypass on the port tauri and the ontology MCP allowlist already accept.
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
    // Cargo can materialize tens of thousands of generated files under target.
    // They never affect the web bundle and exhausting inotify there prevents the
    // canonical portless dev server from starting.
    watch: {
      ignored: ["**/src-tauri/target/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
});
