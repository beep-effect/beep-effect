# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-10-15

Trigger: TS7 exit program follow-up (handoff brief: "Pulumi -> Alchemy as its own goal packet opened through /explore after E merges"; E = #1833, merged b536e1bba7).

What still pins TypeScript 6 after #1833:
- `infra/package.json` devDependency `typescript: ^6.0.3` (syncpack versionGroup "infra ghaRunners SDK build requires TypeScript 6 until Alchemy migration"). The ghaRunners SDK build helper guards a 6.x compiler; root script `infra:prepare-gha-runners` builds with `infra/node_modules/typescript/bin/tsc`.
- `patches/@pulumi%2Fpulumi@3.268.0.patch`: the hoisted linker puts @pulumi/pulumi at the root where `require("typescript")` found TS7's version-only module; the patch points typescript-shim.js and tsutils.js at the root `@typescript/typescript6` bridge. @pulumi/pulumi is held at 3.268.0 in syncpack's held-back group until this migration.
- Proof recipe that works today: local file backend `pulumi preview` (PULUMI_BACKEND_URL=file://<tmp>, config aiMetrics:dataRoot) logs "Found typescript version 6.0.3" from the bridge.

Stacks/things known to live in infra (from the TS7 work, to be inventoried properly in research):
- `infra/Pulumi.yaml` main `./src/internal/ai-metrics-entry.ts` (nodejs runtime) - AI metrics install orchestration, "target-agnostic", local target needs a dataRoot.
- `infra/src/OpenClaw.ts` (OpenClaw deployment config, generations, systemd units, backup ship scripts).
- `infra/src/CiFleetController.ts` (ci-fleet controller bridge, #632).
- `infra/ci-runners/sdks/ghaRunners` (@pulumi/gharunners SDK, build.js, its own TS6 pin) and `lambda/turbo-cache`.

Hoped-for end state: no TypeScript 6 anywhere in the tree, no Pulumi CLI or patch, infrastructure defined in Effect-native TypeScript that tsc-rs/TS7 type-checks like everything else.

Open in my head: is Alchemy mature enough for every provider we use (AWS? systemd/host-level? GitHub runners?), and do we even need IaC for the host-local stacks or are they really just generated scripts + a CLI.

## 2026-11-02

Reopen trigger: operator request (2026-11-02, via the orchestrator session) for a dedicated session to "take over the question: can beep-effect migrate its infrastructure off Pulumi onto Alchemy, and if not fully, what are the options?" — an investigation, not an implementation. Hand-over brief (paraphrased): the operator has wanted off Pulumi for a while and is unsure Alchemy covers everything; one app (beep-effect-web, beep-effect.com) already deploys with Alchemy to Cloudflare; the TS6 isolation from the 10-15 kill landed as `infra/pulumi-typescript6.cjs`, which is now "the last reason TypeScript 6 stays in the repo".

Asked for: a resource-by-resource coverage matrix, a gap list with a per-gap option, three candidate options (full migration / hybrid / Pulumi-stays with TS6 removed by precompiling), a state-migration and rollback plan per option, and a recommendation with the questions a grill session must settle. No infra code changes, no `pulumi`/`alchemy` deploy commands, no secrets.

Things noticed while re-reading before research: `infra/r2-cache/` already carries two Alchemy stacks (`alchemy.run.ts.template`, `alchemy.signed-credentials.ts.template`) run from a frozen tool clone, so the repo has three Alchemy stacks in production, not one. `infra/turbo-cache-lab/` is a sixth Pulumi program that did not exist on 10-15. Root `postinstall` still builds the ghaRunners SDK with infra's nested TypeScript 6 on every `bun install`.
