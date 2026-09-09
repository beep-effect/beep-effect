# P0.5 filesystem reconnaissance lane

This is a bounded read-only source and conformance-mapping task. P0e is complete;
P0.5 requires its own MemoryFileSystem PR after Node/Bun/Memory conformance.
Use gpt-6-astra with explicit xhigh effort under the latest user instructions.

Create history/lanes/p05-filesystem-recon.md first, then append throughout.
Read SPEC.md D8/D9/D10/D14, PLAN.md P0.5, ops/prompts/resource-authoritarian.md,
the shared lane-contract.md, research grounding-2 section 8 and grounding-4's
filesystem notes. Use the actual worktree as truth and the verified rc.112 cache,
not upstream HEAD. No web research is needed; if new web research is required,
report the exact question so the orchestrator routes it through Grok.

Own only this report. You are not alone; do not edit or revert anyone's source.
NO git commands, agents, inbox acknowledgements/waivers, package/audit/coverage
commands, scanner writes, configuration changes, module creation, promotion,
source deletion, or dependency changes. The orchestrator owns those decisions.

Answer these concrete questions with source paths/line anchors and counts:

1. The packet's scratchpad/MemoryFileSystem directory does not exist in this
   checkout. The tracked scratchpad/test/MemoryFileSystem test imports
   @beep/scratchpad/memfs, and scratchpad/memfs/MemoryFileSystem.ts is present.
   Map the actual engine, layer constructors, helper/role imports, public barrels,
   $ScratchpadId usage, tests and dependencies. Separate the core filesystem
   engine from optional seed/fault/inspect/sync facade surfaces. Do not infer a
   vanished directory or promote the entire facade merely to get an easy pass.
2. Search existing package source and barrels for reuse before proposing files.
   State the exact minimal source closure that would implement/promote the core
   under @beep/test-utils/MemoryFileSystem after conformance, preserving defaults,
   typed errors and fresh-volume-per-layer-block semantics. No seed/fault/inspect
   facade promotion is authorized without P1 evidence; no scratchpad deletion
   has been approved. If the engine and facade are inseparable, explain exact
   shared state/functions and a bounded extraction plan rather than guessing.
3. Inventory EVERY test case/assertion category and fixture dependency from
   pinned packages/effect/test/FileSystem.test-utils.ts (435 lines, SHA256
   8725010039e5ef2cee8b9b4fbcdb076f4099e8a44fe393a8e032c5fd89808abe).
   Preserve both TestLayerOptions flags/defaults and all cases. Identify how
   the readFile host fixture is supplied to a fresh memory volume without a
   host-filesystem escape, weakened test or unrequested options. Distinguish
   inner scopes that deliberately close before NotFound assertions from wrapper
   scopes that can disappear under it.effect. Preserve MIT attribution/notice.
4. Give a Node/Bun/Memory invocation matrix, including which runtime can execute
   BunFileSystem, how the current scratchpad engine can be tested before its
   promotion, and the public @beep import boundaries of the promoted tests.
   Identify any immediate API incompatibility from pinned/current source;
   do not claim conformance without running the eventual suite.
5. Recommend a dependency-independent PR cut for FileSystemConformance plus the
   promoted engine. P0e's Vitest runner ships later in P0g, so the P0.5 port must
   use public @effect/vitest and existing helpers, not require unmerged P0e source.
   Root will choose/create any necessary isolated publication worktree and own
   the package manifest/lockfile and all git/Yeet operations.

Report facts separately from proposals and unknowns. Keep all D1-D14 decisions
intact. No MemoryFileSystem or memfs adoption in other packages. Final response
is only the report's absolute path.
