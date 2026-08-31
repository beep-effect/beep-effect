# `@beep/repo-cli`

CLI tool for creating and managing packages in the beep-effect monorepo following Effect v4 standards.

## Requirements

- **TypeScript 5.9 or Newer**
- **Strict Type-Checking**
- **Bun 1.3.9 or Newer**

## Installation

This is a private workspace package. Use it via:

```bash
bunx @beep/repo-cli <command>
```

## Command Topology

`@beep/repo-cli` uses thresholded command topology. Tiny leaf commands can stay
flat while they have no schemas, services, renderers, or subcommands. Command
groups and role-bearing commands live in `commands/<Group>/`.

Canonical group roles:

- `<Group>.command.ts`: flags, arguments, `Command.make`, and adapter glue.
- `<Group>.schemas.ts`: command option, result, report, and manifest schemas.
- `<Group>.errors.ts`: one exported `<Group>CommandError` for command-boundary
  failures.
- `<Group>.service.ts`: `Context.Service` contract, constructor, and default
  live layer.
- `<Group>.render.ts`: pure human or JSON output rendering when output is
  non-trivial.
- `index.ts`: curated public facade for the command, public schemas/types,
  command error, and service contract.

Optional roles are earned by complexity. Prefer semantic names such as
`<Group>.progress.ts`, `<Group>.paths.ts`, `<Group>.media.ts`, or
`<Group>.plan.ts`; do not add new `<Group>.utils.ts` modules. Use
`<Group>.config.ts` only for typed runtime configuration backed by
`Config`/`ConfigProvider`, and add `<Group>.layer.ts` only for multiple or
non-trivial layer variants.

Command-owned private roles belong under `commands/<Group>/internal/`.
Package-wide shared CLI support belongs under `src/internal/cli/`, not a
package-local `foundation/` directory. Keep command services free of final
terminal rendering: services return typed results/reports, command adapters
render output and choose process-visible failure semantics.

Public imports are explicit: use `@beep/repo-cli` or
`@beep/repo-cli/commands/<Group>`. Deep role files are private. Package tests
that need internal seams use source-only `@beep/repo-cli/test/<Group>` aliases;
those aliases are not package exports.

## Commands

### `architecture`

Create and verify canonical architecture parts through a schema-versioned
operation plan.

```bash
bun run beep architecture plan > /tmp/architecture-plan.json
bun run beep architecture check --file /tmp/architecture-plan.json
bun run beep architecture apply --file /tmp/architecture-plan.json
```

Ergonomic wrappers write by default and expose the same JSON plan with
`--dry-run`:

```bash
bun run beep architecture create slice architecture-lab WorkItem --stage core --dry-run
bun run beep architecture create package research-lab domain --dry-run
bun run beep architecture add concept architecture-lab WorkItem --stage persistence --dry-run
bun run beep architecture add role architecture-lab WorkItem server --stage full --dry-run
bun run beep architecture add concept architecture-lab Worker --domain-kind entities --stage persistence --dry-run
bun run beep architecture add concept architecture-lab WorkPriority --domain-kind values --stage core --dry-run
```

The factory is core-first: `create slice` defaults to domain, use-cases, and
server. Add config, tables, protocol handlers, client, UI, proof-app, and
db-admin targets through explicit stages or role commands.

`create package` is the architecture-native package shell command for normal
slice roles. It supports `domain`, `use-cases`, `config`, `server`, `tables`,
`client`, and `ui`, and intentionally does not create concept modules. Use
`add concept` or `add role` for concept-qualified files after the role package
exists. The older top-level `create-package` command remains a compatibility
surface for non-architecture scaffolding.

Supported domain-kind archetypes are:

- `aggregates`: full canonical slice topology, proven by
  `aggregates/WorkItem`.
- `entities`: persisted domain entity topology through use-cases, server,
  tables, and db-admin migration files, proven by `entities/Worker`.
