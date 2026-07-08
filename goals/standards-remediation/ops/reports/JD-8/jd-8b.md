# JD-8b — 19-package jsdoc long tail

Wave: `JD-8`, lane: `jd-8b`. Nineteen packages processed strictly sequentially
(one writer per package at a time, each fully verified before the next
opened). No commits made. `standards/jsdoc-documentation.inventory.jsonc` was
read-only via a one-time Python `json.load` extraction of each package's
`exports[]` slice — never opened for writing. Every package's `exports[]`
slice was re-audited live against the current file on disk (not just the
inventory coordinates) before editing, per the R19 "stale coordinates" caution
— this caught two detector false positives (below) that a blind coordinate
apply would have mishandled.

## Per-package table

| Package | Findings | Fixed | Phantom/blocked | docgen examples | vitest | biome |
|---|---|---|---|---|---|---|
| `@beep/agents-use-cases` | 7 | 7 | 0 | 89 | 14/14 | clean |
| `@beep/agents-server` | 6 | 6 | 0 | 29 | 14/14 | clean |
| `@beep/shared-domain` | 5 | 5 | 0 | 247 | 54/54 | clean |
| `@beep/uspto` | 5 | 5 | 0 | 22 | 11/11 | clean |
| `@beep/nlp-processing` | 4 | 4 | 0 | 296 | 68/68 | clean |
| `@beep/mcp-kit` | 4 | 4 | 0 | 49 | 23/23 | clean |
| `@beep/test-utils` | 4 | 4 | 0 | 28 | 17/28 passed, 5 failed* | clean |
| `@beep/oip-web` | 4 | 4 | 0 | n/a** | 48/48 | 1 pre-existing failure elsewhere*** |
| `@beep/repo-ai-metrics` | 4 | 4 | 0 | 259 | 57/57 | clean |
| `@beep/law-practice-domain` | 3 | 3 | 0 | 82 | 14/14 | clean |
| `@beep/firecrawl` | 3 | 3 | 0 | 268 | 10/10 | clean |
| `@beep/ffmpeg` | 3 | 3 | 0 | 51 | 7/7 | clean |
| `@beep/agents-client` | 3 | 3† | 0 | 25 | 2/2 | clean |
| `@beep/libpff` | 2 | 2 | 0 | 16 | 9/9 | clean |
| `@beep/box` | 2 | 2 | 0 | 4497 | 19/19 | clean |
| `@beep/runpod` | 2 | 2 | 0 | 174 | 9/9 | clean |
| `@beep/onepassword-cli` | 2 | 2 | 0 | 13 | 4/4 | clean |
| `@beep/hubspot` | 1 | 1 | 0 | 20 | 6/6 | clean |
| `@beep/form` | 1 | 1 | 0 | 115 | 19/19 | clean |
| **Total** | **66** | **66** | **0** | — | — | — |

† `@beep/agents-client`'s 3rd finding (`StreamingTurn`/`EditTarget`, counted
as 2 sub-findings on 1 row) was initially left blocked pending an identity
composer registration ruled out of this lane's scope; ruling R21 (below)
verified the escalation, ruled it an omission, and directed the fix — see the
"R21 follow-up" section at the end of this report for the completed work.

\* `@beep/test-utils`'s 5 vitest failures ("Module did not self-register", a
native-addon binary mismatch) are unrelated to this lane's edits — confirmed
by `git diff` showing the touched file's diff is entirely inside JSDoc
comment blocks (13 insertions/8 deletions, zero runtime-code lines changed).
\*\* `@beep/oip-web` has no `docgen` package.json script (confirmed: no other
app in the repo except `architecture-lab-proof` wires one) and turbo does not
run one for it. A manual invocation of the docgen CLI against the app
confirmed this is a genuine infrastructure gap, not specific to this lane:
every module in the package — including ones never touched here — failed
identically with `Cannot find module '@beep/oip-web/...'` and `--jsx not set`
errors from a fallback tsconfig lacking the app's real path aliases and JSX
setting. Verified instead with the app's own `beep:check`/`beep:test` scripts
(tsgo clean, biome clean on the 4 touched files, vitest 48/48).
\*\*\* One pre-existing biome failure and other modified files in `oip-web`
belong to a different, concurrent lane working on that app's content
pipeline (`OipContent.data.ts`, `ContactSubmission.http.ts`) — outside this
lane's fence, confirmed via `git status` showing them as already modified
before this lane touched anything.

## Notable dispositions

