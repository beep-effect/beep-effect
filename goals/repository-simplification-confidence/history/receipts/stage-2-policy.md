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
retirement land together in one reset commit; no `changeset version` was run. The orchestrator records the post-merge SHA here (R34).

## Validation

Pending implementation and hosted evidence. Package gates and scoped coverage
will be recorded in the lane handoff. No versions are intentionally changed.
