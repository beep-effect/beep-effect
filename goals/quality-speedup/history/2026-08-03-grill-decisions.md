# Grill decisions — 2026-08-03 (P1)

`/grill-with-docs` session over the three P0 reports
(`research/tstyche-inventory.md`, `research/quality-time-inventory.md`,
`research/instantiation-census.md`). Seven decisions, each locked with
Benjamin in-session. Everything ships as ONE PR (Benjamin, same night —
replaces the original three-PR split).

1. **Tstyche: delete all 142 `*.tst.ts` files.** No porting now. The
   committed inventory + `data/tst-coverage-assessment.tsv` is the port-later
   ledger. Trigger for ever porting: an actual type-level regression, not
   speculative insurance. Doctrine edits: `standards/architecture/08-testing.md`
   proof sentence, `standards/ARCHITECTURE.md` app-surface rule, dated
   `standards/architecture/DECISIONS.md` entry ("Retire The Tstyche Type-Test
   Surface").
2. **Tonight's PR scope**: removal + three reports + doctrine edits +
   proven dependency fallout (`@microsoft/microsoft-graph-types`;
   `@lexical/code`/`link`/`rich-text` package-local edges) — nothing else.
3. **MimeType fix approved — follow-up 1**: replace type-level
   `Extract`/`Exclude` slicing in
   `packages/foundation/modeling/schema/src/MimeType.ts` with codegen-emitted
   per-category tuples. Verification: committed barrel floor probe
   17.79s → ≤0.6s.
4. **Hosted CI — cap first, bump on evidence**: follow-up adds a CI turbo
   concurrency cap in `Quality/Tasks.ts` (today `boundedRootTurboArgs` skips
   `--concurrency=3` when `isCi()`); observe Test Unit/Docgen for a week;
   8vcpu bumps only if they stay slow or die.
5. **Instrument hygiene — one follow-up PR**: verdict/RepoRun timing fields +
   `failedStepId`/`attemptId`, fallow envelope mode-split + freshness check,
   and the agent-effectiveness `elapsedMs: 0` fix (Effect.timed). Schema-first
   with decode tests. Transactional per-lane proofs + resume stay owned by
   `goals/coding-agent-effectiveness-evidence-loop`.
6. **Census verdicts confirmed**: instantiation census remains a documented
   ritual (floor-probe canary ~18s; fires at >2M instantiations or >2s check;
   review obligation on schema/generator/effect-bump PRs — NOT a CI lane).
   Pre-push lane parallelization rejected for now; revisit post-MimeType with
   wall-time AND peak-RSS evidence.
7. **Single mutating actor**: this session drives removal + publish; the
   parallel session is parked. Pre-removal baseline: the twin's
   `yeet verify` completed green (success, zero failed lanes) on the
   pre-removal tree immediately before execution began.

Follow-up sequence as approved: (1) MimeType codegen tuples, (2) CI
concurrency cap, (3) instrument hygiene PR, (4) docgen scoping
(`docgen:local` semantics in verify; changed-scope hosted — direction
pre-approved by Benjamin earlier the same evening).

## Scope amendment (2026-08-04, Benjamin)

Because other PRs queue behind this one, pipeline improvements were pulled
INTO tonight's PR instead of following it — decision 2 amended. Folded in:

- **MimeType codegen-tuples fix** (was follow-up 1) — verified by the floor
  probe before shipping.
- **CI turbo concurrency cap** (was follow-up 2) — `--concurrency=4` on CI
  when no explicit concurrency arg, applied to root turbo lanes (check,
  build, test, audit) and coverage; this PR's own CI run is the canary.
- **Docgen `docgen:local` semantics in the pre-push proof** (was follow-up 4,
  local half) — hosted Docgen lane keeps the full-repo proof.

Still follow-ups: instrument hygiene PR (unchanged), lint-policy
profile/changed-scope/turbo-izing (blocked on the per-step profile captured
tonight), hosted changed-scope docgen, runner bumps (evidence-gated), and
consolidating the CreatePackage/TsconfigSync root-package.json + workspace
helpers onto `@beep/repo-utils` `readPackageJsonFile`/`workspaceGlobsFrom`
(the tstyche removal made the two local copies converge into a clone —
suppressed with fallow-ignore markers pending the port).
