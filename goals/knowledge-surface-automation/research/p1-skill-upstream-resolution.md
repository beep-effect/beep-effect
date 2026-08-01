# P1 skill upstream resolution

Resolved 2026-08-01 against GitHub `main` using repository/commit, tree, contents,
license, and path-filtered commit APIs. Local comparisons cover the complete installed
skill directories, including reference files, adapters, eval data, and binary assets—not
only the locked `SKILL.md` path.

For the five entries already marked `github`, “proposed pinned commit” follows the task's
rule: use the newest commit whose complete skill tree matches the installed tree; if none
matches, use current `main` plus local patches. For the three `repo-local` suspects, the
proposed pin is the strongest reconstructable historical origin base; their current local
changes become the initial patch series.

## Summary

| skill | sourceType today | upstream repo | path | proposed pinned commit | license | drift | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `grill-me` | `github` (`main`) | [`mattpocock/skills`](https://github.com/mattpocock/skills) | `skills/productivity/grill-me/` | [`2ab958093e83e0ec752e6c1c5932da465bf23e0c`](https://github.com/mattpocock/skills/tree/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/productivity/grill-me) | MIT, `LICENSE` | Exact current tree, 2/2 files | high |
| `teach` | `github` (`main`) | [`mattpocock/skills`](https://github.com/mattpocock/skills) | `skills/productivity/teach/` | [`2ab958093e83e0ec752e6c1c5932da465bf23e0c`](https://github.com/mattpocock/skills/tree/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/productivity/teach) | MIT, `LICENSE` | Exact current tree, 6/6 files | high |
| `ponytail` | `github` (`main`) | [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) | `skills/ponytail/` | [`16f29800fd2681bdf24f3eb4ccffe38be3baec6b`](https://github.com/DietrichGebert/ponytail/tree/16f29800fd2681bdf24f3eb4ccffe38be3baec6b/skills/ponytail) | MIT, `LICENSE` | Exact current tree, 1/1 file | high |
| `ponytail-review` | `github` (`main`) | [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) | `skills/ponytail-review/` | [`16f29800fd2681bdf24f3eb4ccffe38be3baec6b`](https://github.com/DietrichGebert/ponytail/tree/16f29800fd2681bdf24f3eb4ccffe38be3baec6b/skills/ponytail-review) | MIT, `LICENSE` | Exact current tree, 1/1 file | high |
| `shadcn` | `github` (`main`) | [`shadcn-ui/ui`](https://github.com/shadcn-ui/ui) | `skills/shadcn/` | [`91f21dfe1328585670275781b4525fff2507f917`](https://github.com/shadcn-ui/ui/tree/91f21dfe1328585670275781b4525fff2507f917/skills/shadcn) | MIT, `LICENSE.md` | Exact older 15-file snapshot; current upstream changed two toast-guidance files | high |
| `oracle` | `local` (`repo-local`) | [`steipete/oracle`](https://github.com/steipete/oracle) | `skills/oracle/` | [`d6e773a562dc85c2a81b7c571f40ca2d81896679`](https://github.com/steipete/oracle/tree/d6e773a562dc85c2a81b7c571f40ca2d81896679/skills/oracle) (inferred origin base; local patches required) | MIT, `LICENSE` | Extensive local policy rewrite; local-only OpenAI adapter; no exact upstream text match | medium |
| `portless` | `local` (`repo-local`) | [`vercel-labs/portless`](https://github.com/vercel-labs/portless) | `skills/portless/` | [`84c5012b2fa5066c7585034fa1176a633bdde5ee`](https://github.com/vercel-labs/portless/tree/84c5012b2fa5066c7585034fa1176a633bdde5ee/skills/portless) (exact pre-patch base) | Apache-2.0, `LICENSE` | Imported base is exact; current copy is base plus a small repo-specific patch | high |
| `turborepo` | `local` (`repo-local`) | [`vercel/turborepo`](https://github.com/vercel/turborepo) | `skills/turborepo/` | [`6ef1582ec49b6b1cf8d3de3ff0a1c7b53eb71d61`](https://github.com/vercel/turborepo/tree/6ef1582ec49b6b1cf8d3de3ff0a1c7b53eb71d61/skills/turborepo) (best historical base; local patches required) | MIT, `LICENSE` | Historical `SKILL.md` exact and 23/26 imported files exact; later heavily customized | high |

## `grill-me`

- Lock identity: `mattpocock/skills`, locked path
  `skills/productivity/grill-me/SKILL.md`, floating `main` in `skills-lock.json`.
- Current repository `main` HEAD:
  [`2ab958093e83e0ec752e6c1c5932da465bf23e0c`](https://github.com/mattpocock/skills/commit/2ab958093e83e0ec752e6c1c5932da465bf23e0c)
  (2026-07-28).
- Newest commit touching the locked path:
  [`cbf6db4233c7e4202abaf79643f7ab395c75a2df`](https://github.com/mattpocock/skills/commit/cbf6db4233c7e4202abaf79643f7ab395c75a2df)
  (2026-06-12).
- Complete-tree comparison: both `SKILL.md` and `agents/openai.yaml` are
  byte-identical between upstream current `main` and `.claude/skills/grill-me/`.
  `SKILL.md` SHA-256 is
  `6189dfceb7304a6e5558f75d87e68fa3bc7fcf7ba120e44f21f8a61fe01eba54`.
- Pin current `main` HEAD, not merely the older path-tip commit. It is the newest commit
  whose tree still contains the exact installed skill.
- License: MIT, copyright 2026 Matt Pocock, upstream
  [`LICENSE`](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/LICENSE),
  SHA-256 `0e7ac423bf2c6e223b7c5b156f8cf72da49d748e56a1641402c31f22ad07dbb5`.

## `teach`

- Lock identity: `mattpocock/skills`, locked path
  `skills/productivity/teach/SKILL.md`, floating `main` in `skills-lock.json`.
- Current repository `main` HEAD:
  [`2ab958093e83e0ec752e6c1c5932da465bf23e0c`](https://github.com/mattpocock/skills/commit/2ab958093e83e0ec752e6c1c5932da465bf23e0c)
  (2026-07-28).
- Newest commit touching the locked path:
  [`aa024cb1954fedbc8221967c080fa40b9867f994`](https://github.com/mattpocock/skills/commit/aa024cb1954fedbc8221967c080fa40b9867f994)
  (2026-06-17).
- Complete-tree comparison: all six installed files are byte-identical to current
  upstream: `SKILL.md`, the four `*-FORMAT.md` files, and `agents/openai.yaml`.
  `SKILL.md` SHA-256 is
  `6d2dbe5e03084cf26fef66b535127b36cd1bcbe9478e26b0626029cd51dc2259`.
- Pin current `main` HEAD. No local patch series is needed.
- License: MIT, copyright 2026 Matt Pocock, same immutable
  [`LICENSE`](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/LICENSE)
  and hash as `grill-me`.

## `ponytail`

- Lock identity: `DietrichGebert/ponytail`, locked path
  `skills/ponytail/SKILL.md`, floating `main` in `skills-lock.json`.
- Current repository `main` HEAD:
  [`16f29800fd2681bdf24f3eb4ccffe38be3baec6b`](https://github.com/DietrichGebert/ponytail/commit/16f29800fd2681bdf24f3eb4ccffe38be3baec6b)
  (2026-07-15).
- Newest commit touching the path:
  [`b6c04480c03e8db2f035751d7c46289779ec3362`](https://github.com/DietrichGebert/ponytail/commit/b6c04480c03e8db2f035751d7c46289779ec3362)
  (2026-07-10).
- Comparison: the one-file installed tree is byte-identical to current upstream.
  `SKILL.md` SHA-256 is
  `1316a2f3f95741d2300b116fe0c2d81ce4a9568656ed0a62643f54aaf09957f2`.
- Pin current `main` HEAD. No local patch series is needed.
- License: MIT, copyright 2026 DietrichGebert, upstream
  [`LICENSE`](https://github.com/DietrichGebert/ponytail/blob/16f29800fd2681bdf24f3eb4ccffe38be3baec6b/LICENSE),
  SHA-256 `fb1bc6909ac3ef82d5c22106e32ef682b0cff66788fa915fb9b53b15c9d2f3ab`.

## `ponytail-review`

- Lock identity: `DietrichGebert/ponytail`, locked path
  `skills/ponytail-review/SKILL.md`, floating `main` in `skills-lock.json`.
- Current repository `main` HEAD:
  [`16f29800fd2681bdf24f3eb4ccffe38be3baec6b`](https://github.com/DietrichGebert/ponytail/commit/16f29800fd2681bdf24f3eb4ccffe38be3baec6b)
  (2026-07-15).
- Newest commit touching the path:
  [`bd6176a9b33ab72594ff82e6f34f17b085f25565`](https://github.com/DietrichGebert/ponytail/commit/bd6176a9b33ab72594ff82e6f34f17b085f25565)
  (2026-06-19).
- Comparison: the one-file installed tree is byte-identical to current upstream.
  `SKILL.md` SHA-256 is
  `40df33b58fc6ef889b93585733feb9566b76e9586efa7f376785c1e995197ac0`.
- Pin current `main` HEAD. No local patch series is needed.
- License: MIT under the same immutable `LICENSE` and hash as `ponytail`.

## `shadcn`

- Lock identity: `shadcn-ui/ui`, locked path `skills/shadcn/SKILL.md`, floating
  `main` in `skills-lock.json`.
- Current repository `main` HEAD:
  [`cb2bcd88d93b2f9bddb030e9136f1f8773e7eac4`](https://github.com/shadcn-ui/ui/commit/cb2bcd88d93b2f9bddb030e9136f1f8773e7eac4)
  (2026-07-31).
- Newest commit touching the locked path:
  [`6cd3f4c65c361ab6554e06a77e6a0af9cf8b6e37`](https://github.com/shadcn-ui/ui/commit/6cd3f4c65c361ab6554e06a77e6a0af9cf8b6e37)
  (2026-07-23, “feat: add Base UI toast”).
- Current complete-tree comparison: 13/15 files are byte-identical. The two changed
  files are:
  - `SKILL.md`: current upstream makes toast selection base-aware (`toast` for Base UI,
    `sonner` for Radix/React Aria); the installed copy retains the older “Toast via
    `sonner`” rule and older feedback table row.
  - `rules/composition.md`: current upstream adds the Base UI `toast.add(...)` example;
    the installed copy retains the shorter Sonner-only section.
- This is upstream-ahead drift, not a local customization. Commit `6cd3f4c...` has the
  single parent
  [`91f21dfe1328585670275781b4525fff2507f917`](https://github.com/shadcn-ui/ui/commit/91f21dfe1328585670275781b4525fff2507f917),
  and the installed directory is byte-identical to the complete 15-file skill tree at
  that parent, including both PNG assets, eval JSON, rules, reference prose, and the
  OpenAI adapter. Therefore `91f21dfe...` is the newest matching commit.
- Installed `SKILL.md` SHA-256 is
  `a45cddd4511f8262df05b20506f4d52be8210a9ee05a13d9e36d4ee321bab593`;
  current upstream is
  `deba6c5152d9835892fa7dffeb1fedbb689ddac7e59e14e57ec5eaf9463309e4`.
- License: MIT, copyright 2023 shadcn, upstream
  [`LICENSE.md`](https://github.com/shadcn-ui/ui/blob/91f21dfe1328585670275781b4525fff2507f917/LICENSE.md),
  SHA-256 `1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f`.

## `oracle`

### Provenance resolution

- Installed clues in `.claude/skills/oracle/SKILL.md` name the
  `@steipete/oracle` package, use the `oracle` executable, and describe the same bundle,
  browser, session, file-selection, and safety concepts as the upstream skill.
- The primary package repository is [`steipete/oracle`](https://github.com/steipete/oracle),
  which contains `skills/oracle/SKILL.md`. GitHub code search for exact installed phrases
  found the public beep-effect copy and downstream registries/mirrors, but no primary
  repository with the complete installed text. Those mirrors are not better origin
  candidates than the CLI owner's repository.
- The local skill first appears in beep-effect commit `1cbbc226...` on 2026-07-08.
  The newest upstream path revision preceding that import is
  [`d6e773a562dc85c2a81b7c571f40ca2d81896679`](https://github.com/steipete/oracle/commit/d6e773a562dc85c2a81b7c571f40ca2d81896679)
  (2026-07-06). That is the best immutable origin base, but the installed text was already
  substantially rewritten when introduced, so the exact base revision remains an
  inference rather than a byte match.
- Current upstream `main` HEAD is
  [`68b8c51b0ee04f03a4d2cfea932a40df71393591`](https://github.com/steipete/oracle/commit/68b8c51b0ee04f03a4d2cfea932a40df71393591)
  (2026-07-27); the newest path revision is
  [`a61381734c61e63315c8070707ce0834f39cd168`](https://github.com/steipete/oracle/commit/a61381734c61e63315c8070707ce0834f39cd168)
  (2026-07-11).

### Drift classification

Relative to the inferred `d6e773...` base, the current installed `SKILL.md` has
208 added and 107 removed diff lines. The drift is intentional local policy, not a minor
formatting delta:

- replaces upstream's Oracle-native browser/API workflow with render/copy plus the
  user's Chrome-session ladder;
- adds an explicit transmission safety preflight and manual-paste fallback;
- changes global `npx -y @steipete/oracle` examples to the installed `oracle` command;
- bans routine API, multi-model, remote-host, and Oracle-native-browser flows;
- adds repo/operator-specific file exclusions, budget guidance, and prompt rules;
- adds the 33-line “Claude Code Auto-Mode Caveat” in local commit `b9b4f5c...`;
- adds local-only `agents/openai.yaml`, which has no file in upstream's skill tree.

The upstream repository identity is high-confidence; the specific historical base is
medium-confidence because no upstream commit exactly matches either the introduced or
current local text. Adopt `d6e773...` as an explicitly inferred origin revision and store
the complete local delta as patches. Do not mark it as an exact snapshot match.

### License

MIT, copyright 2026 Peter Steinberger, upstream
[`LICENSE`](https://github.com/steipete/oracle/blob/d6e773a562dc85c2a81b7c571f40ca2d81896679/LICENSE),
SHA-256 `14293556b79940745123d0160c71d27ed0e9fe9b8a848093f3ed78f4853caafe`.

## `portless`

### Provenance resolution

- `.claude/skills/portless/SKILL.md` uses the product name, `portless` CLI, default
  `.localhost:1355` behavior, commands, and description associated with
  [`vercel-labs/portless`](https://github.com/vercel-labs/portless).
- That primary repository contains `skills/portless/SKILL.md`; exact phrase searches
  return it before downstream project copies.
- The version preserved in beep-effect commit `3135bb...` is byte-identical to upstream
  [`84c5012b2fa5066c7585034fa1176a633bdde5ee`](https://github.com/vercel-labs/portless/commit/84c5012b2fa5066c7585034fa1176a633bdde5ee)
  (2026-02-18). Both Git blob IDs are
  `1018aece69cb4eb78ee33425653656073111633c`. This is exact historical provenance,
  not merely text similarity.
- Current upstream `main` HEAD is
  [`d42c741ac67d20a0b6e1f8f5b4192136de34fa03`](https://github.com/vercel-labs/portless/commit/d42c741ac67d20a0b6e1f8f5b4192136de34fa03)
  (2026-07-30); the newest path revision is
  [`15ef06434c81523b1b24db2d52a17caf31edecf1`](https://github.com/vercel-labs/portless/commit/15ef06434c81523b1b24db2d52a17caf31edecf1)
  (2026-07-22).

### Drift classification

The installed copy is the exact 182-line base plus a small local patch: 15 added lines and
one replaced upstream line.

- Adds the beep rule that `PORTLESS=0` is diagnostic-only, never a documented dev path.
- Corrects the generic “most frameworks respect `PORT`” claim with the repo's Vite and
  shell-wrapped Storybook behavior (`--port "$PORT"` / `-p "$PORT"`).
- Adds `.claude/launch.json` preview URL troubleshooting and the canonical
  `http://<app>.beep.localhost:1355` route.
- Adds Vite/Storybook shell-wrapper guidance in the framework troubleshooting list.

Current upstream has since expanded to 481 lines, while the local copy is 196 lines. Pin
the exact import base `84c5012...`, generate the small repo patch above, and treat a bump
to current upstream as a separate warehouse update rather than pretending the present
copy came from current `main`.

### License

Apache License 2.0, upstream
[`LICENSE`](https://github.com/vercel-labs/portless/blob/84c5012b2fa5066c7585034fa1176a633bdde5ee/LICENSE),
SHA-256 `014bb31e83d5c2e76aea1cc6e82217346ab41362f32cb355ad0f5c10aa0aeaff`.

## `turborepo`

### Provenance resolution

- `.claude/skills/turborepo/SKILL.md` explicitly says it is based on official Turborepo
  docs at `apps/docs/content/docs/`; its directory structure and reference files match
  [`vercel/turborepo/skills/turborepo`](https://github.com/vercel/turborepo/tree/main/skills/turborepo).
- At upstream
  [`6ef1582ec49b6b1cf8d3de3ff0a1c7b53eb71d61`](https://github.com/vercel/turborepo/commit/6ef1582ec49b6b1cf8d3de3ff0a1c7b53eb71d61)
  (2026-02-19, version `2.8.11-canary.10`), the 914-line upstream `SKILL.md` is
  byte-identical to the historical installed `SKILL.md` preserved in beep-effect commit
  `3135bb...`; both have Git blob ID
  `ee5e36f5eee8793a6c36b8e0c343a83033eca196`.
- Of the 26 upstream skill files at that revision, 23 are byte-identical to the historical
  imported tree. The three initial local differences are obvious local/doc-processing
  edits rather than evidence for another upstream:
  - `references/best-practices/RULE.md`: changes `.ts` examples to `.ts-morph` and adds
    a `nocheck` fence;
  - `references/best-practices/packages.md`: changes several `.ts` example paths to
    `.ts-morph` and one fence from `typescript` to `tsx`;
  - `references/configuration/tasks.md`: changes `vitest.config.ts` to
    `vitest.config.ts-morph`.
- Current upstream `main` HEAD is
  [`c6fbc97bb8841f9c87d106af2d89ce11e97ea56c`](https://github.com/vercel/turborepo/commit/c6fbc97bb8841f9c87d106af2d89ce11e97ea56c)
  (2026-07-31); the newest path revision is
  [`adbfec74ea17f718b44d24cdf0094eb8141ce9b4`](https://github.com/vercel/turborepo/commit/adbfec74ea17f718b44d24cdf0094eb8141ce9b4)
  (2026-07-31).

### Drift classification

The local skill began as the official skill plus three tiny documentation patches, then
became a substantial maintained fork:

- 2026-06-01: 16 files changed (+393/-64) with repo-specific/current Turborepo guidance.
- 2026-06-30: eight files received version and guidance updates.
- 2026-07-05: `SKILL.md` was compressed from roughly 914 lines to the current 73-line
  routing guide; a new local `references/anti-patterns.md` (+688 lines) became the
  canonical curated anti-pattern inventory.
- Current `SKILL.md` adds repo laws such as package tasks over root tasks, explicit
  `turbo run` in committed code, transit-node guidance, and a reference index; it also
  explicitly calls itself repo-local.

Against current upstream `main`, 19/26 upstream files are still byte-identical. Seven
upstream files differ (`SKILL.md`, `references/best-practices/structure.md`,
`references/ci/github-actions.md`, `references/cli/commands.md`,
`references/configuration/RULE.md`, `references/environment/RULE.md`, and
`references/environment/gotchas.md`), and `references/anti-patterns.md` is local-only.
This very high structural/content overlap plus the exact historical `SKILL.md` makes the
upstream identity high-confidence.

Pin `6ef1582...` as the historical origin base and generate the current delta as the
initial local patch series. A later update can test rebasing those patches onto current
upstream; it should not erase the exact import provenance.

### License

MIT, copyright 2026 Vercel, Inc., upstream
[`LICENSE`](https://github.com/vercel/turborepo/blob/6ef1582ec49b6b1cf8d3de3ff0a1c7b53eb71d61/LICENSE),
SHA-256 `f7ac4712aa30551de5b97b30215010515d783638107f207bcce32a85bfffc05e`.

## Other `repo-local` entries checked

The other 18 `repo-local` entries in `skills-lock.json` were scanned for author names,
license/frontmatter claims, `skills.sh` references, GitHub URLs, “adapted/copied/derived
from” wording, external package ownership, and source sections. No additional obvious
vendored-skill origin surfaced.

- `atom-reactivity-specialist`, `effect-first-development`, and
  `schema-model-specialist` cite Effect source/docs under `.repos/effect-v4` or installed
  packages, but their skill text is repo-specific synthesis rather than a matching
  externally hosted `SKILL.md`.
- `jsdoc-annotation-specialist`, `crispen`, `grill-with-docs`, `reflect`,
  `repo-symbol-discovery`, `quality-review-fix-loop`, and `yeet` cite repo-local standards,
  source, fixtures, or workflows.
- `mcp-jetbrains`, `mcp-graphiti-memory`, and `onepassword-secret-refs` name external
  products/services but contain local operational policy and no external-skill provenance
  claim.
- `claude-frontend-lane`, `effect-services`, `effect-v4-imports`, `explore`, and the
  remaining schema/review helpers likewise expose no obvious external skill repository.

This is a provenance-clue screen, not proof that no sentence was ever inspired by external
documentation. Based on current evidence, none of those 18 needs Workstream B warehouse
treatment as a vendored skill.

## Unresolved cases

1. **`oracle` exact text origin: unresolved.** The upstream repository identity is clear,
   and `d6e773...` is the strongest time-bounded source base, but no commit in
   `steipete/oracle` exactly matches the introduced or current local text. Store
   `resolutionStatus: inferred` and `confidence: medium`; do not record an exact-match
   claim.
2. **No other repo identity among the eight is unresolved.** `portless` has an exact
   historical file match, `turborepo` has an exact historical `SKILL.md` plus a 23/26
   tree match, and all five existing GitHub entries have exact current or historical
   complete-tree matches.
3. **The other 18 local skills are not unresolved warehouse candidates on present
   evidence.** If a later authorship audit finds a copied external `SKILL.md`, promote
   that individual entry to provenance resolution rather than treating all docs-informed
   local guides as vendored artifacts.

## Recommended lock-schema fields

A v2 entry needs to distinguish origin, observation, patching, and installed output. A
single `source`, `ref`, `skillPath`, and `computedHash` cannot represent the findings above.

```jsonc
{
  "sourceType": "github",
  "upstream": {
    "repository": "owner/repo",
    "repositoryUrl": "https://github.com/owner/repo",
    "treePath": "skills/name",
    "entryPath": "skills/name/SKILL.md",
    "trackingRef": "main",
    "sourceRevision": "40-character-origin-or-adoption-base-sha",
    "observedHeadRevision": "40-character-main-head-at-resolution",
    "observedPathRevision": "40-character-newest-commit-touching-entry-path"
  },
  "snapshot": {
    "algorithm": "sha256",
    "treeHash": "canonical-path-mode-content tree hash",
    "fileCount": 1,
    "manifestHash": "hash of ordered per-file path/mode/content hashes"
  },
  "license": {
    "spdxId": "MIT",
    "path": "LICENSE",
    "sha256": "license file hash at sourceRevision"
  },
  "provenance": {
    "status": "exact | inferred | unresolved",
    "confidence": "high | medium | low | unresolved",
    "matchedFileCount": 1,
    "upstreamFileCount": 1,
    "evidence": ["exact-tree", "historical-import", "package-owner", "path-history"]
  },
  "patches": {
    "required": false,
    "patchSetHash": "sha256",
    "series": [
      {
        "path": "patches/0001-example.patch",
        "sha256": "sha256",
        "label": "policy | repo-adaptation | temporary-drift",
        "owner": "CODEOWNERS-resolvable owner",
        "dropCondition": "machine-checkable or reviewable condition"
      }
    ]
  },
  "effective": {
    "treeHash": "reconstructed upstream-plus-patches hash",
    "installedTargets": [".claude/skills/name", ".agents/skills/name"],
    "installedTreeHash": "cross-target effective tree hash"
  }
}
```

Field-level implications from this audit:

- **Use a skill-root `treePath`, not only `skillPath`.** `teach` and `shadcn` prove that
  adapters, references, evals, and binary assets are part of the upstream snapshot.
- **Separate `sourceRevision`, `observedHeadRevision`, and `observedPathRevision`.** For
  unchanged skills, repository HEAD is the newest matching pin even when the latest path
  commit is older. For `shadcn`, the path change's parent is the newest exact snapshot.
- **Record an ordered, mode-aware complete-tree manifest.** A hash of `SKILL.md` alone
  would have missed `shadcn/rules/composition.md` drift and cannot prove its PNG assets.
- **Capture license bytes at the pinned revision.** Store SPDX ID, path, and content hash;
  do not infer a historical snapshot's license from current repository metadata.
- **Make provenance epistemic state explicit.** `oracle` must be representable as a
  resolved repository with an inferred revision and local patches, without laundering
  that into an exact match.
- **Keep origin base distinct from future adoption/update revisions.** `portless` and
  `turborepo` have valuable exact historical import evidence even though current upstream
  has advanced. A later Renovate bump should not overwrite the origin record.
- **Hash the patch set and each patch.** Workstream B's reconstruction must prove both
  pristine snapshot identity and ordered local customization identity.
- **Keep target adapters explicit.** A local-only adapter such as
  `oracle/agents/openai.yaml` must be either a labeled patch or a separately hashed target
  adapter; it must not silently contaminate the pristine upstream layer.
- **Retain the effective/reconstructed hash.** The current v1 `computedHash` concept is
  still useful, but it should identify the materialized output, not stand in for upstream
  provenance.

