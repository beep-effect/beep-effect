# TrustGraph workbench render ownership

The saved L-RES-03 finding identified two React Testing Library renders without
an explicit release boundary under Vitest globals:false. Each render now
registers a test-owned completion callback that unmounts its React root and
removes its own container in a finally block. No shared cleanup hook is added.
The four original role, favicon and theme-color assertions remain unchanged,
and the normal shared concurrent test configuration remains in force.

A private ordered experiment adds an injected assertion failure after a third
render and a trailing DOM-empty assertion. With the completion callbacks, all
four cases pass; removing all three callbacks leaves a container and fails the
final assertion. Original source bytes are restored afterward. The experiment
uses the installed CLI's sequence.concurrent=false only to observe the completed
lifetimes in order. Initial concurrent and unsupported-API experiments remain
failed receipts; they are not credited as cleanup proof.

The configured package audit passes in 7.4 seconds; this lab has no docgen task.
Both original tests run through @beep/test-runner, with peer exports from
@effect/vitest. The generated TypeScript and Fallow dependency edges are updated.
The cache review adds only seven runner edges across ten reviewed computations;
no cache qualification or production code is changed.

The property, flake and observability reviews retain their saved no-findings
judgments. This jsdom ownership proof does not establish browser gesture or
visual acceptance. React's own hoisted head-resource behavior is preserved.

Both Node and Bun pass the two original cases with zero skips. Whole-command
observations are Node 4.3211 → 4.2202 seconds and Bun 2.4175 → 1.7665 seconds.
The public before/after receipts include stable source hashes, workstation load,
pressure and limits; these observations do not establish a causal speedup.
Root Oxlint, Sherif, Fallow health/audit and cache policy pass.

The saved resource row is fixed, with no current detector rows for this package.
The census updates only the owning test file. Reconciliation preserves 684
unrelated ledger hashes and leaves the root detector inventory unchanged.
Thirty-five packages and 1,415 saved actionable findings remain; this closes
only the workbench inventory, not the goal or PR acceptance gates.
