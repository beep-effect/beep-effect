# AI metrics property witnesses

The six saved property proposals now have explicit observations while retaining
the original assertions and tested subjects.

- The nested-worktree snapshot test keeps its file-count and fewer-than-100-stat
  checks. Its delegated FileSystem records every stat path, positively observes
  the legitimate root AGENTS file and rejects the 400 seeded nested package
  directories and their descendants. Boundary metadata remains permitted.
- The raw hook-event law uses `it.effect.prop` with the same HookPulseRawEvent
  arbitrary, salt-environment isolation, fixed timestamp and both wait-reason
  assertions. Its run floor remains 50 and explicit seed 804 takes precedence
  over an ambient seed.
- Six scorecard JSON codec laws use `it.effect.prop`, retaining each schema,
  codec pair and schema equivalence. Each floor remains 12; none of the six
  independent domains was combined away.
- The timer-rendering test retains its sanitization and substring assertions,
  adds an embedded apostrophe argument and checks a fixed argv representation
  through both command quoting and the outer bash command quoting. It renders
  strings only; it executes neither the supplied command nor a secret lookup.
- Snapshot retention uses deliberately distinct directory mtimes whose order
  disagrees with filename order. Existing count checks remain. Dry-run names
  and contents stay intact; applied retention preserves exactly the newest two
  snapshot names and contents plus the latest directory and its contents.
- The telemetry store test retains artifact-kind, decoded-status and actual
  filesystem observations, and compares each complete decoded transition and
  reconciliation with its submitted payload.

Six differential controls demonstrate sensitivity: reverse the actual retention
comparator, remove inner command quoting, remove outer command quoting, inject
one forbidden delegated stat, corrupt the transition session hash, or corrupt
the reconciliation lease hash. Every revised test fails and every original test
passes. Invalid initial controls are documented in the friction ledger and are
excluded from these results. All temporary source and test changes were restored.

Seven inverted native laws each fail with a shrunk counterexample and replay
metadata containing their configured seed. The six codec controls report seed
20260708; the raw-event control reports its preserved seed 804 despite the same
ambient override. A source audit preserves all 556 original assertion expressions
and all 116 directly matched registrations across the five touched files. The
unchanged table-driven schema registrations remain outside that direct count.

Full package verification with `BEEP_FC_NUM_RUNS=400` and
`BEEP_FC_SEED=20260708` passes audit (13.7 s) and docgen (4.7 s); root Oxlint
passes. The later flake and observability/runner phases and final package
inventory reconciliation are still required.