- `values`: domain-only value-object topology, proven by
  `values/WorkPriority`.

The JSON operation-plan schema stays `architecture-operation-plan/v1`; domain
kind changes select different accepted proof files and reject roles that do not
belong to that archetype.

### `create-package`

Create a new package or app workspace following repo topology rules.

```bash
bunx @beep/repo-cli create-package <name> [--type=library|tool]
bunx @beep/repo-cli create-package <name> --type=app --app-kind=nextjs
bunx @beep/repo-cli create-package <name> --type=app --app-kind=tauri
bunx @beep/repo-cli create-package <name> --type=app --app-kind=runtime-proof
```

`--type app` requires `--app-kind`. `nextjs` and `tauri` generate framework
apps without a public `@beep/<app>` TypeScript package API: no `src/index.ts`,
package exports or docgen. Use app-local `@/*`
imports for tests and internal modules. `runtime-proof` is the explicit
exception for app workspaces that intentionally prove runtime package contracts;
it keeps the package-like scaffold.

### `codegen`

Generate barrel file exports for a package.

```bash
bunx @beep/repo-cli codegen [package-dir]
```

### `quality package-verify`

Run package-local `beep:lint`, `beep:check`, and `beep:test` scripts in
parallel for a single workspace package. `--quick` runs lint and check only.
When no package argument is provided, the command uses the current Git working
tree to auto-detect exactly one changed package.

```bash
bun run beep quality package-verify @beep/repo-cli
bun run beep quality package-verify --quick @beep/repo-cli
bun run pkg:verify @beep/repo-cli
bun run pkg:verify:quick @beep/repo-cli
```

The root `pkg:verify` aliases point at this command; their implementation lives
inside `@beep/repo-cli`, not in repository-level scripts.

### Root Quality Aliases

Root quality scripts such as `lint`, `lint:fix`, `check`, `test`, `build`, and
`audit` are thin aliases into `beep-cli`. The `lint:fix` alias uses
`beep-cli lint --fix`; for an unscoped clean working tree it exits before the
full command tree loads, and for changed files it applies Biome only to the
changed file set. Use `bun run lint:fix --full` or `bun run lint:fix --repo`
when the aggregate Turbo `lint:fix` lane is required. Root lint Turbo lanes add
`--concurrency=3` by default to avoid saturating local machines with many
parallel package-level Biome workers; pass an explicit `--concurrency` value
when a different bound is needed.

Use `bun run beep lint policy` for the repo-wide policy gates without the
aggregate Turbo lint lane. It runs the law, allowlist, schema/reflection,
docgen, spelling, circularity, tagged-error, clone, and typos checks that must
stay advisory-free locally and in CI.

### `docgen quality`

Produce a report-only JSDoc quality review for exported symbols. The command
does not block on advisory findings; use `--score codex` when you want bounded
remediation packets for follow-up documentation work. Package-local runs write
`JSDOC_QUALITY.md` or `JSDOC_QUALITY.json` by default; use `--output` for a
scratch destination. Reports use schema v2 package status fields, so a
time-bounded package can appear as `partial` without discarding the rest of the
run. Codex packets are ranked and capped at 25 per run by default; use
`--packet-limit` to widen the work queue or `--packet-limit 0` to suppress it.

```bash
bun run beep docgen quality -p packages/shared/domain -o /tmp/jsdoc-quality.md
bun run beep docgen quality --changed-files --json
bun run beep docgen quality --all --score codex --packet-limit 25 -o /tmp/jsdoc-quality.json
```

### `ai-metrics`

Run repo-local AI-agent analytics workflows for transcript ingest, Phoenix
install proofs, OTLP export, benchmark scoring, labeling, reports, and P7
operator workflows.

Every `ai-metrics` subcommand resolves its data root by precedence:

