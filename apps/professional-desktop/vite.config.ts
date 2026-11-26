import * as NodeURL from "node:url";
import react from "@vitejs/plugin-react";
import * as Str from "effect/String";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

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

    const sanitizedCode = Str.replace(misplacedPureAnnotationBeforeReturn, "")(code);

    return sanitizedCode === code ? null : { code: sanitizedCode, map: null };
  },
});

// fallow-ignore-next-line code-duplication -- the `.ts`-to-`.tsx` resolver is copied into both Vite composition roots (Storybook is the other). Owner: @beep/professional-desktop. Exit: import it from a shared Vite tooling module once one exists, or delete when Vite applies the TypeScript source fallback.
const resolveUniformTypeScriptSourceSpecifiers = (): Plugin => ({
  name: "beep:resolve-uniform-typescript-source-specifiers",
  enforce: "pre",
  resolveId(source, importer, options) {
    if (importer === undefined || !Str.startsWith(".")(source) || !Str.endsWith(".ts")(source)) {
      return null;
    }

    return this.resolve(source, importer, { ...options, skipSelf: true }).then((exactSource) =>
      exactSource === null
        ? this.resolve(Str.replace(/\.ts$/, ".tsx")(source), importer, { ...options, skipSelf: true })
        : exactSource
    );
  },
});

const htmlFamilySplitsUnder750kB = [
  {
    name: "html-schema-model",
    test: /packages[\\/]foundation[\\/]modeling[\\/]html[\\/]src[\\/]Html\.model\.ts$/,
    priority: 34,
  },
  {
    name: "html-metadata",
    test: /packages[\\/]foundation[\\/]modeling[\\/]html[\\/]src[\\/](?:Html\.meta|internal[\\/]Html\.language-tag-registry\.generated)\.ts$/,
    priority: 34,
  },
];

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
  {
    name: "storage-vendor",
    test: /(?:node_modules[\\/]drizzle-orm[\\/]|packages[\\/]ecosystem[\\/]effect-drizzle[\\/])/,
    priority: 34,
  },
  ...htmlFamilySplitsUnder750kB,
  {
    name: "html-modeling",
    test: /packages[\\/]foundation[\\/]modeling[\\/]html[\\/]/,
    priority: 33,
  },
  {
    name: "rich-text-modeling",
    test: /packages[\\/]foundation[\\/]modeling[\\/](lexical|md)[\\/]/,
    priority: 33,
  },
  {
    name: "editor-workspace",
    test: /packages[\\/]foundation[\\/]ui-system[\\/]editor[\\/]/,
    priority: 32,
  },
  {
    name: "dock-workspace",
    test: /packages[\\/]foundation[\\/]ui-system[\\/](dock|dock-react)[\\/]/,
    priority: 31,
  },
  { name: "pretext-vendor", test: /node_modules[\\/]@chenglou[\\/]pretext[\\/]/, priority: 25 },
];

// decision: vite-dependency-resolution-overrides
const optimizeDeps = {
  exclude: ["@cosmos.gl/graph", "oxigraph", "effect/schema"],
  include: ["seedrandom", "three", "three/addons/controls/TrackballControls.js"],
};

// decision: vite-dependency-resolution-overrides
const domFreeDecodeNamedCharacterReference = NodeURL.fileURLToPath(
  import.meta.resolve("decode-named-character-reference")
);
const aboveMermaidElkModuleKb = 1_500;
const sidecarLoopbackOrigin = "http://127.0.0.1:3939";
const otelCollectorOrigin = "http://localhost:4318";
const inotifyHeavyCargoTarget = "**/src-tauri/target/**";

export default defineConfig({
  clearScreen: false,
  plugins: [resolveUniformTypeScriptSourceSpecifiers(), stripMisplacedLexicalPureAnnotations(), react()],
  optimizeDeps,
  build: {
    chunkSizeWarningLimit: aboveMermaidElkModuleKb,
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
      "@": NodeURL.fileURLToPath(new URL("./src", import.meta.url)),
      "decode-named-character-reference": domFreeDecodeNamedCharacterReference,
    },
  },
  server: {
    proxy: {
      "/rpc": {
        target: sidecarLoopbackOrigin,
        changeOrigin: true,
      },
      "/vault-sync": {
        target: sidecarLoopbackOrigin,
        changeOrigin: true,
      },
      "/otlp": {
        target: otelCollectorOrigin,
        changeOrigin: true,
        rewrite: (path) => Str.replace(/^\/otlp/, "")(path),
      },
    },
    watch: {
      ignored: [inotifyHeavyCargoTarget],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
});
