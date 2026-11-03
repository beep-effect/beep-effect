# @beep/repo-cli-kit

Repo-specific CLI helpers shared by the beep command tools: JSON and text codecs, process steps, artifacts, systemd units, package-script policy and the shared entry path.

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- Before handing back a change, run `bun run beep quality package-verify @beep/repo-cli-kit` from the repository root. Use `--quick` only for a justified lint+check subset; a failure arms the checkout's shared P0 inbox.
