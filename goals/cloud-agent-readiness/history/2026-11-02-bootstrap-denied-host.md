# Bootstrap denied-host path (D2/D42) — 2026-11-02

Scope: the denial path of the current `scripts/cloud/bootstrap.sh` (SPEC D42
Verification Matrix row "Preflight on denied host"). The packet lifecycle, P2,
P4–P6 and every other acceptance row stay open; this note closes none of them.
Base: `origin/main` at `7ae3f014`, in a Claude cloud session.

## Audit of current behavior (before the fix)

- `pkg.pr.new` snapshot dependencies: `rg -c pkg.pr.new package.json bun.lock
  bunfig.toml` returns 0 for each file, and no workspace `package.json` names
  the host. At this base D2's snapshot precondition is vacuous: there is
  nothing to preflight, and nothing was added to probe it.
- Required download hosts are the literals in `scripts/cloud/fetch.sh`:
  `github.com` (pinned Bun archive) and `nodejs.org` (Node index, tarball and
  `SHASUMS256.txt`). `cache.agilebits.com` / `downloads.1password.com` serve
  the optional 1Password CLI.
- A denied required host was **not** a stable, named failure. A denied Bun
  download exited `1` with `bun <ver> download or checksum failed.` (no host,
  no remedy, indistinguishable from a checksum mismatch). A denied Node host
  exited `1` with `Node <ver> is required; refusing to continue ...`. Neither
  exit was `78`, and neither named the host.
- No live denial could be observed in this session: a one-off `curl` of
  `pkg.pr.new`, `cache.agilebits.com` and `nodejs.org` each returned `200`
  through the session proxy. The denial shape used by the stubs is the one the
  same proxy reported for refused MCP servers ("Proxy refused to open a
  tunnel: 403 Forbidden"), which curl reports as exit `56` with
  `%{http_connect}` = `403`.

## Fix

- `fetch.sh` gains `fetch_required <host> <output> <url>`, used for every
  Bun and Node download. The host is the caller's literal, never parsed from
  curl output. Curl keeps its bounds and `--retry 3`. On failure, curl exit
  `5`/`6`/`7` (proxy or host does not resolve or connect) or a `403` in
  `%{http_code}` or `%{http_connect}` writes the host to `<kind>.denied` and
  exits `78`. Every other failure keeps its previous non-zero exit.
- `bootstrap.sh` collects `78` exits from the required workers (`bun`,
  `node`, not `op`), and after all downloads settle prints one line and exits
  `78`, before step 2 places anything:
  `ERROR: required download host denied: <hosts>; remedy: add <hosts> to the
  environment's allowed domains (docs/runbooks/cloud-environments.md).`
  The parallel workers, their cleanup, the checksum and GPG checks, the frozen
  install and its three-attempt retry, the vendor guard and the stamps are
  unchanged. The optional `op` worker still only warns.
- Mixed failures (review follow-up). Bun is waited on first and a non-denial
  Bun failure stops the loop early; the EXIT trap cancels the downloads still
  in flight. On `ebc5a1f6`, a Bun `404` with a Node `403` already recorded
  exited `1` without naming `nodejs.org`. Now a denial another required worker
  already recorded is still named (exit `78`), after the Bun failure line. A
  denial still in flight is unknown, so it is not claimed: the exit-1 message
  says no denial was recorded before stopping and that in-flight downloads
  were cancelled. A Bun denial with a Node non-denial failure was already exit
  `78` naming `github.com`, and is now pinned by a test.
- Not covered: denial of the install registries (`registry.npmjs.org`,
  `buf.build`) during `bun install`. Naming them would mean parsing bun's
  output, which would infer the host, so they keep the existing loud exit-1
  path with the `buf.build` hint. A future `pkg.pr.new` snapshot would hit the
  same path, so D2 needs a named preflight if a snapshot dependency returns.

## Tests

`packages/tooling/tool/cli/test/cloud-bootstrap-denied-host.test.ts` (new,
beside the existing bootstrap fixture in `retained-script-adapters.test.ts`).
The test runs copies of both scripts in a scoped temp root with a temp `HOME`
and `XDG_CACHE_HOME`, a replaced (not extended) environment, and stub `curl`,
`bun`, `node`, `ln`, `sudo` and `uname` first on `PATH`. `ln` is stubbed so
`link_global` cannot touch `/usr/local/bin` even when the runner is root. No
request leaves the host.

| Case | Before fix (`7ae3f014` scripts) | After fix |
| --- | --- | --- |
| Proxy-denied `github.com` (curl 56, CONNECT 403) | exit 1, no host: **fail** | exit 78, names host + remedy |
| Unresolvable `nodejs.org` (curl 6) | exit 1, no host: **fail** | exit 78, names host + remedy |
| Both hosts proxy-denied | exit 1: **fail** | exit 78, names both |
| `github.com` 404 (non-denial) | exit 1: pass | exit 1, no denial line |
| Node checksum mismatch | exit 1: pass | exit 1, no denial line |
| Allowed host, then re-run | exit 0: pass | exit 0; install runs once, re-run skips |
| Bun 404 + Node 403 recorded (`ebc5a1f6` scripts) | exit 1, no `nodejs.org`: **fail** | exit 78 naming `nodejs.org` |
| Bun 403 + Node 404 | exit 78: pass | exit 78 naming `github.com` |

Every denial case also asserts no `bun install`, `bun add`, `bun run prepare`
or `ln` call, and that no `~/.bun`, `~/.local`, `~/.bashrc` or `node_modules`
was created, and that the run directory under the cache was removed. The
failure-before column comes from running the same test file with the
`7ae3f014` copies of both scripts swapped in (3 failed, 3 passed). After the
fix, the new file plus `retained-script-adapters.test.ts` give 28/28 passing
(26/26 before the two mixed cases were added).
The real `/usr/local/bin` links still carry their session-start timestamps.

## Checks and limits

- `bash -n` on both scripts: clean.
- `bun run beep quality package-verify @beep/repo-cli --quick`: exited `1`
  the first time on Biome import order in the new test (introduced). Fixed,
  then lint ok, check ok, exit `0`.
- `bun run beep quality package-verify @beep/repo-cli` (full): exit `1` at
  docgen. Example typechecking ended with `Failed to run 'tsc'` (a
  `PlatformError` from `ChildProcess.exitCode`). Docgen reads only `src/`
  JSDoc, and this change touches no `src/` file, so the failure was not
  introduced here. Whether it is inherited from `main` or caused by this VM
  was not proven. Hosted Docgen is the proof.
- ShellCheck 0.11.0 (`uvx --from shellcheck-py`, user cache only, no
  privileged install). On base `7ae3f014` and on head, both scripts give exit
  `1` with one finding: SC1091 (info) at the unchanged
  `. "${NVM_DIR}/nvm.sh"` line, which is inherited. With `-S warning`, head
  exits `0`. The diff adds no finding. (Earlier, `shellcheck` was missing from
  the VM `PATH`.)
- Hermetic proof only. No live denied-host run, and no network policy changed.
  The matrix row moves from "unexercised" to "hermetically qualified for the
  download hosts"; its acceptance checkbox stays open until a real denied
  environment is observed.
