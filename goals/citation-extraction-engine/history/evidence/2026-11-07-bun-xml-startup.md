# Bundle the actual Bun XML test entry once per scoped installation

The historical Bun markup callback watchdog failure had no established row-level
cause. A later diagnostic replay passed but took 90.35 seconds, versus 15.72
seconds for Node. Source inspection found an avoidable difference: regex and HTML
workers already use the existing scoped bundler, while the Bun XML fixture launched
the TypeScript entry directly for every child. Node XML was bundled once.

The XML fixture now reuses makeCitationBundledTestRuntime for both actual runtime
kinds. It retains the unchanged Bun/Node platform entrypoints, executables, isolated
process program, schema framing and authenticated kernel. The parent supplies the
original absolute WASM asset path in startup data, so moving the bundled entry does
not change kernel lookup or authentication. No production worker, platform adapter,
callback algorithm, deadline, concurrency limit or cleanup rule changes.

The selected callback/XML/default-resolution replay passes all eight tests. Bun
markup callbacks take 9.30 seconds and Node markup callbacks 8.55 seconds. Selected
XML outcomes and physical retirement take 2.35 seconds for Bun and 2.07 seconds for
Node. The allocation-before-spawn refusal still observes zero children; unchecked
callback traces and deferred failures pass. Both default resolution replays also
pass, retaining the original 30 assertions, 94 mentions and actual admission owners.

The previous and new timing samples have different ambient workload and are not a
controlled benchmark. They demonstrate substantial recovered margin at the unchanged
120-second callback/XML test limits and remove repeated module startup work. This
is a concrete repair for unnecessary fixture startup overhead, not proof that every
possible cause of the historical hosted timeout has been eliminated. Exact-head
hosted unit/integration acceptance remains required.

Package lint/types pass. The full XML/annotation corpora and whole-engine safety,
source/donor accounting, fidelity laws and lifecycle closeout remain unqualified
unless separately evidenced. No canonical assertion row is promoted by this startup
repair; the resolver assertion binding has its own scoped receipt.
