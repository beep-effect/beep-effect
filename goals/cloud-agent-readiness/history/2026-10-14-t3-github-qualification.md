# T3 GitHub integration qualification — 2026-10-14

## Result

T3 nightly on beep-worker now discovers the existing GitHub account and loads
pull requests through its browser interface. Settings → Source Control reports
GitHub authenticated with gh 2.102.0. The pull-request list loaded ten authored
open/draft Beep PRs; opening PR #1689 loaded its description, changed-file
summary, checks and comments.

This qualification is read-only. No checkout, comment, review, label, merge or
other GitHub mutation was performed. The sample PR's failing checks are its own
state, not a failure of this integration test. Publishing remains a separate
acceptance boundary.

## Compatibility failure and repair

The worker initially resolved gh 2.46.0 from the system package. Its authenticated
native requests worked, but T3 logged rate-limit failures during PR lookup.
Native API probes showed the core allowance still available, so that symptom
did not establish actual exhaustion of the signed-in account's quota.

The referenced T3 source's `docs/user/source-control.md` requires gh >=2.81
for structured account discovery. On the old binary, `gh auth status --json
hosts` failed with exit 1. This is a verified compatibility gap; the precise
internal route responsible for the earlier rate-limit message was not traced.

Installed official GitHub CLI 2.102.0, matching DankStation, at
`~/.local/bin/gh`. Downloaded the Linux AMD64 archive and release checksum
manifest from GitHub's official cli/cli v2.102.0 release, and verified the
archive with `sha256sum -c` before installation. The original `/usr/bin/gh`
remains available for rollback. Existing authentication was preserved.

## Verification

- `gh --version` reports 2.102.0.
- `gh auth status --json hosts` succeeds with output suppressed.
- An authenticated user lookup returns the existing account, kriegcloud.
- Restarted the T3 user service after provider smoke sessions had finished.
  Its live PATH includes `~/.local/bin`, and it has no GH_TOKEN/GITHUB_TOKEN
  override or inherited SSH agent socket.
- Chrome's existing worker session shows GitHub authenticated, successfully
  loads the PR list, and opens the sample PR's detail panel.

The browser test used the existing connection grant; no management permissions
were broadened. No credential value or pairing token is included in this receipt.

## Maintenance and remaining scope

Managed-host provisioning should enforce T3's gh compatibility floor and test
structured account discovery as well as an authenticated native API call.
Removing the owned user-local gh binary restores the older system version but
also restores the compatibility gap; no authentication file needs changing.

Azure, Vercel and Cloudflare CLI account authorization, broader headless
portability qualification and Linux fleet closeout remain pending. This worker
test does not qualify other hosts or full GitHub write workflows.