**`@beep/shared-domain` (`EntityId.ts`, 5 `no-declare-statements`)** — the
type-only exports (`EntityIdValue`, `EntityIdValueFor`, `Definition`,
`EntityId`, `Any`) used `declare const x: X` stubs. Fixed with real
constructions: branded numeric ids via `S.decodeUnknownSync`, and the
generic `EntityId<Slice, Name>`/`Any` type aliases via `EntityId.factory(...)`
— the actual public constructor — assigned to explicitly-typed variables.
All type-level reasoning about generic-brand assignability (concrete literal
brands structurally satisfying the widened `Any = EntityId<string, ...>`
shape) held on the first docgen pass.

**Detector false positives found via live re-audit (not phantoms — both real,
both fixed):**
- `@beep/repo-docgen`'s pattern already fixed in JD-8a repeated here:
  N/A (not present in this lane's packages).
- `@beep/form`'s `TimeFieldProps` (`no-type-assertions-in-examples`): the
  flagged example used `satisfies TimeFieldProps` (not a type assertion at
  all) — the regex matched `as Effect` inside the unrelated **string
  literal** `"Stores the selected time as Effect DateTime."` (a capitalized
  word after "as" inside prose, not code). Fixed by rewording the string to
  "using Effect DateTime" — zero semantic change, same example.
- `packages/agents/client/src/Chat.atoms.ts`'s `TurnRequest` const
  (`missing-schema-annotation`) — a plain `S.Union([...]).pipe(S.toTaggedUnion("_tag"))`
  with no `$I` in scope. Fixed with `S.annotate({ description: ... })` added
  to the pipe (matches the detector's `\.annotate\(` regex and is a real,
  valid Effect Schema annotation call). First attempt placed `S.annotate`
  *after* `S.toTaggedUnion`, which silently widened the type and dropped the
  `.match` static that two other exports in the same file depend on
  (`docgen` caught this immediately: `Property 'match' does not exist on
  type 'Union<...>'`); reordering `S.annotate` *before* `S.toTaggedUnion`
  fixed it without touching any downstream consumer.

**R19 phantom, escalated — `packages/agents/client/src/Chat.atoms.ts`,
`StreamingTurn` and `EditTarget` classes (2 of `@beep/agents-client`'s 3
findings), left unfixed at the time of this original pass (RESOLVED — see
"R21 follow-up" at the end of this report):** both classes pass a bare
`{ description: "..." }`
object literal as the `S.Class` constructor's third argument instead of
`$I.annote(...)`. Investigated the actual gap: `@beep/agents-client` has no
registered identity composer at all — the canonical composer registry
(`packages/foundation/modeling/identity/src/packages.ts`'s `$I.compose(...)`
call) lists `agents-domain`, `agents-server`, and `agents-use-cases` but not
`agents-client`, and every other sibling package's composer is a thin
re-export of that same generated/registered set (`composers.$AgentsDomainId`
etc.). `S.Class`'s third argument type only accepts a literal annotations
object, not the result of piping `.annotate(...)` (that combinator has type
`(annotations) => (self: Schema) => Schema`, incompatible with the
positional-argument shape), so — unlike `TurnRequest` — there is no
in-scope-only fix available. Registering a new package in that shared,
repo-wide identity registry is an architecture decision outside a JSDoc
lane's mandate, and doing it unilaterally risked colliding with other lanes
already touching adjacent identity/schema files this session. Unblock path:
add `"agents-client"` to the `$I.compose(...)` list and export
`$AgentsClientId` following the exact pattern of `$AgentsServerId` two
entries above it, then route the two classes' third argument through
`$AgentsClientId.annote(...)`.

## Files touched (19 total, no commits)

- `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts`
- `packages/agents/server/src/AssistantTurn/BlockRepair.ts`
- `packages/shared/domain/src/entity/EntityId.ts`
- `packages/drivers/uspto/src/{Uspto.models.ts,Uspto.service.ts}`
- `packages/foundation/capability/nlp-processing/src/{Graph/AnnotatedTextGraph.ts,Graph/GraphOperations/Types.ts,Tools/_schemas.ts}`
- `packages/foundation/capability/mcp-kit/src/{TierGate.ts,ToolkitComposition.ts}`
- `packages/tooling/test-kit/test-utils/src/SqlTest.ts`
- `apps/oip-web/src/{app/api/contact/ContactRouteResponse.ts,app/layout.tsx,app/page.tsx,components/HeroVideo.tsx}`
- `packages/tooling/library/ai-metrics/src/agent-effectiveness.ts`
- `packages/law-practice/domain/src/values/{ApplicationNumber/ApplicationNumber.model.ts,PatentDocumentTriplet/PatentDocumentTriplet.model.ts,PatentNumber/PatentNumber.model.ts}`
- `packages/drivers/firecrawl/src/Firecrawl.models.ts`
- `packages/drivers/ffmpeg/src/FFmpeg.models.ts`
- `packages/agents/client/src/Chat.atoms.ts`
- `packages/drivers/libpff/src/Libpff.pffexport.ts`
- `packages/drivers/box/src/experimental/Box.schemas.ts`
- `packages/drivers/runpod/src/{Runpod.config.ts,Runpod.service.ts}`
- `packages/drivers/onepassword-cli/src/{OnePasswordCli.models.ts,OnePasswordCli.service.ts}`
- `packages/drivers/hubspot/src/HubSpot.config.ts`
- `packages/foundation/ui-system/form/src/fields/TimeField.tsx`

Recipe used throughout matches JD-1/JD-8a: `LiteralKit`/branded-schema type
aliases get `export type X = typeof X.Type` + a compiling `@example` using
`.is.<key>`/`.is["hyphenated-key"]` or `S.decodeUnknownSync`; opaque
(`S.declare`/`S.instanceOf`) schemas get real constructions through their
actual public constructors; `declare const`/`{} as X` placeholder examples
get replaced with genuine values, never deleted.

## R21 follow-up — agents-client identity registration

Ruling R21 verified the blocked-entry escalation above and ruled the missing
`@beep/agents-client` registration an omission, not an architecture decision.
Completed both steps as directed.

**1. `packages/foundation/modeling/identity/src/packages.ts`:**
- Added `"agents-client"` to the `$I.compose(...)` package list, grouped with
  its three siblings (`agents-domain`, `agents-use-cases`, `agents-server`).
- Exported `$AgentsClientId: Identity.IdentityComposer<"@beep/agents-client">
  = composers.$AgentsClientId`, with full JSDoc (`@example`/`@category`/
  `@since`) copied from the exact shape of `$AgentsDomainId`/`$AgentsServerId`/
  `$AgentsUseCasesId`, placed immediately after `$AgentsUseCasesId` and before
  the `law-practice-domain` block. The example uses
  `$AgentsClientId.make("StreamingTurn")`, tying it to the real consumer.
- `@beep/identity`'s root barrel (`src/index.ts`) already does
  `export * from "./packages.ts"`, so `$AgentsClientId` is immediately
  available via `@beep/identity` (not just `@beep/identity/packages`) with no
  further wiring.

**2. `packages/agents/client/src/Chat.atoms.ts`:**
- Added `import { $AgentsClientId } from "@beep/identity/packages";` and
  `const $I = $AgentsClientId.create("Chat.atoms");`, matching the canonical
  convention used throughout `agents-domain`/`agents-use-cases` (verified via
  `rg` across both packages — every module there follows this exact
  `import { $AgentsXId } from "@beep/identity/packages"` +
  `const $I = $AgentsXId.create("<module path>")` shape).
- `StreamingTurn`: replaced the bare string identifier `"StreamingTurn"` with
  `` $I`StreamingTurn` `` and the bare `{ description: ... }` third argument
  with `$I.annote("StreamingTurn", { description: ... })`.
- `EditTarget`: same treatment — `` $I`EditTarget` `` identifier and
  `$I.annote("EditTarget", { description: ... })` annotation.
- Both the class identifier and the annotation argument were updated together
  (not just the annotation) since every other `S.Class` in the repo pairs
  `` $I`Name` `` with `$I.annote("Name", {...})`; leaving the identifier as a
  bare string while only fixing the annotation would have been an
  inconsistent half-migration.

**Verification — `@beep/identity`:**
`turbo run docgen --filter=@beep/identity` — 159 examples found and
typechecked (up from 158 pre-change), zero errors. `npx tsgo -b` clean.
`npx vitest run` — 58/58 passed (6 files), matching the expected count.
`bunx biome check packages/foundation/modeling/identity` — 17 files, no
issues.

**Verification — `@beep/agents-client`:**
`turbo run docgen --filter=@beep/agents-client` — 25 examples found and
typechecked, zero errors. `npx tsgo -b` clean. `npx vitest run` — 2/2 passed.
`bunx biome check packages/agents/client` — 9 files, no issues.

**Result:** all 3 of `@beep/agents-client`'s findings are now fixed (the
`TurnRequest` fix from the original JD-8b pass, plus `StreamingTurn` and
`EditTarget` here). JD-8b's total is now **66 of 66 findings fixed**, 0
phantoms, 0 blocked.

Files touched (2 additional, no commits):
`packages/foundation/modeling/identity/src/packages.ts`,
`packages/agents/client/src/Chat.atoms.ts` (second pass, on top of the
`TurnRequest` edit from the original JD-8b run).
