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

### Native fixture namespace setup caused a rejected replay

The Turbo 2.11.5 fixture probe initially used a non-team namespace and failed
with `Protocol outcome omitted output or allowed rejected fallback execution.`
An isolated diagnostic emitted only fixed error labels and reached producer
then replay. The same binary passed all nine cases after changing only the
namespace to a `team_` identifier. The failure is attributed to probe setup,
not a demonstrated client regression. A request preflight documenting the
fixture's native team identifier requirement would have avoided the attempt.
No raw child logs or synthetic credentials were published.

### Exact binary version checks must avoid workspace inference

The retained canary executable reported `2.11.5` when `--version` ran inside
the workspace containing that stable installation. Its unchanged recorded
SHA-256 and a version query from `/` confirmed `2.11.5-canary.2`. The preliminary
probe assertion stopped request creation; no canary observation was accepted.
Version checks now run outside a workspace, while native fixture summaries
still must match the requested exact version. This avoids confusing Turbo's
workspace inference with a changed executable.

## 2026-10-23 — corpus and lab slice

### MinIO community images are gone

`docker pull minio/minio:<release>` answered "pull access denied". MinIO no
longer publishes community images, so the lab store moved to
`versity/versitygw` v1.0.17 by digest. A pinned-image availability check in the
lab script's `up` would have reported this before the first fetch.

### Public digests trip gitleaks' generic-api-key rule

The first commit stopped on seven `generic-api-key` findings: every one was
an OpenAPI blob or SHA-256 digest field (corpus source, run receipts). No lab
bearer was present (checked against each value with `git grep --cached`). A
path- and field-scoped allowlist was added beside the qualification goal's
equivalent one. A repo-wide digest-field allowlist convention would remove
the per-goal entries.

### Runner bearer rule contradicted single-token topologies

`conformance-run` first required four distinct bearers, which no single-token
topology can provide (Bruno alone hands every caller one token). All five
runs failed before any request. The rule now demands distinct bearers only
where the target claims a role split or tenant binding. The target schema
should have carried that rule from the start.

### The incumbent's bucket policy blocks lab teardown

`aws s3 rm` on a lab namespace returned AccessDenied: `DenyObjectAccessOutsideCacheRoles`
denies every object action outside the cache roles, and neither role may
delete. The prepared teardown would have failed at "empty the bucket".
`lab-aws.sh destroy` now removes the bucket policy through the stack first
(`--target` dry run matched exactly that resource). This is also the RC-029
finding: there is no targeted namespace or epoch cleanup.

### Lab ZIP is not the deployed ZIP

`build.sh` from main produced `f865fed9…`; the production artifact path holds
`47fcec56…`. The lab therefore measures main's incumbent source. A recorded
build-input manifest next to each deployed ZIP would let a lab rebuild the
exact deployed bytes.

### The canary client fetch had never run

Every `conformance-native --client canary --fetch-client` run failed with
`Cannot extract package/bin/turbo`. The stable runs had passed only because the
resolver copied the repo-installed stable binary, so the download path was
untested. `@turbo/linux-64` tarballs hold `turbo-linux-x64/bin/turbo`, which I
had seen during the pin refresh. A fetch test against a real pinned tarball
(or a fixture with the real member layout) would have caught it.

### The observed peak was the throttle cap

The envelope rule multiplies the observed peak concurrency, but the observed
read/write peaks (20/10) equal the incumbent's reserved concurrency, and the
production read function logged 25,760 throttles in 30 days. Without the
throttle query, the envelope would have looked representative. Any envelope
derived from a capped system should check throttles and the cap first.

### Native shim tag passthrough is a hidden mode switch

The shim strips `x-artifact-tag` unless `TURBO_REMOTE_CACHE_SIGNATURE_KEY` is
set, never verifies with that value, and then 404s every untagged object. The
first evolved wire run scored total failure because the wire executor wrote
untagged; the runners now tag every write and keep one explicit untagged check.
