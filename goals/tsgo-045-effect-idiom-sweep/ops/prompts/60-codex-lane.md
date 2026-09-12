# Codex lane recipe (D12)

Volume work runs on `gpt-6-astra` at `medium` (repo default) through
`codex exec` from the worktree. Proven flags (memory
`codex-exec-lane-sandbox-facts-2026-09-09`, `codex-linked-worktree-commit-sandbox`):

```sh
codex exec --model gpt-6-astra -c 'model_reasoning_effort="medium"' \
  -s workspace-write --skip-git-repo-check \
  --cd "$WORKTREE" \
  "$(sed -e "s/{{SHARD_ID}}/L03-capability/g" -e 's#{{SHARD_PATHS}}#packages/foundation/capability#g' ops/prompts/20-fixer-shard.agent.md)" \
  </dev/null > "$SCRATCH/L03.codex.log" 2>&1
```

- Lanes do not commit, so do not pass `--add-dir <git-common-dir>` or
  `network_access=true`; the sandbox then keeps `.git` read-only, which is
  the behavior we want.
- `</dev/null` avoids the stdin hang. Read only the report file the lane
  writes, not the whole log.
- Run the two clones read-only: `--add-dir "$HOME/YeeBois/dev/effect"
  --add-dir "$HOME/YeeBois/dev/effect-tsgo"` are read-write grants in
  workspace-write mode, so instead reference them by absolute path in the
  prompt; Codex can read outside the workspace without a grant.
- Discovery lanes use the same shape with `10-rule-card-discovery.agent.md`
  and `-s read-only` plus a single `--add-dir goals/tsgo-045-effect-idiom-sweep/ops/rule-cards`
  is not possible in read-only mode; use `workspace-write` and rely on the
  prompt's write restriction, then verify with `git status`.
- Verifiers use `-s read-only`.
