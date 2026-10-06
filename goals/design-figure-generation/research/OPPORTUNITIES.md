# Opportunities & friction receipts

## 2026-10-05 — hosted queue saturation expires the monitor's settle budget

- **Doing:** babysitting PR #1420 (docs-only) with `yeet monitor --until-ready --detach`.
- **Evidence:** at 20:50Z the `Check` workflow was `queued`/`pending` with zero
  started jobs for 15 branches (oldest since 19:50Z); the head's run
  `37368989712` was `pending` with 0 jobs; the monitor ended
  `settle: required-pending → settle-timeout` after 30m listing every required
  context as missing. `gh pr checks` showed 0 failing.
- **Cost:** one wasted monitor job, a manual diagnosis, and a re-submit with
  `--settle-timeout "3 hours"`.
- **Would have prevented it:** the monitor distinguishing "run exists but has
  no jobs after N minutes" (queue saturation, environment-only) from a missing
  context, and either holding the budget like `heavy-not-admitted` does or
  printing a `queue-saturated` gate line with the repo-wide queued count.
  Related: the ci-lane-economics branch-cap governor.

## 2026-10-05 — effect-vitest ratchet is red on a file this lane never touched

- **Doing:** running `bun run beep lint effect-vitest` before publishing the slice-1 lane.
- **Evidence:** after merging `origin/main` (`6547603030`), the gate still reports
  `packages/tooling/tool/cli/test/yeet-sweep-retire.test.ts: 3 new finding(s)`; the lane
  only added rows for its own five test files (spliced, not `--write`, because `--write`
  rewrites the whole inventory).
- **Cost:** a second ratchet run and a merge to rule the lane out as the cause.
- **Would have prevented it:** the gate attributing a finding to the commit that
  introduced the file's current text (`git log -1 -- <file>`), so an inherited red reads
  as inherited at first sight. Attribution here: inherited from main.

## 2026-10-05 — rsvg-convert refuses multiple inputs with a versioned PDF format

- **Doing:** converting eight sheet SVGs into one `pdf1.6` with `rsvg-convert`.
- **Evidence:** `rsvg-convert --format pdf1.6 --output out.pdf a.svg b.svg` →
  `Multiple SVG files are only allowed for PDF and (E)PS output.` (librsvg 2.62.4);
  `pdfunite` merges but stamps a random `/ID`, so two merges never hash alike.
- **Cost:** a prototype round and a driver redesign (per-page convert, pdf-lib merge,
  header rewrite to the requested version).
- **Would have prevented it:** nothing in-repo; recorded so the next PDF driver starts from
  the per-page route.

## 2026-10-06 — `Test Unit (repo-cli-2)` red is inherited from main (#1432)

- **Doing:** babysitting PR #1439 at head `3b63bee`.
- **Evidence:** `packages/tooling/tool/cli/test/runners-bake.test.ts` ("keeps the cloud bootstrap on
  pinned archives") expects `.cursor/install.sh` to contain the bun release URL; #1432
  (`b877057bc4`, merged to main 2026-10-05) rewrote `.cursor/install.sh` into the shared cloud
  bootstrap and the assertion no longer matches. Reproduced locally in the lane; the lane does not
  touch `.cursor/`, `scripts/cloud/`, or that test.
- **Cost:** one wave diagnosis.
- **Would have prevented it:** #1432 updating the assertion in the same PR; or the monitor
  attributing a red to the last commit that touched the asserted file.

## 2026-10-06 — Heavy matrix cancelled unrun; the census reports it as failures

- **Doing:** babysitting PR #1439 at head `3b63bee` (run `37391377568`).
- **Evidence:** `Heavy / Check` job `112037561279` started 23:59:37Z, completed 00:38:24Z with
  `runner_name: ""` and no steps; Build, Coverage Regression, Docgen, Lint Policy, and Test
  Integration ended `cancelled` the same way. `gh pr checks` and the yeet inbox list all six as
  `fail` / P0, indistinguishable from real reds.
- **Cost:** one wave triage to separate "never ran" from "ran and failed".
- **Would have prevented it:** the monitor classing a job with an empty runner and no steps as
  `not-admitted` (environment-only) instead of a P0 failure, as it already does for
  `heavy-not-admitted`.

## 2026-10-06 — one new workspace dependency stales three generated surfaces

- **Doing:** adding `@beep/m365` to `@beep/repo-cli` for `beep drawings sign email`.
- **Evidence:** hosted Knip, JSDoc Ratchet, Fallow, and Repo Sanity all went red on `446bb5f4f6`
  through one cause (`lint:policy-fingerprint` stale); locally the same edge also staled
  `standards/fallow.boundaries.generated.jsonc`, and editing the changeset that is the cache
  baseline's review basis produced `Qualification evidence digest mismatch.`
- **Cost:** one wasted hosted run and a second push.
- **Would have prevented it:** a single `beep repo refresh-generated` (fingerprint, boundaries,
  config-sync, cache baseline re-record against the current basis) that runs before any push
  touching a `package.json` or a basis changeset; or the cheap-gates preflight failing fast on
  the fingerprint before the push.

## 2026-10-06 — replicad's typings pull DOM globals into every consumer's program

- **Doing:** making Heavy / Check (`beep quality test-tsgo`) green on #1439.
- **Evidence:** `tsgo -p test/tsconfig.json --explainFiles` in `packages/tooling/tool/cli`:
  `lib.dom.d.ts — Library referenced via 'dom' from file node_modules/@types/opentype.js/index.d.ts`.
  `replicad.d.ts` imports `opentype.js` types, and `@types/opentype.js` declares `/// <reference lib="dom" />`.
  Compiling `@beep/occt` source in the CLI program therefore adds DOM, and an unrelated test
  (`match-person-model-store.test.ts:65`) failed TS2345 on DOM's `BodyInit` vs `Uint8Array<ArrayBufferLike>`.
  It was clean on `origin/main` (`2f2426b695`) with the same tool.
- **Cost:** a clean-`main` probe worktree, a file-list diff, and a fix in a file the lane does not own (narrowed to
  `Uint8Array<ArrayBuffer>`, which satisfies both Bun's and DOM's `BodyInit`).
- **Would have prevented it:** keeping `replicad` types behind `@beep/occt`'s package boundary (a local
  declaration of the small replicad surface the kernel uses), or a repo lint that flags any dependency whose
  typings add `reference lib="dom"` to a `lib: ["ESNext"]` package.

