# Product-leaf couplings, 2026-11-17

Read-only audit of `origin/main` at `31990972130` (re-verified from the
2026-11-17 audit at `442086f0b6`). Each fact below names the file the seam
changes. Line numbers are approximate; re-run the `rg` probes before relying
on one.

## Product leaves

- Slices: `packages/law-practice/*`, `packages/documents/*`,
  `packages/workspace/*`, `packages/architecture-lab/*`.
- Drivers: `eyecite`, `govinfo`, `ecfr`, `gov-legal-mcp`, `pacer`, `uspto`,
  `uspto-mcp`, `hubspot`, `freshbooks`, `box`, `box-provisioning`, `m365`,
  `m365-mcp` (all under `packages/drivers/`).
- Apps that depend on a product leaf and are pruned with it:
  `apps/architecture-lab-proof`, `apps/docket-intake`, `apps/labs/api-docs`,
  `apps/oip-web`, `apps/practice-claude-mod`, `apps/practice-gateway`,
  `apps/practice-identify`, `apps/practice-kg-mcp`,
  `apps/practice-m365-contacts`, `apps/practice-mail-tagging`,
  `apps/practice-review-hub`, `apps/professional-desktop`.

## Manifest edges from kept packages

Every `dependencies`, `devDependencies` or `peerDependencies` edge from a
workspace outside the product leaves and the apps above to a product leaf:

| Kept workspace | Product-leaf edges | Seam |
| --- | --- | --- |
| `@beep/repo-cli` | `@beep/box`, `@beep/m365`, `@beep/uspto` | 2 |
| `@beep/party-server` | `@beep/m365` | 3 |
| `@beep/scratchpad` | `@beep/law-practice-use-cases`, `@beep/m365` | 3 |
| `@beep/agents-use-cases` | `@beep/workspace-domain`, `@beep/workspace-use-cases` | 4 |
| `@beep/agents-client` | `@beep/workspace-use-cases` | 4 |
| `@beep/db-admin` | `@beep/architecture-lab-tables`, `@beep/documents-domain`, `@beep/documents-tables`, `@beep/law-practice-domain`, `@beep/law-practice-tables`, `@beep/workspace-tables` | 4 |

No `packages/foundation/**` manifest, and no tooling manifest other than
`@beep/repo-cli`, lists a product leaf.

## Seam 1: tooling fixtures read product paths from disk

- `packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts`
  `ciGoalDataConsumers` (about lines 244-346) with
  `packages/tooling/tool/cli/test/goal-data-consumer-census.test.ts`
  (about 363-373): every row needs a consumed path matching its pattern and a
  tracked evidence file containing its reference. Rows name
  `packages/law-practice/server/test/*`,
  `packages/drivers/eyecite/test/index.test.ts`,
  `apps/labs/semantica/test/CanaryC2Report.test.ts`, `apps/labs/ciops/test/*`
  and `apps/labs/ciops/src/kpi/Pins.ts`, and consumed paths under
  `goals/citation-extraction-engine/**`, `goals/semantica-canary/**`,
  `goals/time-to-certainty/research/*`, `goals/speed-loop/ops/runner-burst`,
  `explorations/beep-ci-operational-ontology/**` and
  `explorations/legal-ontology-landscape/assets/manifest.jsonl`. The same test
  file's `mutations` list and `exclusions` list name tracked paths and fail when
  one is absent.
- `packages/tooling/tool/cli/test/ci-lane.test.ts` (about 204-209, read at
  about 598) reads the real
  `packages/law-practice/server/vitest.integration.shards.json` through
  `new URL("../../../../../...")`. It reads `.github/workflows/check.yml` and
  `heavy.yml` the same way; those are repository-owned and stay strict.
- `packages/tooling/tool/cli/src/commands/Laws/PrivateHomePaths.model.ts`
  (about 302, 346-348, 401) holds exemption rows for files in
  `goals/citation-extraction-engine`, `goals/claim-check-performance`,
  `goals/openclaw-workstation-agent` and `goals/cloud-agent-readiness`;
  `PrivateHomePaths.ts` (about 523-527) reports a row whose file is untracked
  as a stale-exemption finding, so the law fails when the packet is absent.
- `packages/tooling/tool/cli/test/ci-runner-security.test.ts` (about 1685)
  reads `goals/speed-loop/ops/runner-burst` from the repository root.
