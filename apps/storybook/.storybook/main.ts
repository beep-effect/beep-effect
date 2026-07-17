import type { StorybookConfig } from "@storybook/react-vite";
import type { Plugin } from "vite";

const repoRoot = new URL("../../..", import.meta.url).pathname;

// Lexical 0.46 emits two prod bundles with a pure annotation before `return`.
// The strip plugin is deliberately copied into each Vite composition root
// (professional-desktop vite.config.ts is the other); a shared tooling package
// for a two-site workaround is out of this packet's scope.
// fallow-ignore-next-line code-duplication
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
  staticDirs: [{ from: "../../../node_modules/emojibase-data", to: "/emojibase-data" }],
  viteFinal(config) {
    const dedupe = Array.from(new Set(["react", "react-dom", ...(config.resolve?.dedupe ?? [])]));
    const fsAllow = Array.from(new Set([repoRoot, ...(config.server?.fs?.allow ?? [])]));

    return {
      ...config,
      resolve: {
        ...config.resolve,
        dedupe,
      },
      plugins: [stripMisplacedLexicalPureAnnotations(), ...(config.plugins ?? [])],
      server: {
        ...config.server,
        fs: {
          ...config.server?.fs,
          allow: fsAllow,
        },
      },
    };
  },
};

export default config;
