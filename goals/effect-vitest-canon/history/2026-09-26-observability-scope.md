# Observability scoped resource ownership

Fourteen admitted suites now use Effect-aware registration and explicit resource
ownership. All 177 original assertion expressions, eleven property registrations,
eighty case names and three compile-only fixtures are preserved. Property domains,
floors, independent expected values and native compiler subjects remain unchanged.

The compiler case uses ChildProcessSpawner.exitCode for each original command,
which gives each real child a shorter owned lifetime before the next command.
The same tsc executable, arguments, working directory, ignored output and sequential
order remain. The two 60-second source checks and 600-second compiler body remain;
new layer hook caps are ten seconds. This avoids the Node Bun shim's exit-only
handle without changing that shared shim. Native platform cleanup retains its
existing error policy; this test repair does not claim stronger platform behavior.

The two SDK cases retain separate exporters and processors under independent
public SDK layers. The config-only OTLP case now owns and shuts down its constructed
processor without emitting a span or building an additional SDK. Packet serializers
have separate harness-owned buffers. The relay keeps its dormant fake server and
all original ingests. Existing logger layers retain exact capture oracles and gain
explicit hook budgets. Runner adoption and witness changes remain later phases.

The first proof caught introduced timeout-argument ordering and redundant nested
generators; both were repaired against the installed API without changing deadlines
or assertions. A follow-up caught and removed an accidental extra helper argument.
Final full package verification passed audit (12.0 seconds) and docgen (4.0 seconds);
focused root oxlint passed. Node and Bun each passed all eighty cases with zero
failures/skips. Whole-command times were 7.179 and 3.921 seconds under recorded load.
The scope preservation receipt records source hashes and exact original expressions.