- `packages/foundation/modeling/ontology/test/SemanticFoundation.test.ts`
  (about 109) reads
  `explorations/legal-ontology-landscape/assets/manifest.jsonl`.
- Runtime inputs, not fixtures: `commands/Yeet/internal/WaveOrder.ts` (about
  44, `goals/time-to-certainty/research/economics.json`),
  `commands/Ci/RouteCorpus.ts` (`goals/verification-route/research/corpus`)
  and `commands/Cache/Cache.conformance.corpus.ts` (about 56,
  `explorations/turborepo-quality-cache/research/conformance-corpus-plan.json`).
  These read tooling packets, not product packets.
- String data, not a disk read: `CI_LANE_PARTITIONS` names
  `@beep/law-practice-server` for the integration shards. Its tests assert the
  table and pass in a pruned checkout; the table itself is CI configuration.

## Seam 2: legal CLI command groups

- `packages/tooling/tool/cli/src/commands/Drawings/*` imports `@beep/m365`,
  `@beep/occt` and `@beep/technical-drawing`.
- `commands/Corpus/internal/ServicePrograms.ts` imports `@beep/uspto`,
  `@beep/tika`, `@beep/libpff`, `@beep/poppler` and `@beep/tesseract`.
- `commands/Files/internal/Process.ts` imports `@beep/libpff/Libpff.service`.
- `commands/Research/Library/Library.box.ts` imports `@beep/box`.
- Tests: `test/drawings-intake.test.ts`, `test/drawings-sign-email.test.ts`,
  `test/research-library-box.test.ts`.
- Registries: `commands/Root.ts`, `internal/dispatch/Dispatch.manifest.ts`,
  repo-cli `package.json`.

## Seam 3: party is provider-neutral

- `packages/party/server/src/values/ContactEvidence/ContactEvidence.model.ts:8`
  imports `GraphContact` from `@beep/m365/M365.schemas`; so does
  `packages/party/server/test/GraphContact.test.ts`.
- `scratchpad/party/scripts/identity-evidence.ts` imports
  `@beep/law-practice-server/PartyContactSource`,
  `@beep/law-practice-use-cases/DocumentIdentification` and
  `@beep/m365/M365.schemas`. `scratchpad/package.json` lists
  `@beep/law-practice-use-cases` and `@beep/m365`; the
  `@beep/law-practice-server` import has no manifest edge.

## Seam 4: aggregation, architecture proof, agents thread model

- `packages/_internal/db-admin/src/schema.ts` (about 19-26) imports
  architecture-lab, documents, law-practice and workspace tables;
  `src/migrations/{ArchitectureLab,DocumentsSync,LawPracticeCandorGate,LawPracticeLegalPosition,WorkspaceThread}.ts`
  and three `test/integration/*.pglite.test.ts` files import product tables.
- `packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts`
  lists 91 `packages/architecture-lab/**` or `apps/architecture-lab-proof`
  paths and 43 `packages/_internal/db-admin` paths, read by
  `Architecture.plan.ts` (import at about line 25).
- `packages/agents/use-cases/src/processes/Chat/Chat.rpc.ts:16-17` imports
  `Thread` from `@beep/workspace-domain` and `@beep/workspace-use-cases/public`;
  `packages/agents/client/test/run-turn-{reconciliation,defect}.test.ts`
  import `@beep/workspace-use-cases`.
- `packages/shared/use-cases` is held by the agents `ProfessionalRuntime`
  process (`src/processes/ProfessionalRuntime/*`, `src/public.ts`,
  `src/proof.ts`, `src/test.ts`).

## Probes

```sh
rg -n "ciGoalDataConsumers" packages/tooling/tool/cli
rg -n "law-practice/server/vitest.integration.shards.json" packages/tooling
rg -n "goals/|explorations/" packages/tooling/tool/cli/src/commands/Laws/PrivateHomePaths.model.ts
rg -l -e 'from "@beep/((law-practice|documents|workspace|architecture-lab)-[a-z-]+|eyecite|govinfo|ecfr|gov-legal-mcp|pacer|uspto|uspto-mcp|hubspot|freshbooks|box|box-provisioning|m365|m365-mcp)[/"]' \
  packages/tooling packages/foundation packages/agents packages/epistemic packages/party \
  packages/execution-authority packages/shared packages/_internal scratchpad
```
