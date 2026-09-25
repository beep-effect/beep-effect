# Data wave preparation

This separate foundation/primitive wave follows utils PR #1245. It addresses
the two saved data findings without production-code changes:

- The MIME precedence test now proves both stl candidates' sources and extension
  membership, then requires model/stl (IANA) over application/vnd.ms-pki.stl
  (Apache). Both existing XML assertions remain.
- Duplicate shortcut assertions retain the seen predicate, false polarity and
  insertion order, while reporting the platform/scope/name/chord key.

All five test files import instrumented it. Generated TypeScript, lockfile and
Fallow metadata include the runner development dependency. The cache projection
changes eight data dependency lists (five cached tasks and three uncached tasks),
with task commands, settings, unrelated nodes and qualification state unchanged.

Full package verification passes (audit 7.3 seconds, docgen 3.3 seconds). Node
passes 34 tests across five files. Cache policy has zero blocking findings;
the detector ratchet has zero introduced findings. No finding is marked fixed
until a commit can be cited.

The Node JSON timing command passes the same 34 tests. The current reporter
span is 329.30 ms and whole-command time 0.645 seconds; the historical values
are 702.54 ms and 1.066 seconds. Node/Vitest versions differ, so this is not a
causal speedup claim. Source hashes, CPU/memory/I/O pressure and process limits
are preserved. Confirm timing inputs after the prerequisite merge.

The branch starts from the published utils head. Keep this work separate and
publish as a data-only stack against the utils branch while hosted checks wait.
All 15 cheap gates passed. The utils parent and main were integrated before
publication with unchanged timing inputs. Retarget to main after utils merges;
Benjamin must merge utils before data. Final ledger references, hosted checks
and review closure remain outstanding.

## Publication checkpoint

PR #1247 is stacked on the utils branch for a data-only review diff. Both
saved actionable data rows cite implementation commit
`6ebd80b9efdbbbd73b75c2d05777230e85af18d7`. Retain every no-findings row.
The stack must be retargeted to main after utils PR #1245 merges; hosted
checks and review closure remain outstanding. No merge is authorized.
