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