| Rung | Source | Value |
| --- | --- | --- |
| 1 | `--data-root` | The flag value, used verbatim |
| 2 | `BEEP_AI_METRICS_DATA_ROOT` | The environment value, used verbatim |
| 3 | `--target dankserver` with neither of the above | `/srv/data/ai-metrics` |
| 4 | otherwise | `${XDG_STATE_HOME:-$HOME/.local/state}/beep/ai-metrics` |

The canonical store therefore lives outside every clone, and `forwarder timer`
refuses to render a systemd unit unless the resolved root is absolute — a
relative root inside a unit binds to `WorkingDirectory`, which is how the store
previously ended up inside whichever clone the collector happened to run in.

The P7 mirror commands build and inspect sanitized derived mirror bundles. A
sync is a dry-run by default and requires `--confirm p7-derived-mirror` before
it writes to the remote mirror root.

```bash
bun run beep ai-metrics mirror build --target dankserver --data-root "$BEEP_AI_METRICS_DATA_ROOT" --json
bun run beep ai-metrics mirror sync --bundle latest --json
bun run beep ai-metrics mirror status --json
```

The P7 retention commands are local-first. `list` and `restore-drill` are proof
workflows; `delete` and `compact` are dry-run previews unless the command also
has an explicit retention window and `--confirm p7-retention-window`.

```bash
bun run beep ai-metrics retention list --data-root "$BEEP_AI_METRICS_DATA_ROOT" --json
bun run beep ai-metrics retention restore-drill --data-root "$BEEP_AI_METRICS_DATA_ROOT" --restore-root /tmp/ai-metrics-restore --before 2026-05-16T00:00:00Z --json
bun run beep ai-metrics retention delete --data-root "$BEEP_AI_METRICS_DATA_ROOT" --before 2026-05-16T00:00:00Z --json
bun run beep ai-metrics retention compact --data-root "$BEEP_AI_METRICS_DATA_ROOT" --before 2026-05-16T00:00:00Z --json
```

### `files`

Curate direct image and video files for dataset preparation. From the repo root,
prefer the workspace shortcut:

```bash
bun run files <subcommand> [options]
```

The package binary works the same way:

```bash
bunx @beep/repo-cli files <subcommand> [options]
```

Except for `flatten-media` and an explicitly recursive `match-person` run,
`files` subcommands work on direct children of `--dir`; they do not recurse
into nested directories.

#### `files match-person`

Find photos containing one target person using a trusted directory of
single-person reference photos. Matching stays on the workstation and never
writes raw face embeddings to disk. On Linux x64, the default backend combines
InsightFace's `det_10g` face detector with DFA MobileNet alignment and CVLFace
AdaFace ViT-Base KP-RPE recognition. Linux arm64, macOS x64/arm64, and Windows
x64 hosts default to the InsightFace Buffalo CPU backend. Other host/architecture
pairs, including Windows arm64, fail before cache or model acquisition because
the frozen environment has no complete wheel set for them. Explicit AdaFace
selection outside Linux x64 fails at the same preflight boundary.

```bash
bun run beep files match-person \
  --references ./known-person \
  --dir ./mixed-photos \
  --manifest ./person-match.json \
  --out-dir ./person-match-output \
  --compute rocm \
  --devices 0 \
  --accept-model-license
```

