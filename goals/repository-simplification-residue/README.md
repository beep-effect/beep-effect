# Repository simplification residue

Lifecycle: `active`

Source: [ops/manifest.json](./ops/manifest.json).

This is the S36 executable successor to
[repository-simplification-confidence](../repository-simplification-confidence/README.md),
closed by #1884. It owns fifteen unmet source outcomes; the eighteen externally
gated follow-ups remain cross-references. All fifteen implementation acceptances
are still outstanding at packet opening.

Read [SPEC.md](./SPEC.md) for the per-issue contract and standing rulings,
[PLAN.md](./PLAN.md) for lanes, admission and waves, and
[research/SOURCES.md](./research/SOURCES.md) for provenance and external references.
[GOAL.md](./GOAL.md) is the compact launcher.

```text
/goal follow the instructions in goals/repository-simplification-residue/GOAL.md
```

P0 Research and admission is in progress. Wave 1 is the A/catalog retirement
train (#1851/#1860) plus detector repairs (#1855), starting with F-S31-EV010.
Issue #1860 is complete: the third A-train PR landed the catalog removals and the
`beep quality catalog-usage` detector
([record](./history/receipts/catalog-removals-record.md)).
Issue #1851 is complete: the closeout census finds zero live consumers of any retired A-train surface, with every remaining hit classified as immutable evidence or a name collision ([record](./history/receipts/a-retire-consumer-census.md)).
Issue #1853 is complete: all five retained patches have a focused test and a
fail-unpatched/pass-patched pair at the installed version, and none has a published
upstream exit yet ([record](./history/receipts/patch-proofs-record.md)).
Issue #1861 is complete ahead of its 2026-10-30 deadline: the hold register records
every retained override, patch, catalog hold and OSV exception, with the removed
and renewed holds proved ([register](./history/receipts/hold-register.md)).
Issue #1856 is complete: wave 1 classified the 342-file guidance surface and fixed
every stale file ([record](./history/receipts/guidance-classification.md)); waves
2a to 2c reviewed the 660 inline directives and wave 3 added the Markdown example
compile gate.
Wave 2a reviewed all 225 `fallow-ignore` directives and resolved #1910 ([record](./history/receipts/guidance-wave-2a.md)); wave 2b takes the TypeScript suppressions.
Wave 2b reviewed every `@ts-expect-error` and `@effect-diagnostics` directive, removing 13 stale rule entries and fixing 5 suppressions at the source ([record](./history/receipts/guidance-wave-2b.md)); wave 2c takes the remaining directive kinds.
Wave 2c reviewed the 182 remaining `biome-ignore`, `cspell`, coverage, `noqa`, `oxlint-disable` and `shellcheck` directives: 2 fixed, 91 stale removed, 89 kept with owner and exit ([record](./history/receipts/guidance-wave-2c.md)); wave 3 takes the Markdown fence compile gate and the upstream-copied `.patterns` decision.
Wave 3 completes #1856: the `lint:markdown-fences` gate compiles every guidance TypeScript fence (231 of 500 failed before; now 485 pass, 15 reviewed opt-outs, 590 docgen-generated), `testing-patterns.md` and `effect-library-development.md` are rewritten for this repository, and `module-organization.md` stays a labeled upstream reference ([record](./history/receipts/guidance-wave-3.md)).
Issue #1855 is in progress: wave 1 closed F-S31-EV010 (already fixed by #1899) and taught
the EV010 proof to follow same-file helpers, resolving 16 more rows with no exception
added ([record](./history/receipts/detectors-wave-1.md)); FP-1..FP-7 come next.
Wave 2 repaired FP-1, FP-3, FP-4 and FP-5 with paired fixtures, retiring 155 rows and adding none
([record](./history/receipts/detectors-wave-2.md)); wave 3 takes the FP-2/FP-6 rulings, individual
exception review and the zero scan.
Wave 3 ruled FP-2 (fresh temp-root wrappers leave EV003) and FP-6 (a `weak-collection` kind),
retiring 192 rows and adding no row or allowlist entry
([record](./history/receipts/detectors-wave-3.md)); wave 4 takes the EV014 named test layers.
Wave 4 repaired the EV015 single-test-block, EV006 browser-project and EV002 repeated-lifecycle classes, retiring 79 rows and converting 7 to owner/exit exceptions ([record](./history/receipts/detectors-wave-4.md)); waves 5-9 take the EV003 process-state ruling, the EV014 named test layers and the owner/exit register.
Wave 5 ruled EV003 process-state wrappers a judgment class and repaired the EV003 layer-factory and two EV008 classes, retiring 22 rows and converting 13 to owner/exit exceptions ([record](./history/receipts/detectors-wave-5.md)); wave 6 takes the EV014 named test layers.
Wave 6 closed EV014: imported test layers resolve across files, hermetic in-memory acquisitions are acquisition-free, and 39 real acquisitions take an explicit hook timeout, retiring all 233 exceptions with none added ([record](./history/receipts/detectors-wave-6.md)); wave 7 takes the EV010 owner/exit register.
Wave 7 is the EV010 owner/exit register: three detector repairs retire 17 rows, 80 open live-resource rows become owner/exit exceptions, and every EV010 exception now names an owner and exit ([record](./history/receipts/detectors-wave-7.md)).
Wave 8 finishes the owner/exit register: two detector repairs retire 12 exceptions, 36 trial-backed open rows become exceptions, 6 step-capture scopes reopen after their trial, and all 554 exceptions name an owner and exit ([record](./history/receipts/detectors-wave-8.md)).
Issue #1875 is in progress: wave 1 completed the `@beep/editor`, `@beep/libpff` and
`@beep/test-runner` cohorts and left 689 open rows
([record](./history/receipts/vitest-canon-wave-1.md)).
Wave 2 retired every open EV009 and EV014 row and left 26 EV015 rows for #1855
([record](./history/receipts/vitest-canon-wave-2.md)); wave 3 takes law-practice-server.
Wave 3 retired 27 law-practice-server and leaf-package rows and handed 23 to #1855
([record](./history/receipts/vitest-canon-wave-3.md)); wave 4 takes the repo-cli assertion families.
Wave 4 retired 99 repo-cli assertion and harness rows and handed seven EV008/EV013 rows to #1855
([record](./history/receipts/vitest-canon-wave-4.md)); wave 5 takes the resource-lifetime families.
The EV012 seams lane gave the Anthropic turn kernel, the bounded SHACL validator and the Codex packet renderer production service seams and retired their three module mocks
([record](./history/receipts/vitest-canon-ev012-seams.md)).
Wave 6 retired 116 repo-cli EV002 rows and handed 19 to #1855
([record](./history/receipts/vitest-canon-wave-6.md)); waves 5 and 7 take EV004/EV003 and EV010.
Wave 7 moved portable-filesystem EV010 tests in 17 files to the memory filesystem, retiring 16 rows, and handed 127 live-resource rows to #1855 ([record](./history/receipts/vitest-canon-wave-7.md)); wave 8 takes the deferred `step-capture-lifecycle` rows and the wave 5 families.
Wave 9 dropped 32 redundant `Effect.scoped` wrappers in 12 repo-cli tests and kept 9 whose close is observed, with the 12 lane EV010 rows confirmed live-resource ([record](./history/receipts/vitest-canon-wave-9.md)).
Wave 8 lane A retired 77 of the 84 open EV002, EV004, EV010 and EV015 rows in 11 repo-cli files and left 7 live-resource or cwd-seam rows open ([record](./history/receipts/vitest-canon-wave-8.md)).
Wave 10 retired 4 of 20 open rows outside repo-cli, moving two EV010 tests to the memory filesystem, and left 16 EV010 rows open with per-file live-resource evidence ([record](./history/receipts/vitest-canon-wave-10.md)).
Issue #1876 is complete: the RDF failure assertions and the Pacer logout teardown
witness are ported, with a per-hunk disposition of the preserved exports
([record](./history/receipts/rdf-pacer-ports.md)).
Issue #1869 is complete: telemetry storage completeness and stamp qualification are
separate fields, historical rows stay `unknown`, and a run that cannot evaluate a
session keeps a verified stamp, while the session's own contradicting evidence
still clears it
([record](./history/receipts/telemetry-completeness.md)).
Issue #1874 is complete: the base incremental state lives inside `outDir`. A dist-only
clean therefore also clears it, and cold, warm and changed-input builds all restore
the complete public output manifest
([record](./history/receipts/build-restore.md)).
Issue #1878 is complete: goal completion verifies only on GitHub's rule suite for the
merge push, which covers rulesets deleted since then, and on green required checks at
the accepted head. Missing, deleted or partial evidence stays `unknown`
([record](./history/receipts/completion-evidence.md)).
Issue #1879 is complete: native writes qualify atomic exchange on the target's own
mount. The capability is cached per parent-directory mount id, device and
filesystem type, and is probed with disposable files on that mount. A bind-mounted
or otherwise unsupported target refuses before any backup or publication
([record](./history/receipts/target-exchange.md)).
Issue #1880 is complete: each native publication records durable states in its journal,
and restart recovery reconciles every crash point byte-exact, idempotently, through
the next apply, `beep models recover` or `restore`. A target a competing writer
changed is refused and every artifact is kept
([record](./history/receipts/exchange-recovery.md)).
Issue #1881 is complete: `skills update` replaces skill files and directories only through
a qualified, verified atomic exchange, journals each publication with the same state
machine, and recovers every crash point byte-exact through the next update or
`beep skills recover`, refusing a replacing writer with every artifact kept
([record](./history/receipts/skill-publication.md)).

Issue #1882 is complete: the required `Security` job runs `beep ci dependency-review`
with its read-only token. It excludes only manifests under the declared
`**/test/**/fixtures/**` policy, keeps production transitive advisories and the
action's thresholds, and fails closed when GitHub cannot answer
([record](./history/receipts/dependency-review.md)).
The repository-wide six-open-PR cap usually
permits one or two residue lanes. S23 forbids parking for size and S31 forbids
added debt/exception/baseline rows.

Opening provenance is in
[the bootstrap receipt](./history/receipts/bootstrap-materialization.json).
The worker's proof and publication state are in
[the opening handoff](./history/handoffs/rsc-residue-packet-2026-10-17.md).

Issue #1854: census + idle-map archive recorded (receipt 2026-10-22); 34 idle
no-owner paths remain and are tracked in #1854 for a recoverable archive pass
run by a session that owns each clone
([receipt](./history/receipts/2026-10-22-foreign-clone-residue.md)).
