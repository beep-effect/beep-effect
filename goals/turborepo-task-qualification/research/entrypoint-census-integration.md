# Source-reviewed executable census

`beep cache census --entrypoint-review <request.json>` now joins the existing
workspace/configuration census to its reviewed CI, Quality, Yeet, workflow and
nested-command source artifacts. An ordinary census still reports its
outstanding interpretation obligations. The optional attachment has explicit
`source-review-only` authority and preserves those obligations.

The request must bind every source in the current census. It also binds the
additional planner/interpreter/recipe files and authored reviews used here.
Cache rejects a missing or changed census source, duplicate paths, absent
document families, changed referenced bytes, symlink traversal, oversized
files, invalid UTF-8/JSON or a mismatched document version. It retains each
complete parsed JSON object and the digest of the original bytes. It does
not project away environment maps or unfamiliar producer fields.

The attachment validates integrity, JSON syntax and the version envelope.
The producing recipes retain the full CI/Quality/Yeet schemas; the workflow
recipe retains complete parsed YAML. Cache does not become a second planner,
workflow interpreter or proof authority. No attached command is executed and
no source node or planned scenario counts as an observed execution.

The current attachment uses separate local and hosted-context planner
snapshots. The refreshed Yeet plans contain the repaired quiet identity lint
script. Earlier snapshots and their launch-time checkpoints remain historical.
The planner recipes now accept an optional output path so refreshing evidence
does not overwrite those earlier snapshots. Their planning logic is unchanged.

To reproduce from the repository root, first collect
`.beep/qualification-local-preflight/census-after-quiet-lint.json` with
`bun run beep cache census --output <path>`. Run the CI/Quality and Yeet
recipes twice each with a clean environment: `env -i PATH="$PATH"
HOME=/nonexistent bun --no-env-file <recipe> <output-name>` for local context;
add `CI=true GITHUB_ACTIONS=true` for hosted context. Output names are
`entrypoint-plans-current.json`, `entrypoint-plans-hosted-current.json`,
`yeet-plans-current.json` and `yeet-plans-hosted-current.json`.

Run `refresh-command-groups.py <census-path> --output <packet-research-path>/command-groups-current.json`.
The workflow snapshot remains the existing source-bound file; regenerate it
with `refresh-workflow-sources.ts` when its inputs change. Then run
`bun --no-env-file goals/turborepo-task-qualification/research/refresh-entrypoint-review.ts <census-path>`
and pass the resulting `entrypoint-review-request.json` to the census command.
The attachment rejects drift observed between the reviewed census and the
new command invocation.

Focused tests verify stale source/review/artifact rejection, missing families,
duplicate references, symlinks, malformed data and full document preservation.
A schema-derived property sends arbitrary JSON fields through real bounded
file reads and the attachment operation. Package and live integration results
are recorded in the adjacent checkpoint; unfinished checks remain explicit.

Nested interpreter coverage, candidate runtime read/write/capture evidence,
signed replay, representative shadow decisions and fresh hosted authority
remain required by the goal. This integration does not satisfy those gates.
