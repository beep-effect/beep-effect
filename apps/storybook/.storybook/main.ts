import * as NodeModule from "node:module";
import * as NodeURL from "node:url";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { mergeConfig } from "vite";
import type { StorybookConfig } from "@storybook/react-vite";
import type { Plugin, ServerOptions } from "vite";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const require = NodeModule.createRequire(import.meta.url);
const epistemicStories = NodeURL.fileURLToPath(
  new URL("./stories/**/*.stories.@(ts|tsx)", NodeURL.pathToFileURL(require.resolve("@beep/epistemic-ui/package.json")))
);
const portlessConfig = Effect.runSync(
  Config.all({
    mode: Config.String("PORTLESS").pipe(Config.withDefault("1")),
    url: Config.URL("PORTLESS_URL").pipe(Config.option),
  })
);
const proxyHmr = O.map(portlessConfig.mode === "0" ? O.none() : portlessConfig.url, (url): ServerOptions["hmr"] => {
  const protocol = url.protocol === "https:" ? "wss" : "ws";
  return {
    protocol,
    host: url.hostname,
    clientPort: Number(url.port || { ws: 80, wss: 443 }[protocol]),
  };
});

// fallow-ignore-next-line code-duplication -- the Lexical prod-module strip plugin is copied into both Vite composition roots (professional-desktop is the other). Owner: @beep/storybook. Exit: import it from a shared Vite tooling module once one exists, or delete when Lexical ships fixed pure annotations.
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

// fallow-ignore-next-line code-duplication -- the `.ts`-to-`.tsx` resolver is copied into both Vite composition roots (professional-desktop is the other). Owner: @beep/storybook. Exit: import it from a shared Vite tooling module once one exists, or delete when Vite applies the TypeScript source fallback.
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

const mermaidChunkWarningKb = 1_500;

// decision: static-brand-manager
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: [
    epistemicStories,
    "../../../packages/foundation/ui-system/*/stories/**/*.stories.@(ts|tsx)",
    "../../../packages/drivers/graph-3d/stories/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-themes", "@storybook/addon-vitest"],
  staticDirs: [
    { from: "../../../node_modules/emojibase-data", to: "/emojibase-data" },
    { from: "../../../packages/foundation/ui-system/brand/assets", to: "/brand" },
  ],
  managerHead: (head) => `${head}<link rel="icon" type="image/svg+xml" href="./brand/favicon.svg" />`,
  previewHead: (head) =>
    `${head}<style>html,body,#storybook-root,#storybook-docs{background:oklch(0.145 0 0);color-scheme:dark}.sb-loader{border-color:oklch(0.708 0 0);border-top-color:transparent}</style><script>globalThis.process ??= { env: { NODE_ENV: "development" }, platform: "browser", arch: "browser" };</script>`,
  viteFinal(config) {
    const defaults = {
      // decision: eager-browser-dependencies
      optimizeDeps: {
        include: [
          "effect/Number",
          "effect/Utils",
          "effect/encoding/Hex",
          "effect/http/FetchHttpClient",
          "effect/reactivity/AsyncResult",
          "effect/reactivity/Atom",
          "effect/reactivity/AtomRegistry",
          "effect/reactivity/AtomRpc",
          "effect/reactivity/Reactivity",
          "effect/rpc/Rpc",
          "effect/rpc/RpcClient",
          "effect/rpc/RpcGroup",
          "effect/rpc/RpcSerialization",
          "effect/schema/Model",
        ],
      },
      resolve: { dedupe: ["react", "react-dom"] },
      plugins: [resolveUniformTypeScriptSourceSpecifiers(), stripMisplacedLexicalPureAnnotations()],
      server: { fs: { allow: [repoRoot] } },
    };
    const merged = mergeConfig(defaults, config);
    merged.resolve.dedupe = A.dedupe(merged.resolve.dedupe);
    merged.server.fs.allow = A.dedupe(merged.server.fs.allow);

    return mergeConfig(merged, {
      build: {
        chunkSizeWarningLimit: mermaidChunkWarningKb,
        rolldownOptions: {
          checks: { moduleLevelDirective: false },
        },
      },
      server: { hmr: merged.server.hmr === false ? false : O.getOrUndefined(proxyHmr) },
    });
  },
};

export default config;
