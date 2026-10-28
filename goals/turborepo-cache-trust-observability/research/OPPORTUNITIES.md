# Friction and opportunities

Record friction as it occurs: work, minimum
command/error/file evidence, impact, prevention and owner/disposition.
Redact secrets, use portable paths, omit machine/session IDs and keep raw logs
in bounded artifacts.

Historical leads remain in the [exploration ledger](../../../explorations/turborepo-quality-cache/research/OPPORTUNITIES.md)
and [opportunity disposition](../../../explorations/turborepo-quality-cache/research/opportunity-disposition.md).
Refresh historical claims before treating them as current.

### Complete protocol checks at the supervisor boundary

While preparing accepted receipt import, source review found that
`Cache.protocol.runner.ts` checks transport-failure joins inside its worker but
only reruns the six-case observation validator in the outer supervisor. There
is no accepted importer yet, and promotion remains closed. Extracting the full
relationship validator for worker, supervisor and importer use would prevent
validation rules from diverging and make edited transport evidence testable at
the actual import boundary. This is a source-review finding, not a demonstrated
escape or a new native failure.

### Reproducible source patch and native fixture boundary

The pinned 4.0.20 source release has root package version `0.0.0` in Cargo.lock
while Cargo.toml names `4.0.20`; `cargo test --locked` refuses that mismatch.
The reviewed patch synchronizes only the root metadata. No third-party dependency
version or checksum changes. The first full crate compile also caught a test
initializer missing the new optional policy field; that initializer is repaired.
Both failures preceded the passing crate and middleware tests. The expanded patch passes 45 crate and two middleware tests.

The standalone native conformance runner also omitted `--skip-infer` and
`--single-package`, although its fixture has no workspace packages. A separate
small CLI repair will align its invocation with the native protocol fixture.
Its regression must assert both flags; simulated cache responses alone cannot
prove the real binary entered that fixture. The adapter process lab uses both
flags and checks each pinned binary digest before invocation.

### Preserve storage faults through the adapter boundary

The initial passing process lab did not inject object-store faults. Source review
found that S3 throttling became a generic HTTP failure and a failed metadata HEAD
could become an untagged success. The patch now preserves explicit storage 429s,
reports ambiguous failed writes independently, and fails signed reads when
metadata cannot be read. Five injected-fault process controls pass. Adding the
settings parameter initially exposed an upstream tracing macro that wanted to
Debug-print the configuration; the parameter is explicitly skipped instead of
deriving a secret-bearing Debug implementation. No configuration entered logs.

A focused CLI test launched from the repository root with a package-relative
Vitest include found no tests. It was rerun from the package directory and all
16 cases passed. Use the package working directory for the existing config.

### Parent dotenv survives the host-default guard

The full CLI audit still had six environment failures after the host-default
fixture fix. A root Bun process had already loaded the checkout cache tuple;
the host guard could not remove those explicit values. Without signing changes,
the enrolled-root run reproduced six failures among437tests, while package-cwd
execution had no inherited tuple. PR #2346 clears only the test-worker cache
inputs; all561affected tests pass from the enrolled root. Run focused checks
through the same parent launch path as the full audit to expose this mismatch.
