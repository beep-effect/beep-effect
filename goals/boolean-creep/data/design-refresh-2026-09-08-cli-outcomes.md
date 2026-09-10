# CLI outcome design refresh — 2026-09-08

## Scope and source

This pass audited five canonical boolean-creep records and aligned the existing
legacy-Word terminal design with the new PST record. The source checkout was
`7440cb8c4302ce64b87860069a464bafbf65f576`; the packages/apps comparison base
was main corpus `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

Only design documents were changed. Source, tests, inventory, lifecycle status,
dependencies, generated files, and git refs were not changed. Formal replacement
P3 review remains pending.

## Qualification results

| Record | Raw cardinality | Legal cardinality | Resolved representation | Qualification |
| --- | ---: | ---: | --- | --- |
| `scheduler-protocol-eviction-mode` | 4 | 3 | `inspect \| enable \| disable` LiteralKit | retained |
| `coverage-baseline-write-mode` | 4 | 3 | `ratchet \| write \| replace-all` LiteralKit | retained |
| `yeet-prepared-publish-commit` | 4 | 3 | tagged `skip` or `commit(stash: Option)` | retained |
| `corpus-pst-terminal` | 4 | 3 | shared `passed \| approved-exception \| unapproved-exception` LiteralKit | retained |
| `ci-lane-timings-render-mode` | 8 | 7 | five-value collection/render LiteralKit | retained |

The existing `corpus-legacy-word-terminal` record has the same 4/3 projection
as PST and now specifies the same `CorpusFamilyTerminalOutcome` owner and common
terminal carrier. The two records must land together; duplicating the literal
family would violate the repository's canonical-vocabulary law.

## Scheduler protocol eviction mode

`Quality.command.ts:3404-3434` is the complete raw flag and handler boundary.
Both flags default to false. The four parser pairs are observable, but
`enableEvictions && disableEvictions` returns the existing
`QualityScriptCommandError` at lines 3417-3422 before calling either
`admissionProtocolStatus` or `setAdmissionEvictionProtocol`. The other three
pairs select status, `on`, and `off` respectively. The two printed status lines
remain exact.

`quality-scheduler.test.ts:2167-2201` exercises inspect, enable, disable, and
conflict. The migration test addition must pin the conflict's exact message,
command, exit code, and absence of protocol mutation. The target mode exists
only after that raw validation; command flags and persisted `on | off` protocol
bytes remain unchanged.

## Coverage baseline write mode

`Quality/Tasks.ts:596-605` is the raw parser and retains both booleans.
`resolveCoverageTaskOptions` at lines 653-746 deliberately validates
`replaceAll && scoped` first and `replaceAll && !writeBaseline` second. That
error precedence must remain exact. Once both gates pass, the resolver derives
one baseline mode and carries it through full, selected, and noop affected
plans. The mode remains independent of the resolved `scoped` fact so an
internal affected planner can represent scoped replacement without recreating
the old boolean pair.

`rootCoverageSteps` at lines 2647-2649 is a direct testing/planning adapter over
the unvalidated parser. It must keep today's behavior: a raw false/true
`writeBaseline`/`replaceAll` pair still produces the ratchet step because the
step observes `writeBaseline`; it does not gain a new validation error.
`coverageSelectedStepsForTesting` and the sharded executor at lines 2699-2860
also remain supported. Their standalone `writeBaseline` function arguments are
outside this object-member migration.

Resolved readers are `coverageStep` at lines 2057-2069,
`runSelectedCoverage` at lines 2905-2921, and `runRootCoverageTask` at lines
2923-2950. Their labels, report-only args and environment, local/hosted shard
choice, compare-versus-write behavior, writer `replaceAll` option, and baseline
bytes must be derived from the mode without changing behavior. Existing tests
at `quality-tasks.test.ts:2826-2883,3765-3833,4386-4470,4863-4997` cover the
ordered errors, report-only path, shard topology, and encoded baseline output.

The target changes internal resolved state only. CLI syntax, environment
variables, report args, writer input, JSONC format, and canonical baseline bytes
remain exact.

## Prepared Yeet publish commit

`Handler.ts:757-810` contains the complete tuple producer graph. Both skip
producers return `[true, None]`: an existing clean commit at lines 772-776 and a
reusable verified commit at lines 805-807. The commit producer returns
`[false, stash]` at line 789, where the stash is Some only for the existing
staged-only path. No producer writes skip plus Some.

`runPublishMode` at lines 951-989 is the tuple reader. The replacement tagged
union keeps a payload-free `skip` member and a `commit` member carrying
`Option<YeetStashState>`. Post-tail restoration matches the commit member's
Option directly. A skip boolean is derived once for the existing early/standard
publish helper parameters and preserves `publishResult(context, !skipCommit)`
at lines 1218-1219. Those standalone function parameters are excluded from the
cluster.

Commit message validation, reviewed-path staging, staged-only stash creation,
extras update, guarded failure restoration, post-publish restoration, stash-pop
conflict handling, git commands, result booleans, and logs remain in their
current order. `yeet.test.ts:4126-4231` supplies the stash restoration and
conflict fixtures; existing-commit and reusable-skip flows also need explicit
union-case coverage. The carrier is private and has no encoded-side impact.

## Shared Corpus terminal outcome

The terminal producer and reader graph is contained in
`RestorationTransformations.ts`. `pstFailureTerminal` at lines 1114-1137 maps
the existing approval decision to false/false or false/true. Forced PST failure
at lines 1216-1234, missing preservation evidence, budget exhaustion, disk
shortage, validation failure, and source drift write false/true. Successful PST
completion at line 1351 writes true/false. Mail budget exhaustion at line 2084
writes false/true, while the explicitly approved unsupported-family defer at
line 2114 writes false/false.

Legacy-Word writers at lines 3809-3946 have the same three outcomes: approved
not-binary preservation is false/false, fidelity/conversion/budget failure is
false/true, and conversion success is true/false. `addFamilyTerminal` at lines
298-312 maps the pair to exception/pass/unapproved counters, and
`runBoundedFamilyCandidates` at lines 2027-2044 stops only on the unapproved
case.

One private `CorpusFamilyTerminalOutcome` LiteralKit therefore owns
`passed`, `approved-exception`, and `unapproved-exception`. The historical
`LegacyWordTerminal` type remains the common mail/PST/legacy-Word carrier to
minimize scope, but replaces the two flags with `outcome`. Every anonymous PST
return and all fixtures must use that owner. Input/output bytes stay independent.

There is no wire change. Transformation JSONL, pass/attempt/exception records,
approval classification, retained-output hashes, byte counts, messages,
`systemdRunPath`, sandbox arguments, and acceptance artifacts remain exact.
`restoration-transformations-coverage.test.ts:243-250,1387-1416,1561-1562,
2014,2125,2147,2189,2211,2250-2265` is the known fixture/assertion migration
set; a final exact member search is required during implementation.

## CI lane-timing render mode

`LaneTimings.ts:2219-2267` defines three false-default CLI flags. The handler at
lines 2297-2322 accepts seven of all eight raw triples. With `window=false`, it
collects recent runs immediately; TSV wins and Markdown is ignored, including
the `tsv=true, markdown=true` input. With `window=true`, only combined TSV and
Markdown fails. The five accepted resolved behaviors are recent summary,
recent TSV, window summary, window TSV, and window Markdown.

Operation order is part of compatibility. Repository-root fallback runs first.
Recent mode returns before the bounded format conflict, timestamp decoding, or
GitHub client construction. Window mode checks the exact
`Choose only one of --tsv or --markdown.` error before decoding bounds and
creating the client. The target resolver must preserve that order and all eight
raw inputs; it must not apply the window-only conflict to recent reports.

`ci-lane-timings.test.ts:831-915` covers recent summary/TSV, the window conflict,
reversed bounds, and all three window renderers. A complete eight-row table
must add both ignored-Markdown recent cases and prove they preserve output and
request behavior. Exported collectors/renderers, raw CLI flags, queries,
report schemas, console writes, and TSV/Markdown/text bytes remain unchanged.

## Inventory and implementation handoff

The five requested canonical cardinalities are source-supported as listed in
the table. No inventory correction is required by this pass. The PST and
legacy-Word records intentionally qualify separate source locations while
sharing one implementation vocabulary and carrier. All five replacements are
Tier 1 internal resolved-state migrations; raw CLI inputs and durable output
contracts stay at their current boundaries.

Before implementation, rerun exact source searches for every migrated member,
especially the many Corpus anonymous returns and coverage testing adapters.
Replacement P3 should review the complete paired Corpus change and coverage's
raw-versus-resolved split rather than isolated snippets.

## Validation

`mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` reports
no structural error for any design owned by this pass. The repository-wide
command remains nonzero because six newly qualified records from concurrent
lanes do not yet have design files: `goals-packet-snapshot-presence`,
`goals-packet-migration-kind`, `goals-transition-plan-disposition`,
`skills-patch-series-presence`, `data-sync-target-changed-files`, and
`research-capture-outcome`.

Scoped `git diff --check` passed for all seven files in this handoff.
