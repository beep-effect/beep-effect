# Runtime closure freezes

`freeze-runtime-closure.py` captures a conservative static dependency closure of
the actual `inspection-tool.main.ts` entrypoint using the installed Bun build
resolver. It does not execute the entrypoint or make source requests. Historical
freezes, results, scorer files and source/reference selections remain unchanged.

Create a **new** private archive using the latest accepted implementation freeze
as its baseline. Run from the checkout that will perform the evaluation:

```sh
python goals/claim-check-performance/research/freeze-runtime-closure.py \
  --baseline goals/claim-check-performance/research/implementation-colon-scope-002.json \
  --out /absolute/private/fresh-runtime-closure
```

The baseline supplies the original file set and metadata; it is archived intact.
Original lockfile, Bun version, scorer, preservation and usefulness bindings must
still match. A stale baseline whose immutable bindings differ is refused rather
than silently updated. The independent preservation verifier must also pass.
Use the actual latest accepted baseline for later candidates; the example is
not an instruction to replace a newer accepted baseline.

When accepted main changes dependency metadata, retain every historical freeze
and lock. `implementation-accepted-main-metadata-001.json` is a separate
prospective baseline for the accepted #2686/#2511 metadata changes. It inherits
all file pins from the integrated-policy freeze, changes only its active lock
pin, and adds exact pins for the archived previous lock, admission document and
previous baseline. The admission binds accepted revisions and affected package
manifests; independent metadata comparison verifies unchanged external package
resolutions, versions, catalog, overrides and patches. The old closure is
historical provenance, not a current execution claim. The capture tool's
immutable-binding checks remain unchanged and a fresh installed capture,
verification and actual cohort replay are still required before measurement.

The build uses `target: bun`, bundled packages, an object metafile, disabled tree
shaking, ignored DCE annotations, and `allowUnresolved: []`. It sets `write:false`
and omits `outdir`, retaining build outputs in memory. In installed Bun 1.4.4,
`write` is not a declared `BuildConfig` key; omission of `outdir` is the supported
no-output behavior. Some barrel exports are nevertheless reported as external
file edges. The tool resolves them and adds them as build entrypoints until the
closure converges. An unresolved non-builtin edge or build diagnostic fails the
capture. Node/Bun builtin imports are recorded separately.

Every metafile input is hashed from its actual bytes. The capture also includes
the baseline file set, ancestor package/compiler metadata, root compiler
overlays, original source/reference freeze documents and this capture tool.
`Xml.ts` and the runner are mandatory inputs. Installed dependency bytes are
captured as well as the original lockfile: an installed source modification
cannot hide behind an unchanged lockfile. Logical dependency paths remain
usable in the originating checkout; the archive's content-addressed blobs
retain exact bytes independently of those paths.

Two builds and a final byte comparison detect changes during capture. The
implementation digest is SHA-256 over canonical sorted JSON excluding only its
own `implementationDigest` field. There are no timestamps or output-directory
names in that digest. `baseline-freeze.json`, `build-metafile.json` and
`blobs/<sha256>` preserve the exact evidence. Existing output directories are
always refused, including partial failed captures.

The native Bun executable is resolved by running
`bun --eval 'console.log(process.execPath)'` in the evaluation checkout. Its
actual path and byte hash are pinned, alongside the Bun version. Resolving the
PATH launcher with `which` is insufficient: a launcher such as vite-plus may
dispatch a different native executable.

Verify the manifest, current files, archived blobs and native Bun identity
immediately before running a new evaluation:

```sh
python goals/claim-check-performance/research/freeze-runtime-closure.py \
  --verify /absolute/private/fresh-runtime-closure/implementation-freeze.json
CLAIM_IMPLEMENTATION_FREEZE=/absolute/private/fresh-runtime-closure/implementation-freeze.json \
CLAIM_EVALUATION_OUTPUT=/absolute/private/fresh-evaluation \
  bun packages/law-practice/server/test/evaluation/inspection-tool.main.ts
```

The runner checks every implementation file with `readFile` and SHA-256 before
predicting any family. New manifests additionally verify the executing Bun
version and hash the native executable at `process.execPath` inside the runner,
so native identity verification does not depend on a separate caller step.
Historical manifests without runtime-closure metadata remain accepted. Gold and source XML continue to
use the existing `verifiedText` function; byte hashing changes only
implementation verification. Evaluation output directories remain exclusive.

The negative proof modifies a **scratch copy** of the captured XML decoder,
places a binary input with its correct byte hash before that decoder, and
invokes the real runner against the altered file list:

```sh
python goals/claim-check-performance/research/freeze-runtime-closure.py \
  --negative-test /absolute/private/fresh-runtime-closure/implementation-freeze.json \
  --out /absolute/private/fresh-negative-proof
```

Success requires rejection at the changed scratch decoder, successful binary
verification before it, no evaluation-output directory, and an unchanged real
decoder. This tests the pre-prediction verification boundary; it is not an
evaluation score or a new reference annotation. The negative manifest is
deliberately invalid and must never be used for measurement.

## Coverage limits

This is the installed Bun **static module closure**, not a trace of executed
branches or a claim to capture every possible runtime input. Bundler semantics
can differ from unbundled module evaluation, so external file edges are expanded
conservatively. Computed imports rejected by Bun are a stop condition. Arbitrary
filesystem reads, network payloads, native runtime assets, environment variables,
process flags and operating-system libraries are not inferred by the bundler.
The runner's separately frozen source/reference inputs remain their own proof.
Builtin behavior is identified by Bun version, executing native path and native
executable byte hash, plus platform;
the executable and operating-system libraries are not archived as module inputs.
Record the actual evaluation command and relevant non-secret environment choices
with its receipt. A dependency missing from this static model requires a
separate explicit pin before claiming coverage for that dependency.

Earlier freezes that omitted the XML decoder cannot retroactively establish
historical live byte identity. Comparing Git-recorded decoder versions can show
that those revisions agree; it cannot prove the absence of unrecorded working
tree changes during past runs. Preserve those receipts and bind fresh
measurements to a new closure rather than rewriting their provenance.

Accepted main also retires 88 citation modules included by the previous static
closure. The first new capture failed before prediction on their missing paths.
`implementation-accepted-main-metadata-002.json` retains baseline001 and maps
exactly those retired non-reference sources into a byte-preserving archive.
Each archived base64 payload reconstructs its old source hash; deletion
provenance is bound to accepted main. All remaining inherited pins and immutable
checks stay unchanged. The new build must discover every current replacement
module independently; historical archived sources are not executed or presented
as current dependencies. Failed capture001 remains retained.

Baseline003 additionally binds the independently reviewed preservation verifier
and its adversarial tests, archiving their exact prior bytes. Capture002
correctly refused their old immutable pins before prediction. The generated
metadata addendum and both historical/active manifest versions are explicit new
pins. Capture immutable checks remain unchanged; no stale historical source
hash is silently replaced in an old manifest. All three prospective baseline
versions and both pre-prediction failures are retained.
