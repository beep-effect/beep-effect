# Stage 2 release policy

## External contracts

Census recorded 2026-10-09 at `3dbf1090667c46186398d0938da86d9a8bbb93ca`, before note retirement.
All 939 pending notes remain at this census commit; original tree `d839776128c29c6c4cc7c2937329942d873b973c`.

| Contract class | Evidence and outcome | Preserved obligation |
| --- | --- | --- |
| npm publications | All 152 workspace names probed at `https://registry.npmjs.org/<encoded-name>`: 152 HTTP 404; all manifests private. Full per-name result: [d-registry-census.json](d-registry-census.json). | No demonstrated registry publication found; versions and APIs preserved. |
| Registry configuration | `.npmrc` and `bunfig.toml` configure only the `@buf` registry at buf.build. No GitHub package registry configuration. | Existing Buf configuration retained. |
| GitHub Packages | Approved `gh api -i user` route reports scopes `admin:org, gist, repo, workflow`, no `read:packages`. `gh api 'orgs/beep-effect/packages?package_type=npm'` returns HTTP 403: `You need at least read:packages scope to list packages.` Externally blocked, not a negative census. R32 authorizes proceeding with this explicit uncertainty. No credential or scope modification attempted. | Publications there are not established; cleanup changes neither package versions nor public APIs. A scoped query remains external follow-up. |
| External consumer manifests | Unbounded recursive read over `~/YeeBois`, `~/ai`, `~/Documents`, `~/dev`: 61,378 manifests; zero version-pinned `@beep/*` dependencies or `github:`/`git+`/GitHub URLs referencing beep-effect; zero directory read errors. Generated/dependency/cache directories pruned; symlinks not followed. [d-consumer-census.json](d-consumer-census.json) records roots, exclusions and counts. | No demonstrated external manifest consumer found in this scan. Private remote mirrors, inaccessible deploy manifests and runtime consumers are not establishable from local manifests or this token; no assertion of their absence. APIs and versions preserved. |
| Remote tags | `git ls-remote --tags origin`: six evidence tags under `evidence/beep-ci-ops/`, one peeled object; no package version tag. | Evidence tags retained. |
| GitHub release artifacts | `gh release list --limit 100`: empty successful result. | No published release artifact demonstrated; workflows preserved. |
| Desktop tags | Remote tag list has zero `professional-desktop-v*` tags. | Desktop tag/release policy remains separate. |

The scan extends the sweep's projects-only depth-4 census to unrestricted depth
across four workstation roots. Remote private mirrors and deploys remain
**not establishable**: this checkout is not an inventory of off-machine
consumers, and the available token cannot prove all private installations.
No discovered contract authorizes an API or version break in this cleanup.

## Desktop release

Pending E-09 (R35): E owns this anchor's final verification. D does not wait for
that decision to retire internal notes. `.github/workflows/release-desktop.yml`
keeps executable behavior; D changes its explanatory comment only.
Versions are manually bumped in `apps/professional-desktop/package.json` and
`apps/professional-desktop/src-tauri/tauri.conf.json` before a
`professional-desktop-v*` tag. `Cargo.toml`'s 0.0.0 drift is recorded, not aligned;
desktop versioning is separate and this reset preserves every version.

## Baseline and recovery

`standards/changesets.reset-baseline.json` records parent
`da1a85157d7c8cc6b72fe43f12d01389db811ce9`, original changeset tree
`d839776128c29c6c4cc7c2937329942d873b973c`, and all 939 retired notes:
784 package notes, 148 `{}` notes, 7 empty-frontmatter notes. Counts by first-add
month and bump kind are retained with recovery commands. Gate, policy and
retirement land together in one reset commit; no `changeset version` was run.
The orchestrator records the post-merge SHA here (R34).

## Validation

Implementation and note retirement are committed at `ec2080bb68`, with
review repairs on this branch. All version fields remain unchanged from the reset parent; exactly 939 deleted
notes match its enumeration and tree. The D-only manifest diff is empty; the
reset-parent manifest diff contains only the inherited #1564 tinyglobby
dependency addition in repo-cli, not a version change.

Run 2 (after crash): package-verify @beep/repo-cli passed (audit 740.7s,
docgen 24.5s, terminal exit 0). Hosted-parity local commands all pass:
`beep quality test-tsgo`, `beep docgen local --base origin/main`,
`beep ci lane jsdoc-ratchet`, `CI=true beep knowledge refs --check`,
Fallow audit/health, and the serial 316-test scoped coverage run.
Knowledge has zero live gated observations; Fallow has zero introduced
findings, one inherited-adjacent audit advisory, and zero health findings.
The earlier coverage startup collision is superseded by the serial exit 0.
[Scoped coverage](d-coverage-snapshot.json) records all touched baseline rows
and the narrower IssueClassification cohort limitation.

These results cover unchanged source/test content through `ea71d45b54`;
subsequent evidence/report edits change no execution paths. Independent
source/scope review at `3897314253`: zero actionable P0–P3 findings.
The owner-authored #1564/#1565 inherited repairs are merged from main.

Yeet exposed four cache-baseline review references to a retired note.
[Historical evidence](d-cache-review-evidence.md) preserves the original bytes
and digest; `beep cache baseline --request` moved only the four reviews,
with every non-review field unchanged and no qualification granted.
The publication retry follows the evidence repair and an environment-only
16 GiB unit OOM; hosted run/PR evidence is collected after publication.
See the [source review](d-source-review-2026-10-09.md) and
[lane handoff](../handoffs/rsc-d-release-2026-10-09.md).

Full-directory recovery restores historical config and README as well as notes.
Pair it with a revert of the reset policy PR (including the graph guard);
restoring private notes alone fails the current guard. `ls-tree` and `git show`
inspect history without altering the checkout.
