# Cloud bootstrap provisions the publication hook tools — 2026-11-02

Scope: `scripts/cloud/bootstrap.sh`, `scripts/cloud/fetch.sh`, the hermetic bootstrap
test (`packages/tooling/tool/cli/test/cloud-bootstrap-denied-host.test.ts`), this note
and one ledger row in `research/OPPORTUNITIES.md`. No allowlist, settings, secret,
`AGENTS.md`, hook or plan change. Lefthook keeps both hooks as they are.

Run: one Claude cloud session, `claude-opus-5-5` medium, no child agents or fallbacks,
promotional cloud credit only. Branch `codex/cloud-publish-tools`, cut from fresh
`origin/main` at `1947c120` before any edit.

## Problem

Lefthook pre-commit runs `typos` and `gitleaks`. The cloud bootstrap provisioned neither,
so every commit in a Claude cloud session exited 127 (observed in the #2531 lane, which
had to commit with `LEFTHOOK_EXCLUDE`).

## Change

- `fetch.sh` gains `typos` and `gitleaks` workers that reuse `fetch_required`. That
  covers the bounded curl, the exit-78 host-denial record and the redirect-hop
  attribution. Each archive is checked against a recorded sha256 before
  extraction, and a version with no recorded digest is refused.
- `bootstrap.sh` checks each tool's version on PATH. It fetches only on a mismatch
  or absence, in parallel with the other workers under the same 240 s worker deadline.
  It installs beside bun (already on the persisted PATH) and links globally the way
  the other tools are linked. Both tools are **optional**: a denial, 404, checksum
  mismatch or deadline expiry is a named warning and never exit 78 or 1. The final
  lines re-read PATH and print either `publication tools: ready (...)` or
  `WARN: publication tools: NOT ready (missing ...)`, so a failed fetch cannot read as
  ready.

## Pins and sources (read 2026-11-02)

| Tool | Version source in repo | Archive | sha256 | Digest source |
| --- | --- | --- | --- | --- |
| typos | `heavy.yml` `typos-cli@1.50.3` | `typos-v1.50.3-x86_64-unknown-linux-musl.tar.gz` | `aca6b5d546307092b8d0a8e0a89dd80f9da51f2f7617c5e45c5607c1684ffbf2` | `taiki-e/install-action@1e29709c` (the action and commit CI installs typos through), `manifests/typos.json` → `1.50.3` / `x86_64_linux_musl` |
| gitleaks | `check.yml` "Pin v8.30.1" | `gitleaks_8.30.1_linux_x64.tar.gz` | `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb` | the release's own `gitleaks_8.30.1_checksums.txt` |

Both archives were downloaded once from their `github.com/.../releases/download/` URLs
and re-hashed: both match. They were listed with `tar -t` and **never executed**. Limit:
the typos digest comes from CI's pinned installer manifest, not from a checksum file
published by typos itself. The session's GitHub proxy refused the typos release and
API pages (HTTP 403, repository outside session scope), so whether such an asset exists
was not checked. The install path assumes `typos --version` prints the version as its
last token (for example `typos-cli 1.50.3`) and that `gitleaks version` prints
`8.30.1` or `v8.30.1`. That assumption is **unverified**, since the binaries were not
run. If it is wrong, the bootstrap re-fetches on every run and still reports
`NOT ready`; it never reports ready falsely.

## Verification

- Hermetic tests (`bunx vitest run test/cloud-bootstrap-denied-host.test.ts` in
  `packages/tooling/tool/cli`): 18 passed, the 14 existing tests plus 4 new ones. In
  every test the downloads, archives, `typos`, `gitleaks`, `timeout`, `ln` and `sudo`
  are stubs under a temp HOME, and no request leaves the host.
  - The existing no-op test now also asserts `publication tools: ready`. Pinned tools
    on PATH trigger no fetch.
  - Stale tools are fetched from the exact pinned URLs and installed under
    `HOME/.bun/bin`; the re-run makes no fetch.
  - The real pins against fixture archives give two checksum refusals, nothing is
    installed, and the run reports `NOT ready`.
  - A denied `github.com` for a tool gives a named warning, not exit 78.
  - A 404 (exit 22) and a deadline expiry (exit 124, from a stubbed `timeout`) are
    attributed separately.
- The fixture substitutes digests only in its **copied** `fetch.sh`. There is no
  runtime override variable.
- Against the `origin/main` scripts all 18 fail, because the fixture reads the new pin
  variables. That shows the tests depend on the change, not one failure per behavior.
- `bash -n` passes on both scripts. **ShellCheck was not run**: it is not installed here
  and no workflow runs it.
- **Not live qualification:** no vendor VM has run the new bootstrap. The first cloud
  start on this branch is the real qualification and must record the ready line.

CLI quick and default package-verify results are recorded per head on the PR.
