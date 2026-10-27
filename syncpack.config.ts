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
    "packages/drivers/ffmpeg/package.json",
    "packages/drivers/postgres/package.json",
    "packages/drivers/anthropic/package.json",
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
    "apps/practice-review-hub/package.json",
    "packages/drivers/commands/package.json",
    "packages/drivers/git/package.json",
    "packages/drivers/github/package.json",
    "packages/drivers/github-actions/package.json",
  ],
  customTypes: {
    catalog: {
      path: "catalog",
      strategy: "versionsByName",
    },
  },
  updateGroups: [
    {
      // Held back from `deps:update`: tstyche stays at 8.0.0-beta.0 until
      // stable 8.0 passes effect-drizzle's existing explicit-target matrix.
      // Targets use its own compiler store, independent of root TypeScript.
      // Full layout: docs/runbooks/typescript-toolchain.md.
      // fast-xml-validator 1.3+ / detailed-xml-validator 2.2+ pull
      // @nodable/flexible-xml-parser, which references Buffer at module
      // scope and breaks every browser bundle.
      // @effect/tsgo pins its seven platform binaries exactly, so only its own
      // catalog entry moves. A reviewed bump updates the combined root/lane
      // diagnosticSeverity map and the standalone `beep quality effect-diagnostics`
      // census before this pin moves.
      // tsrs (oxc-project/tsrs) is held with it: `effect-tsgo patch --tsrs` only
      // has an Effect build for the tsrs versions the installed @effect/tsgo
      // packages ship (0.59.0 ships 0.20.0-ts7.1.0-beta), so the two pins move
      // together in one reviewed bump (goals/tsrs-gates).
      // Effect rules come from @effect/tsgo through that diagnostics lane;
      // That lane is required; the three ignore flags are true, so tsrs
      // gates TypeScript errors only. The Effect-patched tsrs knows every rule
      // name in standards/effect-diagnostics.profile.json, so the fold into the
      // compiler maps and the lane's retirement are the next PR (goals/tsrs-gates).
      // 0.53.0 was measured across all workspace check/test projects on
      // 2026-10-14 (goals/effect-rules-diagnostics-lane); the patch-only 0.53.4
      // bump added no rules (hold register, 2026-10-17). All six 0.52 rules are
      // errors; schema-opaque-default armed schemaClassMissingBrand on
      // 2026-10-15 in its closing PR. The 0.54.1 bump armed schemaClassObjectLiteral.
      // The 0.55.0 bump armed preferEffectString after the effect/String migration
      // (goals/effect-string-migration) cleared its 2,992 sites.
      // The import-style rules remain declared off; named helper imports are
      // deliberate and Effect barrel imports contradict the module-path law.
      // tsc-rs (pingdotgg/ts-rust) ran the gates from 2026-10-14 until
      // goals/tsrs-gates replaced it; it is no longer installed. See the runbook.
      // @biomejs/biome stays at 2.5.6: 2.5.15 reformats four @beep/html and
      // @beep/provenance sources and adds a noDeprecatedImports error in
      // @beep/repo-cli (hold register, 2026-10-17). Bump it with that
      // format/lint wave. `renderBiomeJson` no longer pipes stdin, so the
      // original 2.5.7 stdin regression no longer applies.
      // lexical 0.51 deprecates `LexicalComposer` (Biome `noDeprecatedImports`
      // fails every composer in @beep/editor and @beep/ui) in favour of
      // `LexicalExtensionComposer`, whose extension-based config is a
      // gesture-bearing editor migration with its own browser-QA campaign;
      // the whole lockstep `@lexical/*` family stays at 0.50 until it lands.
      // Fallow 3.34 corrects entry-glob semantics and exposes 61 existing findings.
      // Promote it after the public API and generated-entry triage, without a new baseline.
      // Ink 8 strips U+200B workflow-command neutralization markers from output.
      // Keep Ink 7 until terminal command safety and width contracts migrate together.
      // jsdom 30.1.0 breaks every vitest 5 jsdom-environment file at worker
      // start ("'addEventListener' called on an object that is not a valid
      // instance of EventTarget" from vitest's catchWindowErrors), so no
      // React test file runs. Still reproduced on 30.1.3 under the `--bun`
      // vitest runtime on 2026-10-17 (Node passes). Pinned exactly at 30.0.1 (a
      // range resolves straight back to the broken release) until vitest or
      // jsdom ships the fix.
      // statelyai 0.15.0 depends on @statelyai/model-testing@0.2.0, which was
      // never published (npm 404), so `bun install` cannot resolve the lockfile.
      // Stay on 0.14.3 until a release ships whose dependency tree resolves.
      label: "Held back — do not auto-update (see changeset portless-default-react-grab-storybook)",
      dependencies: [
        "fallow",
        "ink",
        "tstyche",
        "lexical",
        "@lexical/**",
        "jsdom",
        "fast-xml-validator",
        "detailed-xml-validator",
        "@biomejs/biome",
        "@effect/tsgo",
        "tsrs",
        "statelyai",
      ],
      isIgnored: true,
    },
  ],
  versionGroups: [
    {
      // Pulumi's nodejs runtime needs the classic TypeScript API, so infra
      // keeps its own nested TypeScript 6: infra/pulumi-typescript6.cjs points
      // the runtime at it, and the ghaRunners SDK build guards a 6.x compiler.
      label: "infra keeps TypeScript 6 for the Pulumi runtime and ghaRunners SDK",
      packages: ["@beep/infra"],
      dependencies: ["typescript"],
      dependencyTypes: ["dev"],
      pinVersion: "^6.0.3",
    },
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
