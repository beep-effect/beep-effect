# Practice Claude Code plugin: build, test and deliver

The `oip-practice` plugin (source `apps/practice-claude-mod`) adds
plain-language practice-kg tool rows and Right / Wrong / Partly verdicts to
Claude Code sessions. Design and decisions: [goals/practice-claude-mod/SPEC.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/practice-claude-mod/SPEC.md).

## Build and test

```bash
cd apps/practice-claude-mod
bun run plugin:test
```

`plugin:test` builds `dist/` (a directory marketplace with the plugin at
`dist/plugin`), runs `claude plugin validate` and `claude plugin test`.
The validator's `calls:` line must list only the calls the SPEC's D9/D18
envelope allows.

## Try it on the operator machine

```bash
claude --plugin-dir apps/practice-claude-mod/dist/plugin
```

Pass practice-kg for the session with `--mcp-config` pointing at a bundle
copy that no other process holds open.

## Deliver to the attorney's PC

1. Rebuild with `bun run plugin:build` (a fresh `dist/` holds only release
   files; an interactive `--plugin-dir` session writes engine type files
   into `dist/plugin/.claude-plugin/types/`, which must not be copied).
2. Copy `dist/.claude-plugin/` and `dist/plugin/` into the PC's local
   marketplace folder (the operator's notes name it), replacing the old copy.
3. First install only:
   `claude plugin marketplace add <folder>` then
   `claude plugin install oip-practice@oip-practice-local --scope user`.
4. Updates: in an open session run `/reload-plugins`; new sessions load the
   new copy automatically.
5. Check: `claude -p "/wrong"` in the working folder answers
   "There is no answer to mark yet."

## Verdict evidence

`/practice export` returns the verdict and timer rows as JSONL in the command output.
Copy those rows into a file you choose when collecting sitting evidence.
The mod engine's file-write API cannot reject symlinks, so the command does
not write into the session's working folder.
