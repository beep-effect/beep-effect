# Effect rules on their own diagnostics lane

Lifecycle: `completed-retained`. Implementation, performance wave and verification are complete; the packet closes in the lane PR.

**Retired 2026-10-27** by `goals/tsrs-gates` PR 2: the Effect-patched tsrs gates every rule inside `Heavy / Check`, so the standalone lane, its profile and its hosted job were removed (see the Decision Log in `SPEC.md`).
The Claude orchestrator owns git, publication and the final lifecycle flip.

The [spike decision](history/2026-10-14-spike.md) is GO: 287 workspace check/test
projects completed with shared-rule parity. The full raw sweep took 1,423.881s
and peaked at 8,109,752 KiB. The production CLI also covers four direct
`test/tsconfig.json` projects, for 291 targets in the full independent diagnostics job.

Effect tsgo is pinned at 0.53.0 across all eight packages; tsc-rs remains 0.6.0.
The parallel heavy diagnostics job runs the independent command. Five 0.52
rules and errorPayloadShadowsName are errors; the two opt-in import-style rules are
explicitly off. Compiler exit policy ignores embedded Effect results while
retaining TypeScript failures. tsc-rs still prints nonblocking port diagnostics.

Source repairs cover four Array calls, four Record calls and the private SQL error payload.
The public catalog `name` → `instrumentName` change is split into
`~/.cache/beep/orchestrator/briefs/ts7-exit/lanes/h2-observability-rename.patch`
with a companion note. H2 retains five precise next-line suppressions until that
separate PR lands. The internal SQL-name error uses `sqlName`.

The amended performance wave moves diagnostics into its own parallel heavy
matrix job, outside Check. PRs use `--base` and the shared affected workspace
dependency walk; main runs full. Concurrency is bounded to 1..6 via a typed flag
and `BEEP_EFFECT_DIAGNOSTICS_CONCURRENCY`. The measured default is two projects:
717.407s for 291 targets, 11.89 GiB job memory. Hosted memory is capped at 19 GiB.
`schemaClassMissingBrand` remains off until the schema-opaque-default closing PR.
The repaired hosted-wrapper replay covers the full 291-project inventory through
--base origin/main in 793.080s at 12.38 GiB kernel peak inside the actual 19-GiB
cap. Its complete census is the one inherited AgentMessage finding; #1792 fixes
that source on main. Full measurements and verification are in SPEC and the lane
report. The three H2 shared-rule findings found during tuning are repaired.

Read [SPEC](SPEC.md), [PLAN](PLAN.md), [sources](research/SOURCES.md),
[rule delta](research/rule-delta.md) and [friction](research/OPPORTUNITIES.md).
Raw logs stay in the H2 cache. Full diagnostics: 291 projects / 72,975 file visits, zero new-rule findings,
one inherited strictEffectProvide finding. All requested cheap gates passed.
Four implementation packages have successful default proofs; the CLI audit has
an untracked-packet versus HEAD-archive mismatch after its two routing assertions
were fixed and re-proved. Both config-only app proofs passed. See PLAN and the
private orchestrator report for command outcomes and the remaining owner actions.
