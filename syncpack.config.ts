import type { RcFile } from "syncpack";

const config = {
  source: [
    "package.json",
    "infra/package.json",
    "scratchpad/package.json",
    "tools/tsgo-shim/package.json",
    "packages/_internal/*/package.json",
    "packages/ecosystem/*/package.json",
    "packages/foundation/capability/*/package.json",
    "packages/foundation/modeling/*/package.json",
    "packages/foundation/primitive/*/package.json",
    "packages/foundation/ui-system/*/package.json",
    "packages/shared/domain/package.json",
    "packages/shared/use-cases/package.json",
    "packages/shared/tables/package.json",
    "packages/tooling/library/*/package.json",
    "packages/tooling/policy-pack/*/package.json",
    "packages/tooling/test-kit/*/package.json",
    "packages/tooling/tool/*/package.json",
    "apps/oip-web/package.json",
    "apps/professional-desktop/package.json",
    "apps/storybook/package.json",
    "apps/labs/*/package.json",
    "packages/agents/domain/package.json",
    "packages/agents/use-cases/package.json",
    "packages/agents/client/package.json",
    "packages/agents/server/package.json",
    "packages/agents/tables/package.json",
    "packages/epistemic/config/package.json",
    "packages/epistemic/client/package.json",
    "packages/epistemic/domain/package.json",
    "packages/epistemic/tables/package.json",
    "packages/epistemic/ui/package.json",
    "packages/epistemic/use-cases/package.json",
    "packages/epistemic/server/package.json",
    "packages/law-practice/domain/package.json",
    "packages/law-practice/use-cases/package.json",
    "packages/law-practice/server/package.json",
    "packages/law-practice/tables/package.json",
    "packages/documents/domain/package.json",
    "packages/documents/use-cases/package.json",
    "packages/documents/server/package.json",
    "packages/documents/tables/package.json",
    "packages/workspace/domain/package.json",
    "packages/drivers/drizzle/package.json",
    "packages/drivers/duckdb/package.json",
    "packages/drivers/face-detection/package.json",
    "packages/drivers/ffmpeg/package.json",
    "packages/drivers/postgres/package.json",
    "packages/drivers/anthropic/package.json",
    "packages/drivers/venice-ai/package.json",
    "packages/drivers/xai/package.json",
    "packages/drivers/acp/package.json",
    "packages/drivers/openai-compat/package.json",
    "packages/workspace/tables/package.json",
    "packages/workspace/use-cases/package.json",
    "packages/workspace/server/package.json",
    "packages/ontology/config/package.json",
    "packages/ontology/domain/package.json",
    "packages/ontology/use-cases/package.json",
    "packages/ontology/server/package.json",
    "packages/ontology/client/package.json",
    "packages/ontology/ui/package.json",
    "packages/architecture-lab/domain/package.json",
    "packages/architecture-lab/use-cases/package.json",
    "packages/architecture-lab/config/package.json",
    "packages/architecture-lab/server/package.json",
    "packages/architecture-lab/tables/package.json",
    "packages/architecture-lab/client/package.json",
    "packages/architecture-lab/ui/package.json",
    "apps/architecture-lab-proof/package.json",
    "apps/practice-kg-mcp/package.json",
    "packages/drivers/runpod/package.json",
    "packages/drivers/onepassword-cli/package.json",
    "packages/drivers/discord/package.json",
    "packages/drivers/ai-provider-cli/package.json",
    "packages/drivers/sanity/package.json",
    "packages/drivers/hubspot/package.json",
    "packages/drivers/phoenix/package.json",
    "packages/drivers/nlp-mcp/package.json",
    "packages/drivers/rdf-canonize/package.json",
    "packages/drivers/cosmos/package.json",
    "packages/drivers/oxigraph/package.json",
    "packages/drivers/n3/package.json",
    "packages/drivers/shacl/package.json",
    "packages/drivers/wink/package.json",
    "packages/drivers/tika/package.json",
    "packages/drivers/doc-text/package.json",
    "packages/drivers/libpff/package.json",
    "packages/drivers/box/package.json",
    "packages/drivers/firecrawl/package.json",
    "packages/drivers/uspto/package.json",
    "packages/drivers/pglite/package.json",
    "packages/drivers/m365/package.json",
    "packages/drivers/m365-mcp/package.json",
    "packages/drivers/govinfo/package.json",
    "packages/drivers/ecfr/package.json",
    "packages/drivers/uspto-mcp/package.json",
    "packages/drivers/pacer/package.json",
    "packages/drivers/tailscale/package.json",
    "packages/drivers/pretext/package.json",
    "packages/drivers/graph-3d/package.json",
    "packages/drivers/openclaw/package.json",
    "packages/drivers/obs/package.json",
    "packages/drivers/exiftool/package.json",
    "packages/drivers/gov-legal-mcp/package.json",
    "packages/drivers/openai/package.json",
    "apps/todox/package.json",
    "packages/drivers/box-provisioning/package.json",
    "packages/drivers/freshbooks/package.json",
  ],
  customTypes: {
    catalog: {
      path: "catalog",
      strategy: "versionsByName",
    },
  },
  updateGroups: [
    {
      // Held back from `deps:update`. Classic typescript stays ^6 for JS
      // compiler API consumers such as typescript-eslint, while
      // @typescript/native provides the TS7 compiler. Microsoft's
      // @typescript/typescript6 bridge is blocked by oven-sh/bun#33834.
      // fast-xml-validator 1.3+ / detailed-xml-validator 2.2+ pull
      // @nodable/flexible-xml-parser, which references Buffer at module
      // scope and breaks every browser bundle.
      // @effect/tsgo and its seven platform binaries move together and stay
      // held back. The binaries are not cosmetic: `effect-tsgo patch` copies
      // one over @typescript/typescript-<platform>/lib/tsc, so the platform pin
      // *is* the compiler `bun run check` runs. Letting deps:update move them
      // alone swaps the compiler silently, which is how 0.24.3 ended up nine
      // minors ahead of a 0.19.0 wrapper.
      // A bump also arms every rule absent from tsconfig.base.json's
      // diagnosticSeverity map, because omitted rules run at their upstream
      // default rather than off. 0.33.0 is adopted with eleven such rules
      // parked at "off" pending a one-rule-per-PR ratchet; moving off 0.33.0
      // without clearing that queue lands them all at once.
      // @biomejs/biome 2.5.7 stops formatting JSON piped through
      // `biome format --stdin-file-path`, so `renderBiomeJson` — the writer
      // behind `beep tsconfig-sync` for docgen.json/tsconfig.json — emits
      // compact JSON instead of formatted. Pinned exactly (no caret) because a
      // range would resolve straight back to the broken release.
      label: "Held back — do not auto-update (see changeset portless-default-react-grab-storybook)",
      dependencies: [
        "typescript",
        "fast-xml-validator",
        "detailed-xml-validator",
        "@biomejs/biome",
        "@effect/tsgo",
        "@effect/tsgo-darwin-arm64",
        "@effect/tsgo-darwin-x64",
        "@effect/tsgo-linux-arm",
        "@effect/tsgo-linux-arm64",
        "@effect/tsgo-linux-x64",
        "@effect/tsgo-win32-arm64",
        "@effect/tsgo-win32-x64",
      ],
      isIgnored: true,
    },
  ],
  versionGroups: [
    {
      // The private workspace root is an orchestration manifest, not a
      // publishable package. Keep its intentionally absent version out of
      // Syncpack's local-package version policy.
      label: "Private workspace root is intentionally unversioned",
      dependencies: ["@beep/root"],
      packages: ["@beep/root"],
      dependencyTypes: ["local"],
      isIgnored: true,
    },
    {
      label: "Catalog (Pinned)",
      dependencies: ["**"],
      dependencyTypes: ["catalog"],
      preferVersion: "highestSemver",
    },
    {
      label: "Workspace packages use workspace: protocol",
      dependencies: ["@beep/**"],
      packages: ["**"],
      dependencyTypes: ["dev", "prod"],
      pinVersion: "workspace:^",
    },
    {
      label: "Peer dependencies allow broader ranges",
      dependencies: ["**"],
      dependencyTypes: ["peer"],
      isIgnored: true,
    },
    {
      label: "Root devDependencies (third-party) should use catalog references",
      dependencies: ["!@beep/**"],
      packages: ["@beep/root"],
      dependencyTypes: ["dev"],
      pinVersion: "catalog:",
    },
  ],
} satisfies RcFile;
export default config;
