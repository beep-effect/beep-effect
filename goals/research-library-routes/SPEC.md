# Research library acquisition routes Spec

## Objective

Give the research library the acquisition routes the October intake lacked
and the hop model the November intake needs: a maintained Firecrawl driver
with a native web route in `acquire`; a Box route on `@beep/box` with a
receipt per file; `import-result` methods for VidBee and alphaXiv evidence;
per-hop citation extraction in `inventory`; and the routed-finding hop-2
admission gate with per-domain caps. Graduated from
[explorations/research-library-ontology](../../explorations/research-library-ontology/README.md).

## Non-Goals

- No full hop-2 crawl and no transitive GitHub acquisition: GitHub captures
  the cited object only.
- No archiving of video files into `objects/`; media is referenced by hash.
- No X post body acquisition beyond the existing `research.web` Grok route and
  its honest `incomplete` dispositions.
- No catalog model changes beyond what `research-library-ontology-core`
  ships; this goal consumes `Derivation.hopDepth`, route `prov:Plan` and
  `accessClass`, it does not define them.
- No intake run: `research-intake-2026-11`.
- No new paid endpoint; Firecrawl uses the existing key through the `op` shim.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards
   (`standards/architecture/03-driver-boundaries.md`,
   `07-non-slice-families.md`, `09-errors-across-boundaries.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, then the
   exploration packet's `BRIEF.md`, `DECISIONS.md` and `MAP.md`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- a new `@beep/firecrawl` driver package (drivers family, via `bun run beep create-package`):
  config, errors, models, service, live layer, test layer.
- `packages/tooling/tool/cli/src/commands/Research/Library/*`: `acquire`
  (web and Box routes), `inventory` (hop extraction), `import-result`
  (`vidbee`, `alphaxiv` methods), `qualify` (new adapters), hop-gate policy.
- `packages/tooling/tool/cli/test/Research/*`.
- `docs/runbooks/research-library.md`.

## Constraints

- The Firecrawl driver is a `drivers/*` wrapper: typed config, typed errors,
  `Context.Service` contract, live and test layers; the CLI never calls the
  SDK directly. The key is `op://BEEP_SECRETS/BEEP_SECRETS/AI_FIRECRAWL_API_KEY`
  resolved through the PATH `op` shim at runtime; never in argv, logs,
  manifests or packet files.
- Web captures must produce exactly the envelope `Library.web.ts` already
  validates (`{"data": {"markdown", "rawHtml", "metadata": {"sourceURL",
  "statusCode"}}}`, byte-bound `raw-response`, `raw-full-text`,
  `extracted-full-text`) so October's imported captures and new native ones
  verify under one contract. The HTTP stream is bounded before bytes are
  retained; PDFs mislabeled as HTML are rejected regardless of
  `Content-Length`.
- Box route: list and download through `@beep/box`; one start receipt and
  one terminal receipt per file; byte-identical downloads share an object;
  the Box file id and version are recorded as the captured revision. The
  route checkpoints after every file because Box quota is not observable.
- VidBee import: method/provider `vidbee`; `.vtt` as `raw-full-text`, FAQ
  `.md` as `ai-interpretation`, both hash-bound to the media file referenced
  by path and SHA-256; the generating model and effort from the FAQ
  frontmatter become the `ModelRun` agent. The yt-dlp native route stays
  primary for cited YouTube URLs; VidBee is the fallback import.
- alphaXiv import: method/provider `alphaxiv`; full text as
  `extracted-full-text` bound to the arXiv id and version; the reference list
  imports as hop-2 `Source` identities with `Derivation.hopDepth = 2` and no
  capture.
- Hop extraction: `inventory` records every URL in a hop-0 document as a
  hop-1 `Occurrence` and `Derivation`; every URL in a readable hop-1 capture
  as a hop-2 identity. Depth is on the edge; nothing is dropped.
- Hop-2 gate (policy values in a typed config, not schema): acquire a hop-2
  source only when its hop-1 parent has a `Finding` with `skos:related` to a
  live packet concept (goal `active`/`paused`; exploration not `parked`,
  `killed`, `graduated`); GitHub never transitive; arXiv catalogued only;
  other domains capped at 25 acquired hop-2 sources per domain per intake.
  `status` reports per-hop denominators.
- Qualification stays real: each new adapter qualifies by an actual bounded
  probe whose target, content and completeness validate, never by
  installation or configuration.
- Driver errors die at the driver boundary as typed driver errors; the
  library maps them to its existing `LibraryError` and disposition receipts.

## Acceptance Criteria

- [ ] `@beep/firecrawl` exists with `Firecrawl.config.ts`, `.errors.ts`,
      `.models.ts`, `.service.ts`, live and test layers, JSDoc and tests;
      `bun run beep quality package-verify @beep/firecrawl` passes.
- [ ] `research library acquire` acquires web, docs and registry sources
      natively; the resulting captures pass `verify` under the unchanged
      `Library.web.ts` contract; a replay of the October imported web captures
      still verifies.
- [ ] `research library acquire --route box` downloads a selected Box folder
      or file list with per-file receipts; interrupted runs resume without
      re-downloading byte-identical objects.
- [ ] `import-result` admits `vidbee` and `alphaxiv` manifests; invalid
      hashes, missing media binding or a mismatched arXiv id are rejected with
      typed errors and tests.
- [ ] `inventory` records hop-1 and hop-2 identities with `hopDepth` on the
      derivation edge; `status` prints per-hop totals and readable counts.
- [ ] The hop-2 gate admits and refuses sources exactly per the policy above,
      with tests for: routed parent admits; unrouted parent refuses; GitHub
      refuses; arXiv catalogues only; domain cap holds at 25.
- [ ] `qualify` records a verified probe for each new adapter.
- [ ] Runbook updated: web, Box, VidBee, alphaXiv routes and the hop gate.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/research-library-routes/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/research-library-routes/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/research-library-routes` | Passes |
| Package proof | `bun run beep quality package-verify @beep/firecrawl` and `@beep/repo-cli` | Passes |
| Cheap gates | `bun run beep yeet verify --tier cheap-gates` | Passes |
| Envelope parity | library tests: October imported web capture replays verify | Passes |
| Hop gate | library tests: the five gate cases above | Passes |
| Secret hygiene | `rg -n "AI_FIRECRAWL_API_KEY" --glob '!**/*.env'` shows only the `op://` reference | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add research-library-routes --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug research-library-routes`; add a `kind: decision` file there, never edit this block._

### Hop-2 admission is a routed-finding gate with domain caps, 2026-11-06

Every hop-2 identity is catalogued. A hop-2 source is acquired only when its hop-1 parent has a Finding with skos:related to a live packet concept (goal active/paused; exploration not parked, killed or graduated). GitHub is never transitive (cited object only). arXiv hop 2 is catalogued from alphaXiv reference lists and acquired on demand. Other domains: 25 acquired hop-2 sources per domain per intake. Relevance-score thresholds (model opinion, hard to audit) and a full hop-2 crawl (October D5 nearly drowned hop 0) were rejected.

Lane `explore/research-library-ontology`

Reverse: Change the typed policy values (threshold, caps, GitHub rule); the catalog keeps every hop-2 identity regardless, so widening or narrowing is a re-run of acquire

### VidBee and alphaXiv are import-result methods; Box is a native route on @beep/box, 2026-11-06

VidBee: .vtt as raw-full-text, FAQ .md as ai-interpretation, both hash-bound to the media file referenced by path and SHA-256, never copied into objects/ (October D6); yt-dlp stays primary for cited YouTube URLs. alphaXiv: full text as extracted-full-text bound to arXiv id and version; reference lists import as hop-2 identities without captures. Box: list and download through the existing @beep/box driver with a receipt per file because Box quota is not observable.

Lane `explore/research-library-ontology`

Reverse: Drop the import methods or the Box adapter; the catalog schema is unchanged because they only add provider values

### Web acquisition runs through a new @beep/firecrawl driver, 2026-11-06

External SDK wrappers belong in drivers/*. The driver produces exactly the envelope Library.web.ts already validates so October's imported captures and native captures verify under one contract. Key is op://BEEP_SECRETS/BEEP_SECRETS/AI_FIRECRAWL_API_KEY through the op shim; never in argv or logs. Session-scrape (infeasible at 835 URLs per hop) and a keyless effect/http fetch route (loses JS-rendered pages) were rejected.

Lane `explore/research-library-ontology`

Reverse: Remove the driver package and the native web route; web sources fall back to session-scrape plus import-result under the unchanged Library.web validator

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
