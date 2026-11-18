# Gate Output: Switch On What Exists — Sources & Provenance

- **Source exploration:** `explorations/agent-verification-output` — primary ledger:
  `explorations/agent-verification-output/research/SOURCES.md`
  ([link](../../../explorations/agent-verification-output/research/SOURCES.md)).
- This goal uses the in-repo inventory (sections 1 and 8), the Turbo experiment in the synthesis,
  and the external landscape's agent-detection sections. It mines no upstream code.

## 1. Mined source corpus

None. No upstream code is ported; every fix changes repo code or configuration. The vitest-agent
corpus in the primary ledger serves the sibling goals.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `vitest-dev/vitest` | MIT | dependency, configuration only | the `minimal` reporter Vitest selects under an agent |
| `unjs/std-env` | MIT | reference; `@beep/runtime-env` copies its agent table | the agent-variable table |
| `vercel/turborepo` | MIT | dependency, configuration only | `passThroughEnv`, `--output-logs=errors-only` |
| `oven-sh/bun` | MIT | dependency, configuration only | quiet test mode keyed on `AGENT`, `CLAUDECODE`, `REPL_ID` |
| `Effect-TS/effect` (`effect/cli`) | MIT | dependency | `CliOutput.defaultFormatter` `globalFlags` option |

## 3. External research sources

All URLs are recorded with fetch dates in
`explorations/agent-verification-output/research/external-landscape.md`
([link](../../../explorations/agent-verification-output/research/external-landscape.md)). The
sections this goal relies on:

- Section 1, "Vitest": the `minimal` reporter and its selection by `isAgent`.
- Section 1, "Bun test runner": quiet mode on `CLAUDECODE`, `AGENT` or `REPL_ID`, not on Codex.
- Section 1, "Turborepo": `--output-logs` modes; detection changes no task output.
- Section 2, "How tools detect an agent": the std-env table and the `AI_AGENT` convention.
- Section 5: harness head-and-tail excerpt limits.

## 4. In-repo capability references

Paths and line citations: `explorations/agent-verification-output/research/in-repo-inventory.md`
([link](../../../explorations/agent-verification-output/research/in-repo-inventory.md)), sections
1 ("Test", "Turbo"), 3 and 8. The measured Turbo experiment is in
`explorations/agent-verification-output/RESEARCH.md`
([link](../../../explorations/agent-verification-output/RESEARCH.md)), "The problem, measured".
The output-share figures (TS6305 at 5.1% of check, lint and quality output; JSON envelopes at
about 8% and `--help` boilerplate at 2% or more of Yeet output) are in
`explorations/agent-verification-output/research/transcript-audit.md`
([link](../../../explorations/agent-verification-output/research/transcript-audit.md)).

| Brick | Package / path | Use |
| --- | --- | --- |
| Turbo pass-through list | `turbo.json` `global.passThroughEnv` | extend |
| Agent table | `@beep/runtime-env`, `packages/foundation/capability/runtime-env/src/internal/agentCi.ts` | reuse; export its keys |
| Turbo step builder | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` (`turboStep`, `turboRunArgs`) | extend |
| Help formatter | `node_modules/effect/src/cli/CliOutput.ts` (`defaultFormatter`); `packages/foundation/capability/cli-kit/src/CliColor.ts` (`formatterLayer`) | reuse; extend |
| Lane envelopes | `Tasks.ts` (`emitQualityTaskLaneRunReport`, `runQualityTaskGithubCheckLaneWaves`) | extend |
| Monitor submit executor | `packages/tooling/tool/cli/src/commands/Yeet/internal/IssueArtifacts.ts` (`executeStepWithArtifacts`) | extend |
| Unbuilt-tree probe | `packages/tooling/tool/cli/src/commands/Quality/CheckCensus.ts` (`assertCheckCensusTreeBuilt`) | reuse |
| Package-script generator | `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScripts.schemas.ts` | extend, if P0 routes the probe there |
| Cache baseline | `standards/cache-baseline/_root.json` | re-record |

## 5. Cross-links & provenance

- Source exploration packet: `explorations/agent-verification-output/RESEARCH.md`,
  `explorations/agent-verification-output/DECISIONS.md`,
  `explorations/agent-verification-output/BRIEF.md`,
  `explorations/agent-verification-output/MAP.md`.
- Sibling goals from the same graduation: `goals/agent-output-census`, `goals/gate-report-core`,
  `goals/gate-run-history`, `goals/gate-report-rollout`, `goals/ci-gate-reports`.
- Write each backticked path in this file from the repo root. A Markdown link
  target resolves from this file's directory instead, so point it three levels
  up to the repo root first; never copy a relative link out of the
  exploration's ledger unchanged.
