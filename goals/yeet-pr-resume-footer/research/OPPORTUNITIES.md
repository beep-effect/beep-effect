# Friction receipts — yeet-pr-resume-footer PR 1 (2026-09-03)

1. **`bunx --bun vitest` hangs (forks pool).** Doing: focused test lanes in Codex briefs and the
   package audit. Evidence: `RUN v4.1.11 .../packages/tooling/tool/cli` then no output for
   20–30 min in three lanes; `--pool=threads` passes 44/44. Prevention: brief template should
   name `bunx vitest run <files> --pool=threads`; a repo-level vitest pool default for bun
   would remove the trap.
2. **Stale dependency dists fail `package-verify` audit in untouched files.** Doing:
   `bun run beep quality package-verify @beep/repo-cli`. Evidence:
   `src/commands/Ci/CiLane.ts(17,10): error TS2305: Module '"@beep/schema/Unknown"' has no
   exported member 'UnknownFromJsonString'` while the source exports it; cleared by
   `bunx turbo run build --filter="@beep/repo-cli^..."` (32 tasks). Prevention: package-verify
   could build the package's dependency closure first, or print a stale-dist hint when a
   diagnostic names a workspace subpath.
3. **`goals doctor` flags a brand-new packet as `stale-active` (21+ days).** Doing: validating
   the just-materialized packet. Evidence: advisory on `yeet-pr-resume-footer` with zero git
   history. Prevention: treat packets with no committed history as fresh.
4. **`goals bootstrap --plan --json` has no writer.** Doing: materializing the packet. Evidence:
   help text "no writer exists"; files were written by a jq loop over `entries[].payload`.
   Prevention: ship the writer (`--apply`).
5. **Original design shipped a `cd "$BEEP_PROJECTS/<clone>"` template.** Doing: reviving
   CSF-007's footer. Evidence: the Codex-finding simulation would re-file it; the number-only
   fence plus local registry made the block path-free. Prevention: recorded in packet DECISIONS.
