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

## Correction wave (review 6577949011 on `60c7e5ca`)

- **Defect, introduced at `60c7`:** `tool_version` masked a failed probe with `|| true`
  and read whatever it printed as the version, so a tool printing the pin but exiting
  non-zero counted as ready. It now keeps the probe's exit status and yields `""` for any
  non-zero exit, including a timeout, so that tool is re-fetched and reported `NOT ready`.
- **SC2034 (parent ShellCheck 0.11.0, introduced):** `typos_ok` and `gitleaks_ok` were read
  only through `${!var}`. That loop is replaced by an explicit
  `install_publish_tool <tool> <needed> <fetched_ok>` helper that reads the flags directly.
  This is a rewrite, not a suppression. The SC1091 on the nvm `source` exists on the base
  too (inherited). ShellCheck was **not re-run** here because it is not installed in this
  container; the parent's run is the authority.
- **Tests:**
  - Expected pins are now test constants instead of being parsed from the script under
    test, so the fixture runs against any script version.
  - The original 14 tests are unchanged.
  - The "ready" assertion moved out of the original no-op test into a new test.
  - New regression: a tool prints the pinned version but exits 3 (fetch then 404s), and
    the run must report `NOT ready (missing typos 1.50.3)`.

## Verification

Same test file run against three versions of the scripts:

| Scripts | Result |
| --- | --- |
| this head | 20 passed |
| `60c7e5ca` (pre-correction) | 19 passed, **1 failed**: the pinned-output/non-zero-exit regression |
| `origin/main` (no provisioning) | **14 passed** (the original tests), **6 failed**: every new case, each on a test-body assertion (no fetch event, no readiness line, or no warning), none at fixture setup |

- The hermetic setup is unchanged. Downloads, archives, `typos`, `gitleaks`, `timeout`,
  `ln` and `sudo` are stubs under a temp HOME, and no request leaves the host. Fixture
  digests are substituted only in the copied `fetch.sh`.
- `bash -n` passes on both scripts. ShellCheck was not run locally (see above).
- **Observed, not my command:** this session's resume ran the branch's bootstrap through
  the vendor SessionStart hook. That fetched both pinned archives, installed them and
  probed them, ending with `publication tools: ready (typos 1.50.3, gitleaks 8.30.1)`.
  It is evidence that the real `typos --version` and `gitleaks version` outputs reduce to
  those tokens under the `60c7` parser, on one VM start. It is not a full vendor
  qualification: there was one start, no receipt beyond that output, and it ran the
  pre-correction parser.
- `package-verify @beep/repo-cli --quick` on `60c7`: the first run **failed** on lint (a
  format error I introduced) and the second passed. Results for the correction head are
  recorded on the PR.
- The `60c7` commit used `LEFTHOOK_EXCLUDE=typos,gitleaks`. That is a recorded deviation,
  not a passing scan. The parent's own security scan is still required.

## Panel correction wave (same-seat panel on `34b34370`)

| Finding | Disposition |
| --- | --- |
| R1/A1: unguarded `install -d`, `install` and link under `set -e` could abort core preparation | **Fixed.** `install_publish_tool` checks every step itself, without relying on its caller's errexit context. Each failure is a tool-named warning, core preparation continues, and readiness reports `NOT ready`. A link failure is warned, and the tool stays installed on the persisted PATH. |
| R2: a direct install could remove or partly overwrite a working binary | **Fixed.** The bytes are staged with `mktemp` in the same destination directory, installed there, then moved over the old binary in one rename (`mv -f`, same filesystem). Every failure path deletes the staged file, and the EXIT trap removes a staged file left by an interruption before the rename. |
| A2: root extraction honored the archive's owner and mode | **Fixed.** `tar --no-same-owner --no-same-permissions`; the final 0755 still comes from `install`. |
| A3: exact upstream version-token shapes are unverified | **Limit kept, no new proof claimed.** The parser takes the last token and strips a leading `v`; a probe that fails, prints nothing or prints another token is "not ready". The only real-binary evidence is still the one pre-correction SessionStart observation above. |
| A4: the runbook's `github.com` Trusted rows name only Bun | **Not edited here.** `docs/runbooks/cloud-environments.md` is owned by #2536. A proposed sentence was posted on #2582 for the parent to reconcile after #2536 lands. |

New hermetic fault tests (stubbed `install`, `mv`, `ln`, `tar`):
- a partial-write copy failure and a failed rename each keep the old binary's exact
  bytes, leave no staged leftover, finish core preparation (install, prepare,
  `.bashrc`) and report `NOT ready`;
- a failed directory creation finishes core preparation and reports `NOT ready`;
- a failed global link keeps the new binary and names the failure;
- both extractions pass the two tar flags.

| Scripts | Result (same 25-test file) |
| --- | --- |
| this head | 25 passed |
| `34b34370` | 20 passed, **5 failed**: the four fault cases (three abort with a non-zero exit; the rename case shows no staging) and the tar-flag case |
| `origin/main` | **14 passed** (the original cases), **11 failed** (every new case) |

The parent ran ShellCheck 0.11.0 on `34b34370` and found only the inherited SC1091. It
also scanned the whole PR with typos and gitleaks (no findings) and checked both digests
against the primary manifest and checksum asset. ShellCheck was not run on this head
here, because it is not installed in the container.
