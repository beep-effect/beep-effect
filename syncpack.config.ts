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
    "packages/drivers/xstate/package.json",
    "packages/drivers/tesseract/package.json",
    "packages/drivers/poppler/package.json",
    "apps/docket-intake/package.json",
    "packages/drivers/occt/package.json",
    "packages/drivers/pdf-tools/package.json",
    "apps/practice-mail-tagging/package.json",
    "apps/practice-identify/package.json",
    "apps/practice-m365-contacts/package.json",
    "apps/practice-claude-mod/package.json",
    "packages/drivers/t3-code/package.json",
    "packages/drivers/windows-secrets/package.json",
    "apps/practice-gateway/package.json",
    "apps/practice-setup/package.json",
  ],
  customTypes: {
    catalog: {
      path: "catalog",
      strategy: "versionsByName",
    },
  },
  updateGroups: [
    {
      // Held back from `deps:update`. Classic typescript stays ^6 for the
      // programmatic (JS) compiler API, while @typescript/native provides
      // the TS7 compiler. TypeScript 7.0 ships no stable programmatic API
      // (7.1 is the target), so its actual consumers cannot move:
      // Remaining programmatic consumers need a separate TS6 API review.
      // Commitlint loads its config through jiti; ts-morph vendors its own TS6 copy.
      // tstyche is pinned exactly to 8.0.0-beta.0 for its TypeScript 7.1 backend.
      // Explicit targets use its own store, independent of root typescript@6.
      // Exit this hold when stable 8.0 supports the same matrix and all existing
      // effect-drizzle assertions pass on that release.
      // Microsoft's @typescript/typescript6 bridge was blocked by
      // oven-sh/bun#33834; that fix merged 2026-08-06 (bun 1.4.0 shipped
      // after it), so the bridge is now an option but a separate decision.
      // Full layout: docs/runbooks/typescript-toolchain.md.
      // fast-xml-validator 1.3+ / detailed-xml-validator 2.2+ pull
      // @nodable/flexible-xml-parser, which references Buffer at module
      // scope and breaks every browser bundle.
      // @effect/tsgo and its seven platform binaries move together. A reviewed
      // bump updates the combined root/lane diagnosticSeverity map and the standalone
      // `beep quality effect-diagnostics` census before these pins move.
      // Effect rules come from @effect/tsgo through that diagnostics lane;
      // tsc-rs still gates shared embedded rules until that lane is required.
      // After one green main run, promote the lane and ruleset context, then
      // fold the lane profile into compiler maps, set the three ignore flags
      // true and delete standards/effect-diagnostics.profile.json.
      // 0.53.0 was measured across all workspace check/test projects on
      // 2026-10-14 (goals/effect-rules-diagnostics-lane). Five 0.52 rules are
      // errors; schemaClassMissingBrand waits for schema-opaque-default
      // to arm it in its closing PR.
      // The import-style rules remain declared off; named helper imports are
      // deliberate and Effect barrel imports contradict the module-path law.
      // tsc-rs (pingdotgg/ts-rust) 0.6.0 stays independently held. Its port is
      // effect-tsgo 0.51.1 and its TypeScript pin is 7.1.0-dev.20261008.1.
      // Re-couple only after tsc-rs ports the newest rules and parity is proved,
      // then remove the standalone diagnostics lane. See the toolchain runbook.
      // @biomejs/biome 2.5.7 stops formatting JSON piped through
      // `biome format --stdin-file-path`, so `renderBiomeJson` — the writer
      // behind `beep tsconfig-sync` for docgen.json/tsconfig.json — emits
      // compact JSON instead of formatted. Pinned exactly (no caret) because a
      // range would resolve straight back to the broken release.
      // lexical 0.51 deprecates `LexicalComposer` (Biome `noDeprecatedImports`
      // fails every composer in @beep/editor and @beep/ui) in favour of
      // `LexicalExtensionComposer`, whose extension-based config is a
      // gesture-bearing editor migration with its own browser-QA campaign;
      // the whole lockstep `@lexical/*` family stays at 0.50 until it lands.
      // jsdom 30.1.0 breaks every vitest 5 jsdom-environment file at worker
      // start ("'addEventListener' called on an object that is not a valid
      // instance of EventTarget" from vitest's catchWindowErrors), so no
      // React test file runs. Pinned exactly at 30.0.1 (a range resolves
      // straight back to the broken release) until vitest or jsdom ships the fix.
      label: "Held back — do not auto-update (see changeset portless-default-react-grab-storybook)",
      dependencies: [
        "typescript",
        "tstyche",
        "lexical",
        "@lexical/**",
        "jsdom",
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
        "tsc-rs",
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
