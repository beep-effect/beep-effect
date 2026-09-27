# Observability implementation baseline

The wave starts from main `9cb79ddda2b72c426b322045fee9f5131b92a13c`
and uses the existing admitted inventory of 19 paths and 143 rows. Sixteen paths
are registered suites; three are compiler-only fixtures. Eleven files changed
since the frozen census, with no new cases. This is not a remainder inventory.

The configured unchanged suite passed all 80 cases on both Node and Bun, with
zero failures or skips and all sixteen registered files represented. Command
wall times were 6.426 seconds and 4.071 seconds respectively. Source hashes,
runtime versions, process limits, load and pressure were recorded before/after;
all source hashes remained stable. These timings are observations under shared
workstation load, not isolated performance claims. Full package verification
passed audit (9.9 seconds) and docgen (3.4 seconds).

Five historical Observed detector rows were already repaired by PR #1200:
two runtime wrappers, two manual property registrations and one plain Vitest
import. The upstream attribution receipt preserves their identities and actual
fix SHA. This wave does not claim that work or replace the two native laws.

D12 implementation order remains scope, assertions, properties and finite
witnesses, flake review, then observability. Native compiler/checkout subjects
stay native; in-process SDK and packet-capture fixtures stay isolated. Preserve
all original causes, independent expected values, property domains and floors,
counts, current Effect import paths and deadlines. No filesystem emulation is
justified for the actual compiler boundary.

The public runner has no production dependency on observability. Logger-capture
subjects still require a trace-enabled adoption pilot: lifecycle records must
not contaminate exact capture arrays, and the None minimum-level subject must
remain intact. Generated Observed transport laws need a separate canonical wire
pilot over the full production domains; a real counterexample must be retained
and attributed before any production repair or domain change. All existing
flake no-findings remain bounded judgments, not repaired-flake credit.

Source edits, final reconciliation and full local/hosted acceptance remain ahead.
The goal stays active. No production repair or merge is authorized by this wave.
