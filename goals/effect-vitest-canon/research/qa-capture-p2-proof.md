# QA Capture canonical test proof

The saved package inventory is reconciled across all nine executable test files.
Native subjects remain native: Bun HTTP and compiler, real filesystem and PID
ownership, and an FFmpeg-generated h264 beacon video. No production code changed.

- Scope: nine original temporary allocations now release on every exit. Injected
  early failures leave zero scoped roots; the unscoped control leaves nine. Only
  those recorded control paths were cleaned. Collector closure still precedes
  disk-drain and successor-handle assertions.
- Assertions: all 117 original assertions in the six assertion-phase files are
  retained or converted with identical operands and polarity (ten conversions).
  Added cases cover delayed probe requests, repeated/out-of-order page sequences,
  eligible GIF identities, and one actual compilation per independently owned
  witness layer. Ten boundary/fixture controls distinguish these assertions from
  the previous weaker observations. All temporary mutations were restored.
- Properties: 36 independent schema domains remain within three registration
  budgets, with complete equality and schema-labelled diagnostics. Four planner
  laws retain their exact substantive statements and fixtures. Floors remain 25
  and 50. All 40 targeted negative controls identify the affected schema or law
  with replay diagnostics. The 400-run, seed-20260708 sweep passes 18 tests in the
  two property-bearing files. Printable-key rejection and NDJSON checks remain.
- Native availability: only a missing binary is an explicit skip. The installed
  binary executes the actual correlation test. Missing-binary control skips one;
  nonzero and permission controls each fail one. Inverted method, offset and fit
  assertions each fail. The original 120000 ms body deadline is unchanged.
- Runner: all nine files use the instrumented adapter. Full package audit and
  docgen pass. Both attributed Fallow checks and cache policy pass. The cache
  review changes only nine runner dependency edges across 14 reviewed nodes.

The native Bun final cohort passes all 44 tests (41 before, three added). Node
compatibility remains incomplete: before 37 passed / four failed; after 38 passed
/ six failed. The original Node shim lacks the HTTP hostname, completed child PID
and native compiler APIs. The new sequence and independently owned compiler cases
hit those same absent surfaces. The compiler spy now encounters absent `build`
before the old missing `fileURLToPath` path. This is not Node execution proof and
no shim or native-subject substitution was made.

Whole-command observations were Node 4.7722 s before / 4.6216 s after (failed
cohorts), and Bun 2.4679 s before / 1.6667 s after (passing cohorts). Source hashes,
workstation load, CPU/memory/I/O pressure, runtime versions and resource limits
are recorded in timing contexts. These single observations are not a causal
speedup benchmark. Failed Node tests are explicitly counted in their contexts.

Current detector exceptions are 14 fixture-budget reviews, five intentional
inner scope boundaries and three native platform layers. Strict root and ledger
schemas, unique IDs and owned source bounds pass. All 683 unrelated ledger-file
hashes and unrelated raw root/census objects remain unchanged. This package
reconciliation does not establish full goal completion or PR merge readiness.
