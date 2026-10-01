# Friction and opportunities

Record friction as it occurs: work, minimum
command/error/file evidence, impact, prevention and owner/disposition.
Redact secrets, use portable paths, omit machine/session IDs and keep raw logs
in bounded artifacts.

Historical leads remain in the [exploration ledger](../../../explorations/turborepo-quality-cache/research/OPPORTUNITIES.md)
and [opportunity disposition](../../../explorations/turborepo-quality-cache/research/opportunity-disposition.md).
Refresh historical claims before treating them as current.

### Native signed probe: tenant selector preflight

The first bounded local signed probe executed its producer successfully but all
wire requests received 403: the fixture required `teamId`, while the client
was configured through `TURBO_TEAM`. Reader fallback was intentionally denied,
so apparent task success could not count as a hit. The probe assertion rejected
this attempt. Retained the attempt privately and moved the explicit team id to
the per-fixture `.turbo/config.json`. Validate the emitted selector before
interpreting signature cases; a command's zero exit is not upload acceptance.

### Architecture generator routing for CLI schema roles

Before adding the Cache protocol receipt role, the architecture dry-run rejected
`schemas` as an architecture role. That generator models slice roles; the
non-slice CLI command topology explicitly names `.schemas.ts` and earned
semantic roles. Kept the implementation in the existing Cache command group,
following that topology, rather than generating an unrelated domain slice.
A command-group role planner would remove this routing ambiguity.

### Nonempty-array guard narrowed valid observations to never

The first protocol-validator package check failed with TS18046 and TS2488.
`Array.some` narrows its argument to a nonempty array; testing it in a rejection
branch made the remaining path impossible for an already nonempty schema field.
Use `!Array.every` for the same-client obligation. The corrected standalone
package type check passes; the full package handoff is being rerun. Focused
runtime tests alone did not catch this type-level regression, so retain the
package type check before integration.

### Owned fixture native-client calibration

The first scoped-driver launch lacked the filesystem service while constructing
the scheduler layer. Provide the dependent scheduler layer before the platform
layer, as in the existing admitted experiment wrappers. No native case ran.
The first admitted native invocation then reported zero successful tasks with
exit zero because `--skip-infer` disabled single-package inference in this tiny
root fixture. The explicit one-task assertion rejected it. Retained the failed
attempt and used the pinned executable with inference inside the minimal mount,
which contains no alternate installed Turbo. A subsequent parser check exposed
that a MISS summary omits `cache.source`; preserve that absence instead of
indexing it as a required field. Only a HIT with explicit REMOTE source can pass.
These are calibration failures, not accepted producer/replay evidence.

### Attribute auxiliary wire failures outside the six artifact cases

Both native clients pass the six owned-server artifact cases, but sanitized
request evidence also shows two 400 responses outside those selected exchanges.
The pinned client source sends optional analytics to `/v8/artifacts/events`;
the initial fixture routes that suffix through artifact-key validation. Keep
these auxiliary responses visible, classify optional routes explicitly, and
rerun the native clients after that correction. Six selected passing exchanges
do not establish a clean full protocol corpus. This is an introduced fixture
routing gap, not a production backend result.

### Documentation gates before a repeated package audit

The owned fixture passed the full CLI audit (683.2 seconds), then docgen rejected
two exported type aliases without their own descriptions and `@since` tags.
Added the alias documentation and corrected a LiteralKit guard example to use
its per-literal guard. `docgen:local` could not run the edit loop because the
branch's lockfile/root manifest differences require a full proof. Used the CLI
package's own docgen command to check this correction before repeating package
verification; final root docgen remains part of final Yeet proof. Check exported
aliases and executable examples before paying for the full audit again.

## 2026-09-29 — owned runner exposed an untested serialization boundary

The first public `cache protocol-run` reached its worker but failed decoding
`events[0].artifact` with `Expected Option`. In-memory fixture events used
`S.Option`, while the cross-process report needed a JSON codec. Changed those
fields to `S.OptionFromNullOr` and added an encode/decode round-trip assertion;
both pinned clients then passed through the CLI. The earlier fixture tests only
encoded events, which did not prove they could be read back.

Type checking also rejected the private harness's unsupported `timeout` option
on `runCapturedStreams`. The owned runner uses scoped `Effect.timeout` for
120-second native cases and a 15-minute supervisor deadline. Private probe
results remain scoped to their actual controls; no stronger timeout guarantee
is retroactively assigned to them.