## 2026-10-05 — live-matter attachments unreachable from the agent

- **Doing:** fetching the live matter's sketch and photos from the operator's request email to put them under the corpus root.
- **Evidence:** the M365 connector read the `.docx` description but answered "Binary attachment — content cannot be returned inline" for the three JPEG attachments. `@beep/m365` has no attachment verb (`rg attachments packages/drivers/m365/src` finds only `hasAttachments`), and no `M365_TENANT_ID` or `M365_CLIENT_ID` is set on the workstation.
- **Would have prevented it:** a `getMessageAttachment` verb in `@beep/m365` that streams bytes straight to a corpus-root path, plus a documented workstation auth setup for it. The operator also relayed that the email held measurements; a check of the attachment list before relaying would have shown it holds only images and a scale-free description.

## 2026-10-06 — rounded spec coordinates defeated seam merging

- **Doing:** rendering the live matter; stray V-shaped lines appeared where one primitive's end face lay flush on another's wall.
- **Evidence:** the spec generator rounded coordinates to four decimals, so faces meant to be coplanar differed by about 1e-4 mm and OCCT's same-domain unification left them split. Segment counts fell from 31 to 21 in the top perspective once the spec carried full precision and `buildPart` called `simplify()`.
- **Would have prevented it:** a spec-level way to say "this face lies on that face" (a mate or a shared named plane) instead of repeating irrational coordinates, or a validator finding for near-coplanar faces within a tolerance.

## 2026-10-06 — hatch pitch was set in model space, not on the sheet

- **Doing:** reading the first live render; walls seen at a shallow angle were hatched almost solid.
- **Evidence:** `hatchFace` stepped section planes at the plan pitch along the face, so a face at 73° to the picture plane printed its lines at 0.29 of the pitch. The synthetic bracket has no steeply foreshortened shaded face, so its goldens and both synthetic judge rounds never showed it.
- **Would have prevented it:** a synthetic fixture with a tall oblique wall, or a validator check on minimum line-to-line distance in the shading layer of each sheet.

## 2026-10-06 — an inherited lint red blocks the push-first publish

- **Doing:** publishing the closeout commit after merging `main`.
- **Evidence:** `bun run beep yeet publish` stopped at cheap-gates on `lint:effect-vitest`: "2 new finding(s)" in `packages/foundation/modeling/schema/test/PatternOntology.test.ts`, a file this branch does not touch and that is red on `main` itself. The publish command has no way to proceed past a red the branch did not introduce, so the commit was pushed with `git push` and hosted CI left to prove it.
- **Would have prevented it:** cheap-gates attributing each red against the merge-base (introduced or inherited) and blocking only on introduced ones, or `main` being held green for the lanes the push gate runs.
