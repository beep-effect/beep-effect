# Types lint input preparation — 2026-11-06

The current types lint command delegates to `biome check .`. The root Biome configuration enables Git ignore-file use. Its inherited Turbo lint inputs omit the root ignore policy and exclude root tsconfig files. Twelve pinned native metadata-only plans compare the current inputs and an explicit candidate on stable 2.11.10 and canary 2.11.11-canary.1.

On both clients, the original task hash stays unchanged after appending a types source exclusion to the root ignore policy. The candidate hashes that policy and invalidates. A separate root tsconfig JSONC comment change is also ignored before and invalidates with the candidate; this demonstrates file-byte coverage only, not changed alias resolution or a semantic lint outcome.

The candidate retains default package inputs, root Biome configuration and rule/config files, adds the root and possible ancestor ignore policies and root tsconfig inputs, and preserves the empty dependency closure and disabled cache. Absent ancestor ignore files contribute no observed bytes. This is deliberately conservative preparation for the runner's existing root-metadata controls. It does not prove that every root tsconfig change affects Biome.

The companion JSON binds source revision and original input digests, candidate bytes, exact client binary digests, all twelve raw-plan digests, comparisons and execution bounds. All temporary source edits were restored byte-for-byte after observation. No task body, quality suite, secret read or remote-cache operation ran. Neither metadata invalidation nor the authored process-double tests qualify types lint. The separate toolchain-env prerequisite in #2816 must land before constructing the eventual candidate; no unlanded parent was merged or copied into this lane.

The current pilot implementation remains local-only for types; signed types execution is refused. Real admitted comparisons, semantic controls, cross-worktree evidence, trust readiness and broader adoption remain open.
