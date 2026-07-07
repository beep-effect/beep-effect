# Capture

<!--
Stage 0. Append-only raw dump. New material goes under a new dated heading.
-->

## 2026-07-06

Origin: the second of two successor initiatives planned after
`agent-pipeline-velocity` (PR #295) via grill-with-docs on 2026-07-06 —
"(3) SkillOpt successor goal — the eval-suite + skill-training pilot,
absorbing the Phoenix-enrichment direction." The sibling initiative
(`quality-gate-ratchets`) shipped first as PR #305 + ruleset per the locked
A→B ordering; this packet opens on its closure (PR #306).

User-locked decisions carried in from the grill (see DECISIONS.md for the
full entries): train **schema-first-development** first (user override of the
cheap-pilot recommendation — the scorer is the repo's own law machinery);
success bar = **loop runs end-to-end, measured lift informs but does not
gate**; park condition = harness integration infeasible within appetite;
provisioning = **flake.nix python3 + uv with committed lock**; execution =
codex sub-agents implement, Claude orchestrates/verifies.

SkillOpt provenance inherited from
`explorations/agent-pipeline-velocity/research/SOURCES.md` §2:
[microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) — MIT (verified
2026-07-05), v0.2.0 (2026-07-02), `pip install skillopt`. Text-space
optimizer: skill markdown = trainable state; optimizer model proposes bounded
add/delete/replace edits accepted only on strict held-out validation
improvement; deploys `best_skill.md` (300–2,000 tokens); benchmarked inside
Claude Code (+19.1) and Codex CLI (+24.8) harnesses with cross-harness
transfer; v0.2.0 adds SkillOpt-Sleep (offline self-evolution behind a
validation gate). Cite-and-align was done in #295 (skills restructured to
the compatible band); THIS packet is the actual pilot.

Raw shape from the approved plan (fat-marker): B1 eval task corpus (≥10
schema-authoring tasks, reference criteria from repo law/history) stored in
ai-metrics BenchmarkCase/BenchmarkRun schemas; B2 scorer wrapping
schema-first lint + tsgo effect diagnostics + biome into a scalar per rollout
diff; B3 runner generalizing the QualityWorkerEval codex-sdk pattern at
workspace-write in throwaway `beep worktree` checkouts; B4 SkillOpt loop on
schema-first-development with validation split; B5 Phoenix experiments
stretch (reviving the superseded phoenix-enrichment slices); adoption of the
trained artifact explicitly OUT of the pilot.
