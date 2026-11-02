# Transcript reader and backend reconciliation refactor review

Assigned independent Astra panel, 2026-10-29. Bounded source review, not goal
acceptance or live enrollment qualification. The reviewer did not edit code,
execute tests or launch services.

## Transcript reader

No actionable semantic regression versus the exact pre-refactor snapshot
`foundation-transcript-reader-before.ts`, SHA-256
`81a32f4181e68a7cc55169ece72b937b78e5fb4ef1cf5d13fe1c85f6d1413369`.
Reviewed current `src/transcript-page.ts`, SHA-256
`e7935add92ce2a3c47a0d9b70020dc978ae25c92667482c798409e3d68340169`.

Cursor binding still precedes filesystem access. Pre-open file checks, noFollow,
pinned-handle identity, reset precedence and short-circuit read order are
preserved. Byte accounting and bounded page/reread/prefix/anchor/boundary reads
are unchanged. Resumption preserves generation/session; resets use the same
hash inputs. Occurrence IDs still bind generation and physical start.

Incomplete ordinary tails remain unconsumed. Oversized fragments advance while
preserving their occurrence start/ID until newline completion. Complete frames
advance the line count once, reset discard state and honor frame-budget limits.
Fatal UTF-8, physical-offset-zero BOM removal, blank/JSON/shape rejection reasons,
original-byte content hashes and accepted-only session changes are equivalent.
The sample and prefix are rechecked before returning a proposed cursor. Scope,
platform/privacy errors and cooperative timeout retain their behavior. New
private progress schemas expose no raw content or weaker final cursor validation.

The reviewer selectively inspected existing UTF-8/CRLF/BOM, restart, oversized
line, frame-budget, foreign-cursor, private-error and sampled-mutation tests.
Execution is owned by the parent and recorded separately. Sampled checks cannot
prove every unobserved rewrite; cooperative timeout is not a hard process limit.

## Backend and shared transport/backup helpers

No actionable semantic regression across all five files versus their exact
pre-refactor snapshots. Original-attempt validation remains before backend I/O:
known attempt, retained page, membership, reconstructed digest/event-set, wire and
scalar decoding, then lookup. The single non-queued permit covers everything
through visibility recording. Missing and mismatch do not establish visibility.
Scalar false/zero/empty values, exact metadata key/value checks, optional managed
keys, name/kind/parent/status, ordered endpoints, strict sub-microsecond tolerance
and identical point-span endpoints retain their semantics.

The shared HTTP helper keeps the deadline on streaming only, then fatal UTF-8
without original causes. Launch remains 8192 bytes/configured timeout inside the
permit and control admission, with oversize/timeout/malformed status 413/503/400.
Maintenance remains 4096 bytes/1000 ms inside its permit and existing 30-second
outer deadline, with status 413/408/400. Schema/destination/command order is intact.

Backup uses the same fixed SQL, reserved connection, decoder and allowlist+1 bound.
Snapshot inspection uses observation_snapshot.sqlite_master and integrity errors;
source inspection uses sqlite_master and configuration errors. Attach/detach,
integrity/configuration checks, capture ordering and publication are unchanged.

Reviewed exact SHA-256 values (parent rechecked):


- `native-readback.ts`: `3eba0593261bc31771dc54583a04a5f44e0f6fe72c876cda85e44817f92a0a08`
- `internal/observation-http-body.ts`: `f8cad40500b97060f07087123db637d2e04ab8a7f14d0f23bdce050ed51d7fa7`
- `observation-launch-http.ts`: `c173247d0ade3132c9a2a35cc3b433e6adbf94c21f06d3184d0817132059f2fe`
- `observation-maintenance-http.ts`: `a5613176a4f7f7e3e1749e7138ca0ac4be9de91a14179fa97abce5faa0b0418a`
- `observation-backup.ts`: `7c448d03aaa47fb681c030c897c027bebf80a87de23d725072edbd11ffdc466f`

Tests were not independently executed by this reviewer. Parent execution evidence
is separate. Recovery and full-goal holds remain in force.
