# Regex adversarial corpus and benchmark contract

The required adversarial corpus and benchmark protocol are now committed
artifacts. They account for all 110 source families and 13,610 expanded
extractor instances. No family is approved: all 13,720 source proof rows remain
unfinished and `regex-benchmark-results.json` does not exist.

## Synthetic input corpus

`regex-adversarial-corpus.json` contains twelve recipes at ten exact UTF-16
lengths: 8 through 4,096 by doubling. The 120 inputs exercise repeated letters,
parentheses, reporter/numeric near misses, word boundaries, bracket density,
HTML prefixes, astral/combining text, whitespace, underscores, statute prefixes
and pincite punctuation. Construction preserves code points and pads a final
single-unit budget rather than splitting a surrogate pair. Each input carries
its exact UTF-16 size and SHA-256. The checker independently reconstructs it
from the authored plan.

Two generated copies and the committed artifact were byte-identical:
4,745,041 bytes, SHA-256
`b242de07ca1fb694ed1926b4dc853370cc454a1b2c1039dc15742c384d46ac2d`.
Synthetic inputs retain the repository's Apache-2.0 license reference and
digest. Oracle-derived source descriptors retain their existing BSD-2 notice.

The source projection retains family IDs/forms and every instance ID, artifact,
index, pattern digest, flags and constructor. Its original JSON bytes and hash
are preserved by the existing codec. It deliberately excludes mutable
workflow/proof fields: approving a source row must not create a circular hash
dependency with the benchmark result that supports it. The checker compares
the complete descriptor projection with the schema-decoded source ledger.
No pattern body is executed by this projection check.

The generated corpus has exact-path formatting/spellcheck exclusions because
its large source snapshot must retain hash-bound evidence bytes. The producer,
schema, projection/hash/input reconstruction checks and corruption suite remain
required. Authored sources, plans, controls and unrelated fixtures are covered
by normal formatting/spellcheck. The SPEC Exception Ledger records the scope.

## Measured controls

`probe-regex-benchmark.py` serializes owned Node 24.22.1 and Bun 1.4.4 children.
The fixed child executes only `^a+$` and the seeded `^(a+)+$` negative control.
Each measured size uses two warmup blocks and five measured blocks, with 256
evaluations per block: 1,792 evaluations total. Monotonic nanoseconds are
measured inside the child, excluding startup. The recorded parent metadata
includes Python, platform, architecture, CPU and source/plan hashes.

Each runtime's linear series completed all seven control sizes, 8 through 512.
Each catastrophic series measured sizes 8 and 16, then hit the watchdog at 32.
There were twenty owned children: eighteen completed measurements and two
confirmed SIGKILL exits. Every child exit was confirmed. No unrelated process
was signaled. The negative control is rejected, not accepted as a source-family
strategy.

The one-second watchdog covers the child's full lifetime, including startup.
The parent requires the started marker before recording a timeout as a matching
control, kills only its own child and waits for exit with a two-second cleanup
guard. This is a maintainer measurement guard. It does not prove enforcement of
the engine's default regex/stage deadlines or replace the frozen policy.

Medians are recomputed from five raw samples. A ratio must be strictly greater
than 3.5 for two consecutive doublings to fail scaling. Synthetic boundary
controls prove that exactly 3.5 is allowed, a single breach is allowed, and two
consecutive fourfold rises are rejected. Absolute latency is informational.

## Family approval remains open

The reserved result schema requires the producer/source digest, matching
runtime/CPU metadata and protocol; every family; static review; implementation
references; a literal-routing decision; positive/adversarial-case and focused
test proof; all recipe/runtime/size sample vectors; and deterministic work-cap
proof.
Instance coverage must contain every indexed instance and its original pattern
digest, with named source families. No fixture command is executed. Referenced
files must remain inside the repository after realpath resolution.

The result producer, family reviews/tests and the actual family result artifact
are not implemented in this checkpoint. Their positive execution paths must
be proved when the engine patterns land. The current successful synthetic
controls and global near-miss pool cannot substitute for family-specific
positive/adversarial cases, compatibility review, routing or runtime caps.

`check-regex-benchmarks.ts --audit` validates the corpus, source descriptors,
protocol and synthetic measurements. If a family result file is present, it
must pass its full declared checks. Default mode also requires that artifact
and complete source proof rows, so it currently fails. The package command now
audits ten components; only the full target verifier entrypoint remains absent.

## Verification and next gate

The audit baseline passed; default mode rejected missing family execution
proof. Thirty-seven negative controls and two positive threshold controls
passed, with payload/report hashes refreshed where needed to exercise semantic
checks. The actual package command and relocated audit baselines passed, as did
fifteen package rejection controls. Package audit/docgen and the benchmark
checker's standalone TypeScript/Effect diagnostics passed. Formatting,
Markdown, packet/manifest, diff and commit checks cover this local checkpoint.

The P0 artifact set now has its divergence and regex contract artifacts. P0
still needs a requirement-by-requirement exit audit; this note does not promote
the phase or the goal. Target implementation, donor dispositions, fidelity
questions, family safety and exhaustive parity remain unproved.

Supporting logs are under
`/home/elpresidank/.cache/beep/citation-extraction-engine/`:
`regex-controls-probe.log`, `regex-check.log`, `regex-contract-controls.log`,
`regex-parity-controls.log`, `regex-package-verify.log`, `regex-typecheck.log`,
`regex-markdown.log` and `regex-goals-doctor.log`.