The source projects use MIT licenses, but their checkpoints also carry model
and training-dataset terms. Review the pinned
[DFA MobileNet](https://huggingface.co/minchul/cvlface_DFA_mobilenet/tree/8317e6dda53d91e7074979923144c2cc08906a33),
[AdaFace KP-RPE](https://huggingface.co/minchul/cvlface_adaface_vit_base_kprpe_webface12m/tree/daefd5012d369588bd214fbaf4cc6b1d286e7066),
and [InsightFace detector](https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md)
terms before passing `--accept-model-license`. The flag records the caller's
confirmation; it does not grant or change a license.

On Linux x64, the first AdaFace run creates a pinned Python 3.12 environment
and downloads the hash-verified aligner and recognizer into
`${XDG_CACHE_HOME:-$HOME/.cache}/beep/photo-face`. The AMD runtime also needs a
compatible `libhipsparselt.so.0`. Install the matching ROCm `hipsparselt`
package, or set `BEEP_PHOTO_FACE_ROCM_LIBRARY_PATH` to the one directory that
contains that library. An explicit `--cache-dir` moves the isolated environment
and model cache. Set `BEEP_UV_PATH` to an absolute trusted `uv` executable when
it is not installed in a standard system location or `$HOME/.local/bin`.

`--devices` accepts at most one non-negative ROCm device index. A worker uses
one GPU; run separate workers with different device indices to use multiple
GPUs. `--compute rocm` fails closed if the requested GPU or pinned runtime is
unavailable. `--compute auto` may fall back to CPU and records that fallback in
the manifest.

References must contain exactly one detected face. Use several clear photos
covering different ages, expressions, lighting, eyewear, and hair styles. A
candidate image is scored against a robust aggregate of all accepted reference
faces; cosine similarity scores are model-specific measurements, not
probabilities. The precision-first defaults are `0.50` for a match and `0.35`
for the lower review boundary. Calibrate those thresholds against a labeled
sample from the actual library before relying on a large scan.

The scanner includes JPG/JPEG, PNG, and WebP files. Other formats, including
HEIC and TIFF, are skipped and therefore do not appear in manifest totals;
normalize or convert them first when they need to participate in the scan.

The source library is immutable. `--out-dir` only copies useful candidates into
reviewable buckets while preserving their relative paths:

| Bucket | Meaning |
| --- | --- |
| `accepted/` | One confident target face and no quality warning |
| `group-review/` | The target appears with one or more other faces |
| `quality-review/` | The target matches, but its face is small, blurry, dark, bright, or strongly turned |
| `identity-review/` | Similarity falls between the review and match thresholds |

No-match, no-face, and unreadable images remain only in the manifest; unreadable
entries include a reason and are counted separately from images where face
detection ran successfully but found no face. Copies and the manifest are
staged first, committed one file at a time without partial file contents, and
rolled back together after handled in-process commit failures. An incomplete
rollback reports the retained recovery directory; the operation is not a
crash-consistent filesystem transaction. Existing manifest or copied files are
preserved unless `--overwrite` is supplied. The manifest, output, and cache
paths must not overlap. Do not mutate the candidate, reference, output, or
manifest paths concurrently with a run. Add `--recursive` to scan nested
candidate and reference directories. Accepted recursive reference photos must
have unique file names so per-face evidence is unambiguous. Add `--json` to
print the schema-versioned report after writing it.

This is target-person verification, not a claim of Google Photos parity.
Google can combine proprietary models and contextual album signals that are
not available to a face-only open pipeline. For personal dataset curation,
multiple trusted references plus a human-review band is the safer operating
model.

#### `files flatten-media`

Recursively move image and video files into one flat output directory while
leaving non-media files and source directories in place.

```bash
bun run files flatten-media --dir ./dataset/raw --out-dir ./dataset/media --dry-run
bun run files flatten-media --dir ./dataset/raw --out-dir ./dataset/media
```

Existing output files are preserved. Name collisions are checked
case-insensitively and use numeric suffixes such as `_01` and `_02`. Use
`--dry-run` to print the complete move plan without creating the output
directory or moving files. If a move fails, completed moves are restored; a
newly created output directory may remain empty.

Do not modify the source or output tree concurrently while this command runs.

#### `files sort-and-rename`

Sort direct files by size, largest first, then rename them with a generated
prefix and zero-padded index.

```bash
bun run files sort-and-rename --dir ./tmp --prefix image --dry-run
bun run files sort-and-rename --dir ./tmp --prefix image
```

Output names use `<prefix>_<index>.<ext>`. The index width grows with the number
of selected files, so 7 files use `00`, 50 files use `000`, and 100 files use
`0000`.

Use `--with-dimensions` to append probed media dimensions:

```bash
bun run files sort-and-rename --dir ./tmp --prefix image --with-dimensions
```

With dimensions enabled, names use
`<prefix>_<index>_<width>x<height>.<ext>`, for example
`image_00_1024x1536.png`. Non-media files are left untouched. Video dimensions
require `ffprobe`.

#### `files strip-metadata`

Strip metadata from direct image and video files in place.

```bash
bun run files strip-metadata --dir ./dataset/images --dry-run
bun run files strip-metadata --dir ./dataset/images
```

Images are normalized through `sharp`; videos are rewritten through `ffmpeg`.
This command rewrites selected files in place, so run with `--dry-run` first
when working on irreplaceable sources.

#### `files normalize`

Normalize direct image files into a separate output directory and write a
transform manifest.

```bash
bun run files normalize \
  --dir ./raw \
  --out-dir ./dataset/images \
  --format png \
  --max-long-edge 1024
```

`normalize` applies EXIF orientation, strips metadata, converts format, and can
downscale the long edge without upscaling smaller images. Supported output
formats are `png`, `jpg`/`jpeg`, and `webp`; `png` is the default. The command
preserves source stems (`foo.jpg -> foo.png`) and resolves same-run collisions
as `foo.png`, `foo_01.png`, `foo_02.png`.

Useful options:

- `--manifest <path>` writes the manifest somewhere other than
  `--out-dir/normalize-manifest.json`.
- `--overwrite` allows replacing existing outputs, duplicate move targets, and
  the manifest.
- `--dry-run` prints the plan without creating directories or writing files.
- `--dedupe` skips later files whose normalized output bytes exactly duplicate
  an earlier output.
- `--move-duplicates-to <dir>` enables exact-byte dedupe and moves duplicate
  source files into the provided directory.

The manifest has schema version `beep.files.normalize.v1` and records source
paths, output paths, byte sizes, dimensions, hashes, skipped sources, duplicate
relationships, and summary counts.

#### `files create-captions`

Create same-stem `.txt` caption sidecar files for direct image files.

```bash
bun run files create-captions --dir ./dataset/images --dry-run
bun run files create-captions --dir ./dataset/images
```

By default, existing caption files are preserved and skipped. Use `--caption` to
seed newly created sidecars with shared text, such as a trigger token or class
phrase:

```bash
bun run files create-captions \
  --dir ./dataset/images \
  --caption "my_character, person"
```

Use `--overwrite` only when you intentionally want to replace existing caption
files with the provided `--caption` text, or with empty files when `--caption` is
omitted.

#### `files archive-poor-candidates`

Move obvious poor image candidates out of a dataset directory and write an
archive manifest.

```bash
bun run files archive-poor-candidates \
  --dir ./dataset/images \
  --archive-dir ./dataset/rejected \
  --dry-run
```

By default, the `character-lora` profile archives images that fail any of these
thresholds:

- shorter edge below `--min-short-edge` (`512` by default)
- aspect ratio above `--max-aspect` (`3` by default)
- estimated upscale to `--target-resolution` square area above `--max-upscale`
  (`1024` target resolution and `1.5` max upscale by default)

Same-stem `.txt` sidecars move with archived images by default. Use
`--sidecars none` to leave sidecars in place, or pass a comma-separated list such
as `--sidecars txt,json`. The manifest defaults to
`--archive-dir/archive-poor-candidates-manifest.json`; use `--manifest` to
choose another path and `--overwrite` to replace existing archive targets or the
manifest.

#### `files detect-borders`

Detect solid or near-solid canvas borders in direct image files.

```bash
bun run files detect-borders --dir ./dataset/images
bun run files detect-borders --dir ./dataset/images --json
```

Tune detection with:

- `--tolerance` maximum RGB channel distance from the sampled edge color
  (`12` by default)
- `--min-solid-pct` minimum matching pixels in a border row or column
  (`98.5` by default)
- `--min-width-pct` minimum detected border width (`1` by default)
- `--max-scan-pct` maximum percent of each dimension to scan from an edge
  (`45` by default)

`--json` emits a `beep.files.detect-borders.v1` report.

#### `files crop-borders`

Crop detected solid or near-solid borders from direct image files in place.

```bash
bun run files crop-borders --dir ./dataset/images --dry-run
bun run files crop-borders --dir ./dataset/images
```

`crop-borders` uses the same tuning flags as `detect-borders`. It rewrites
selected images in place, so use `--dry-run` before applying crops to a dataset.

### `image`

Curate videos for image datasets.

```bash
bun run beep image extract-frames --video ./clip.mp4 --out-dir ./frames --fps 1
bun run beep image extract-frames-dir --dir ./videos --fps 1
```

`extract-frames` writes PNG frames plus
`extract-frames-manifest.json` by default. Use `--manifest` to choose another
manifest path, `--prefix` to override the generated frame prefix, and
`--overwrite` to replace existing outputs.

`extract-frames-dir` processes direct video files only. Each source writes to a
sibling directory named after its stem, and same-stem videos fail during
preflight before extraction begins.

### `sync-data-to-ts`

Sync checked-in generated TypeScript data modules from official upstream sources.

```bash
bunx @beep/repo-cli sync-data-to-ts --target iso4217
bunx @beep/repo-cli sync-data-to-ts --all
bunx @beep/repo-cli sync-data-to-ts --all --check
```

### `docs`

Discover repository laws, skills, and policy gates through command-first output.

```bash
bunx @beep/repo-cli docs laws
bunx @beep/repo-cli docs skills
bunx @beep/repo-cli docs policies
bunx @beep/repo-cli docs find <topic>
```

### `quality`

Run repository operational quality lanes that are not package-local Turbo tasks.

```bash
bun run beep quality github-checks quality
bun run beep quality github-checks repo-sanity
bun run beep quality bun-audit
bun run beep quality test-tsgo
bun run beep quality tsgo-smoke
bun run beep quality tsgo-rules
bun run beep quality jsdoc-module-tags
bun run beep quality jsdoc-inventory
bun run beep quality changeset-graph
```

### `yeet`

Run the canonical End-to-End Green operator path: deterministic repair, full
local proof, reviewed commit, push, hosted PR check monitoring, and merge
readiness.

```bash
bun run beep yeet repair
bun run beep yeet verify
bun run beep yeet publish --message "type(scope): summary"
bun run beep yeet monitor
```

`repair` runs deterministic write steps: changed-file lint fixes, local docgen,
and affected feedback. Affected test feedback is scoped to the unit lane;
integration stays in the full proof. `verify` runs the canonical full
local `quality github-checks pre-push` proof without
duplicate affected feedback first. `publish` requires reviewed staged changes,
commits them, runs the same `pre-push` proof against the new local commit, and
pushes only after that proof passes. `monitor` watches hosted PR checks for the
current branch. Bare `yeet --message ...` remains a publish alias.

Use `--plan --json` on any mode to inspect the planned steps without running
them. `publish --fast --monitor` is an explicit PR-branch-only exception for
cases where hosted PR checks replace the local full pre-push wait; the normal
`publish --message` path remains the default. `bun run audit:github pre-push`
remains the named full local fallback for secrets, security, SAST, Nix, and
manual proof outside Yeet. If Yeet passes locally but the PR fails in GitHub
Actions, treat that as a Yeet/quality parity bug or environment drift unless
the failure is clearly an external outage.

### `ci`

Render CI helper output from checked-in repo automation.

```bash
bun run beep ci append-turbo-summary
bun run beep ci append-turbo-summary .turbo/runs/latest.json
```

### `codex`

Launch Codex helper workflows from repo-owned prompts.

```bash
bun run beep codex quality-review-fix-loop "close the current initiative"
```

## License

MIT
