import { Effect } from "effect";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as O from "effect/Option";
import { mergeConfig } from "vite";
import type { StorybookConfig } from "@storybook/react-vite";
import type { Plugin, ServerOptions } from "vite";

const repoRoot = new URL("../../..", import.meta.url).pathname;
const portlessConfig = Effect.runSync(
  Config.all({
    mode: Config.string("PORTLESS").pipe(Config.withDefault("1")),
    url: Config.url("PORTLESS_URL").pipe(Config.option),
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

// Lexical 0.46 emits two prod bundles with a pure annotation before `return`.
// The strip plugin is deliberately copied into each Vite composition root
// (professional-desktop vite.config.ts is the other); a shared tooling package
// for a two-site workaround is out of this packet's scope.
// fallow-ignore-next-line code-duplication -- composition-root workaround mirrors professional-desktop's Lexical plugin
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
// fallow-ignore-next-line code-duplication -- composition-root resolver mirrors professional-desktop's Vite plugin
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

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: [
    "../../../packages/foundation/ui-system/*/stories/**/*.stories.@(ts|tsx)",
    // graph-3d driver stories (goal graph-3d-view): the storybook app is a
    // composition root, so hosting driver stories keeps slice `ui` clean of
    // driver imports.
    "../../../packages/drivers/graph-3d/stories/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-themes", "@storybook/addon-vitest"],
  staticDirs: [
    { from: "../../../node_modules/emojibase-data", to: "/emojibase-data" },
    // beep brand assets (favicon, wordmark) for the manager chrome; see manager.ts. Served as
    // static files on purpose: the manager bundle must not import @beep/brand (effect/Schema).
    { from: "../../../packages/foundation/ui-system/brand/assets", to: "/brand" },
  ],
  managerHead: (head) => `${head}<link rel="icon" type="image/svg+xml" href="./brand/favicon.svg" />`,
  previewHead: (head) =>
    `${head}<style>html,body,#storybook-root,#storybook-docs{background:oklch(0.145 0 0);color-scheme:dark}.sb-loader{border-color:oklch(0.708 0 0);border-top-color:transparent}</style><script>globalThis.process ??= { env: { NODE_ENV: "development" }, platform: "browser", arch: "browser" };</script>`,
  viteFinal(config) {
    const defaults = {
      resolve: { dedupe: ["react", "react-dom"] },
      plugins: [resolveUniformTypeScriptSourceSpecifiers(), stripMisplacedLexicalPureAnnotations()],
      server: { fs: { allow: [repoRoot] } },
    };
    const merged = mergeConfig(defaults, config);
    merged.resolve.dedupe = A.dedupe(merged.resolve.dedupe);
    merged.server.fs.allow = A.dedupe(merged.server.fs.allow);

    return mergeConfig(merged, {
      build: { chunkSizeWarningLimit: 1_250 },
      server: { hmr: merged.server.hmr === false ? false : O.getOrUndefined(proxyHmr) },
    });
  },
};

export default config;
