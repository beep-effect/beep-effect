# Friction receipts

## 2026-10-06: `package-verify` green, five hosted lanes red

- Doing: handing off P1 after `bun run beep quality package-verify @beep/repo-cli` reported
  `ok audit`, `ok docgen` and both `yeet publish` cheap-gate runs were green.
- Evidence: hosted run on PR #1488 failed Heavy / Check and Heavy / Lint Policy
  (`quality:test-tsgo`: TS377032 `Effect.provide with a Layer` in two new test files, and
  `knowledge:refs-check`: one home-relative path in a skill), Heavy / Docgen (`docgen:local`:
  `Unknown @category value rendering`), JSDoc Ratchet (`missingExportExamples: 14 > 5`), and
  Heavy / Coverage Regression (two baseline rows). All introduced; none surfaced locally.
- Would have prevented it: a `package-verify --hosted-parity` mode (or the default) that also runs
  `quality test-tsgo`, `docgen local --base origin/main`, `ci lane jsdoc-ratchet`,
  `knowledge refs --check` on the commit, and a scoped per-file coverage read for baseline rows the
  diff touches. Until then the orchestrate skill tells owners to run those five before "final".

## 2026-10-06: `gh pr ready` refused while `rate_limit` showed quota

- Doing: flipping PR #1488 ready after calling it final.
- Evidence: `gh pr ready` and `gh pr view` returned `API rate limit already exceeded` while
  `gh api rate_limit` reported `graphql 4984/5000`; `yeet ready` then reported `no open pull
  request was found for this branch`.
- Would have prevented it: `yeet ready` distinguishing "GraphQL refused" from "no pull request",
  and falling back to REST for the lookup as `yeet publish` does since #1468.

## 2026-10-06: a stacked base changed a reader's `--jq` output under a scripted test

- Doing: merging the review-window branch's new head into this lane.
- Evidence: five `yeet-merge-gate` tests failed because the reader's timeline query changed from
  one instant per line to `<event>\t<instant>`; the scripted `gh` answered the old shape.
- Would have prevented it: a shared scripted-`gh` fixture for the review-window reads, exported
  from the review-window test kit, so dependants do not re-encode its wire shape.

## 2026-10-06: JSDoc Ratchet red on `main` from three `LiteralKit` schemas without a type alias

- Doing: burning down the inherited reds after the relaxed-gate merges (operator ruling: merge
  with failing jobs, fix once on `main`). `bun run beep ci lane jsdoc-ratchet` on `main`
  (`6491294645`) reproduced `schemaAnnotationFindings: 3 > 0 (+3)`.
- Evidence: inventory rows `missing-schema-runtime-type-alias` for
  `PracticeKgAttorneyLinkSource`, `PracticeKgInferredLinkSource`
  (`packages/law-practice/use-cases/src/PracticeKg.correspondent-lookup.ts`) and
  `PracticeKgContactOrigin` (`packages/law-practice/server/src/PracticeKg.contacts.ts`), all
  introduced by #1519 (`cf106e28a7`). The sibling `PracticeKgContactLinkSource` in the same file
  carries the alias, so the pattern was known; the three were added without it.
- Cost: one five-minute inventory run to locate three one-line gaps; `bun run beep quality
  jsdoc-ratchet --inventory …` alone dies with `Error: null` when the inventory file is absent
  instead of saying the inventory has to be generated first.
- Would have prevented it: `lint:schema-first` (or the laws scanner) flagging an exported
  non-class schema without a same-name type alias in the touched package at cheap-gate time;
  and `quality jsdoc-ratchet` reporting a missing `--inventory` path as a named error.

## 2026-10-06: Heavy / Lint Policy red on `main` from one `effect-fn` finding in `@beep/repo-cli`

- Doing: same burn-down; `bun run --cwd packages/tooling/tool/cli lint:laws` reproduced
  `effect-fn; findings=1` at `src/internal/github/GraphqlBudget.ts:294` ("Reusable function
  'callback' directly returns Effect.gen(function*). Use Effect.fnUntraced instead.").
- Evidence: `git blame` puts the lines on #1508 (`3c65e30092`, 12:39 local), which predates the
  `2d52bdd1ad` attribution window the orchestrator named, so the red is older than the
  relaxed-gate merges; the hosted job on #1514 (`job 112435770160`) shows the same finding.
- Cost: the finding sits inside a curried `(operation, policy) => <A, E, R>(self) => Effect.gen`;
  the repair is `Effect.fnUntraced(function* <A, E, R>(self) …)`, and the package typecheck in a
  fresh lane cannot confirm it until dependency dists exist (13k `TS6305` not-built errors).
- Would have prevented it: `lint:laws` in the cheap gates for the touched package (it is
  package-local and runs in seconds), so a #1508-sized PR cannot publish with it red.

## 2026-10-06: `knowledge:refs-check` red on #1514 was a stale merge ref, not `main`

- Doing: attributing the second `Heavy / Lint Policy` failure on #1514 (`//#knowledge:refs-check`).
- Evidence: the hosted run gated on one `external-mirror-reference` row,
  `docs/runbooks/agent-pools.md:50` (a home-relative proxy path introduced by #1494). #1507
  (`9817708af0`, 14:06 local) already rewrote it to `$HOME/…`; #1514's merge-base
  (`9a42554f55`) predates #1507, and the hosted checkout (`e605043f2a`) carried the old text.
  `bun run knowledge:refs-check` on `main` reports `check: 0 live gated observation(s)`.
- Cost: a full hosted log read plus a local refs run to prove a non-red.
- Would have prevented it: the Lint Policy summary naming the gated observation rows (the
  classification table lists `external-mirror-reference 1` but the gate line is buried under
  42k observation rows); and the readiness monitor re-running Heavy lanes after a base merge
  when the PR's merge-base is behind a `main` fix to the same file.
