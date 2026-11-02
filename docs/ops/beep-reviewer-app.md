# beep-reviewer GitHub App

`beep-reviewer` gives the self-hosted reviewer its own checks, editable summary
comments, and inline COMMENT reviews on `beep-effect/beep-effect`. Its credentials
are separate from `beep-fleet-orchestrator`. The reviewer cannot approve reviews,
request changes, merge, administer rulesets, or write repository contents.

The implementation uses Bun's WebCrypto RS256 signer. PKCS#1 RSA keys are wrapped
as PKCS#8 in memory. There are no new dependencies and no compiler, make, g++,
OpenSSL executable, key file, or token file requirement. The existing App prototype
in `packages/drivers/github/src/GitHubApp.ts` (`@beep/github`) establishes the redacted credential,
installation-token and early-refresh pattern; this CLI uses a separate cache with
the requested five-minute margin and repository-scoped token request.

## Human setup checklist

These steps are for Benjamin Oppold (`kriegcloud`). The implementation PR does
not create or install an App, create a service account, or enable a live rule.

1. On DankStation, confirm `gh api user --jq .login` says `kriegcloud` and that
   `op` resolves through PATH. Use the approved human 1Password write lane for
   creation. Never use shell tracing, `--reveal`, raw item dumps, a PEM download,
   or a key in argv. The read-only reviewer service account cannot create items.
2. From the checkout, run:

   ```sh
   bun scripts/github-app/create-beep-reviewer.ts
   ```

   Open `http://localhost:8787` in the browser signed in as `kriegcloud`. The local
   form POSTs `scripts/github-app/beep-reviewer.manifest.json` to
   `https://github.com/organizations/beep-effect/settings/apps/new`. The localhost
   callback validates a random state, exchanges the one-use code with
   `POST /app-manifests/{code}/conversions`, and sends `id`, `client_id`, and
   `pem` to `op item create --vault BEEP_SECRETS -` through stdin. The field names
   are `app_id`, `client_id`, `installation_id`, and `private_key`. No conversion
   response is printed or saved. The callback is one-use, binds loopback only,
   disables caching and referrer propagation, and never renders credentials.
   Stop it with Ctrl-C after success. If conversion or vault write fails, revoke
   the generated key in GitHub before restarting; the code cannot be replayed.
   If registration succeeded but storage failed, delete the new, uninstalled App
   registration after revoking its key, then restart the helper and register it
   again. The failed helper does not retain a recoverable copy of the PEM.
   The helper uses a shell pipe to deliver the in-memory JSON template: Bun's
   child stdin is a socket on Linux, which this 1Password CLI does not recognize
   as piped template input. Raw process and conversion errors remain suppressed;
   only the failed stage, HTTP status, or process exit code can be reported.
3. In the new App's settings, verify private visibility, no webhook, no subscribed
   events, and the permissions below. Install on **Only select repositories**,
   selecting **beep-effect/beep-effect only**. Record the numeric installation id
   from the installation settings URL in the same item's `installation_id` field.
4. Give the reviewer box a **read-only** 1Password service account scoped only to
   vault `BEEP_SECRETS`. Provision `OP_SERVICE_ACCOUNT_TOKEN` through its existing
   secret delivery mechanism. Do not paste it into repo files or terminal history.
   There is no need for Desktop sign-in or Desktop MCP approval.
5. Run the scratch-PR verification below. Only after that, preview and apply the
   required check using the human's `gh` login. Preserve the existing orchestrator
   bypass actor; the software gate still checks the reviewer before merging.

### Manual UI fallback

Use Organization Settings → Developer settings → GitHub Apps → New GitHub App.
Set name `beep-reviewer`, homepage `https://github.com/beep-effect/beep-effect`,
private installation visibility, disable Active under Webhook, and select no
events. Set precisely the permissions in the table. Install on the one repository
and record App ID, Client ID, and Installation ID in 1Password.

GitHub's ordinary **Generate a private key** UI downloads a PEM. That operation
does not meet this workflow's no-key-on-disk requirement. Do not click it with
normal browser downloads enabled, and do not download and delete a key afterward.
Use the manifest flow above for initial secret capture. If manual registration is
necessary, key issuance requires a separately verified browser response capture
that denies downloads and streams the response into 1Password without saving it.
This PR does not claim to implement that browser-specific capture. If one is not
available, delete the empty manual App and recreate through the manifest flow.

## Permissions

| Repository permission | Access | Use |
| --- | --- | --- |
| Checks | Write | Start, finish and cancel `beep-reviewer` check runs |
| Pull requests | Write | Post COMMENT reviews with inline comments |
| Issues | Write | Create and edit the App's summary comment |
| Contents | Read | Read the repository and review inputs |
| Metadata | Read | Required repository metadata |

No webhook secret is used. GitHub may return one during manifest conversion; the
helper discards it. The syntactically required hook URL uses `example.invalid`;
`hook_attributes.active=false` and the empty event list prevent delivery.
Ruleset administration uses the human account; the App has no administration grant.

## Runtime configuration

| Environment override | 1Password reference |
| --- | --- |
| `BEEP_REVIEWER_APP_ID` | `op://BEEP_SECRETS/beep-reviewer GitHub App/app_id` |
| `BEEP_REVIEWER_CLIENT_ID` | `op://BEEP_SECRETS/beep-reviewer GitHub App/client_id` |
| `BEEP_REVIEWER_INSTALLATION_ID` | `op://BEEP_SECRETS/beep-reviewer GitHub App/installation_id` |
| `BEEP_REVIEWER_PRIVATE_KEY` | `op://BEEP_SECRETS/beep-reviewer GitHub App/private_key` |

Unset fields resolve with `op read`. To use the existing Tailscale SSH route, set
`BEEP_REVIEWER_OP_SSH=dankstation`; the resolver uses batch-mode
`ssh dankstation "op read '<reference>'"`. Select this fallback explicitly so an
agent authentication failure cannot silently change credential backends. `op` is
resolved from PATH locally and on the remote host. A failed read runs `op-doctor`
once on that host, suppresses secret output, and stops the path.

The service keeps private keys, JWTs and installation tokens redacted. JWT claims
are `iat=now-60`, `exp=now+540`, and `iss=client_id`. Tokens are opaque nonempty
strings; their length and prefix are not assumed. The token exchange requests only
repository `beep-effect` and the permission set above. One process shares a cache
and serializes refreshes five minutes before GitHub's returned expiry; separate CLI
invocations mint separate tokens. Keep a long-lived service layer for a daemon.

`token` is the one intentional token output command. Capture its stdout directly
in a command substitution with tracing disabled. Do not invoke it bare in an agent
tool whose output is recorded. Never persist a token or private key for `gh`.

## Commands

Use `bun run --silent beep reviewer` in this checkout, or `beep reviewer` where
the CLI is installed. IDs are numeric; `--sha` is the full PR head SHA.

```sh
beep reviewer check start --pr 123 --sha "$SHA"
beep reviewer check complete --id "$CHECK_ID" --score 4 --tier L2 \
  --p0 0 --p1 0 --p2 2 --summary-file review-summary.md --conclusion auto
beep reviewer check cancel --id "$CHECK_ID" --reason superseded
beep reviewer comment upsert --pr 123 --body-file review-summary.md
beep reviewer review post --pr 123 --sha "$SHA" --json inline-review.json
```

`start` checks the live PR head and reuses this App's in-progress run on that SHA.
It sets `external_id=pr-123-<head sha40>-<base sha40>` (the PR number, the full
head SHA and the full base SHA GitHub reports for the PR; this binding landed in
#1805) and the title `Reviewing…`. The merge gate accepts only a successful run
from the required App whose `external_id` matches that exact triple, so a
reviewer build older than #1805, which wrote `pr-123-<sha7>`, can never satisfy
`beep reviewer gate` or `yeet merge`. Completion uses a
title such as `4/5 · L2 · P0 0 · P1 0 · P2 2`; `auto` fails when `p0+p1 > 0` and
succeeds otherwise. Optional `--annotations-file annotations.json` accepts an array
of Checks API annotations. Batches contain at most 50 annotations and are appended
before the final completion request. A failed batch cannot publish a green check.
Completion rejects completed or unassociated checks. It decodes the intended PR
from the run’s `external_id` and verifies that PR’s head before annotation
publication and again before the final status change.

The comment marker is `<!-- beep-reviewer:summary -->`. Upsert searches all comment
pages and edits only a matching comment from `beep-reviewer[bot]` whose
`performed_via_github_app.id` matches the configured App ID. A marker copied by a
human or another bot is ignored. Serialize jobs per PR to avoid concurrent initial
comment creation. Retrying an annotation batch can append duplicate annotations;
cancel and restart a failed review when exactly-once annotations matter.

`inline-review.json` is `{ "body": "Review summary", "comments": [...] }`.
Each comment has `path`, `line`, `side` (`LEFT` or `RIGHT`), and `body`; optional
`start_line` and `start_side` support ranges. An optional `event` must be `COMMENT`.
The outgoing event is always `COMMENT`, and `commit_id` is always `--sha`.
Reviews refuse a stale PR head.

## Required check and fleet orchestration

The human selects the App id without resolving the private key:

```sh
BEEP_REVIEWER_APP_ID=<numeric-app-id> beep reviewer ruleset require
BEEP_REVIEWER_APP_ID=<numeric-app-id> beep reviewer ruleset require --dry-run
BEEP_REVIEWER_APP_ID=<numeric-app-id> beep reviewer ruleset require --apply
```

Dry run is the default. The command requires `gh api user` to identify `kriegcloud`.
It discovers the default branch, reads its effective rules, and selects the active
repository-owned ruleset containing required checks. Use `--ruleset-id <id>` if
multiple rulesets qualify. It refuses to modify an inherited organization ruleset.
The preview prints old/new JSON. It replaces only the `beep-reviewer` entry with
`{ "context": "beep-reviewer", "integration_id": <app_id> }`, retaining all other
contexts, rule parameters, conditions and bypass actors. A second read refuses
concurrent changes before PUT. GitHub has no ruleset compare-and-swap API, so
serialize administration while applying the diff.

On every new head, the reviewer/controller runs:

```sh
beep reviewer l0 --pr "$PR" --sha "$SHA"
```

This command reads every changed path, including rename sources. Documentation-only
changes get an immediate successful `L0` check from the reviewer App. Other changes
print `Non-L0: review required.` and follow the normal start/review/complete path.
Only Markdown, MDX, reStructuredText and text under `docs/`, plus `README*.md`
files, are eligible. Dot-directories, agent instruction filenames (`AGENTS.md`,
`CLAUDE.md`, `GEMINI.md`, `SKILL.md`), and test/fixture directories always require
review, including rename sources. Do not trust a PR title, label, user-provided
tier, or a same-named commit status to classify L0.

Before any non-L0 merge, `beep-fleet-orchestrator` calls:

```sh
beep reviewer gate --pr "$PR" --sha "$SHA"
```

A nonzero result means hold and poll on the next controller tick; fetch a new SHA
and restart review if the head changes. The gate reads the effective base-branch
ruleset and, once required, accepts only the newest `beep-reviewer` run from the
specified integration id on the current head with `completed/success`. It checks
the head again after reading runs. Unknown or unbound required App identity holds.
Both `yeet merge` and `yeet merge-gate` call this same gate immediately before
their head-pinned merge, including `--relaxed` S11 merges. There is no tracked
implementation of the external `beep-fleet-orchestrator` daemon in this monorepo;
its deployment must invoke the `l0` and `gate` commands as described above.

While the ruleset does not list the source-bound required check, the shared merge
gate is inactive. This permits a safe rollout of the CLI and reviewer before enforcement.
GitHub enforces the source-bound rule for non-bypassing actors; preserving existing
bypass actors makes the software gate necessary for the fleet's privileged App.

## Advisory mode: merging without the reviewer

When the reviewer cannot run, for example because the model quota behind it is
exhausted, remove its required check instead of waiting. The merge gate follows
the ruleset, so this one change releases both GitHub's required check and the
`yeet merge` / `yeet merge-gate` software gate. The reviewer may keep posting
checks and comments; they become advisory.

```sh
beep reviewer ruleset release            # preview (default)
beep reviewer ruleset release --apply    # drop only the beep-reviewer entry
```

`release` uses the same selection, `kriegcloud` login check, preview, concurrent
edit refusal and lossless PUT as `require`; it removes only the `beep-reviewer`
entry and keeps every other check, condition and bypass actor. It needs no App
credentials. Restore enforcement once the reviewer runs again:

```sh
BEEP_REVIEWER_APP_ID=5321138 beep reviewer ruleset require --apply
```

Record each switch, its reason and the restore condition in the owning packet's
decision log (`goals/cloud-agent-readiness/SPEC.md`).

## Acceptance on a scratch PR

After human provisioning, use a disposable PR whose head is not changing. Record
IDs, SHA, URLs and conclusions, never credentials. Do not create a second setup PR.

1. With tracing off, run
   `GH_TOKEN=$(beep reviewer token) gh api /installation/repositories --jq '.repositories[].full_name'`.
   It must list only `beep-effect/beep-effect`.
2. Start a check and inspect its Check Run URL. Confirm **In progress**, App identity
   `beep-reviewer`, and the expected head. Start again and compare the returned id.
3. Complete with zero P0/P1 and inspect **Success**, the score title, and summary.
   Repeat on another run with a P1 and verify **Failure**. Cancel a superseded run.
4. Upsert twice and compare comment ids. The second call must edit the same comment
   without 403. Post a COMMENT review with a valid diff line and verify the actor is
   `beep-reviewer[bot]` and the review's commit id is the scratch head.
5. Apply the previewed rule using the human login. Read the default branch's
   `required_status_checks` and confirm the numeric `integration_id`. On a scratch
   head without a successful reviewer run, publish a same-named status using a
   different authorized actor. Confirm `reviewer gate` still holds. Complete the
   correct App's check and confirm the gate succeeds. Do not merge the scratch PR.
6. Exercise an L0 documentation head and verify the immediate success check; a
   code-to-document rename must still require review.

The implementation PR's local HTTP tests cover token refresh, JWT signature,
severity mapping, ownership, annotation batching, editable comment identity,
COMMENT-only reviews, stale heads, and ruleset preservation. Mock proof does not
establish installed permissions, GitHub's live 403 behavior, or branch-rule
enforcement. The installation below has also completed live acceptance.

### Live acceptance, 2026-10-14

App `beep-reviewer` (`5321138`), installation `171494634`, was verified with
credentials resolved from `BEEP_SECRETS`. The installation token listed exactly
one repository: `beep-effect/beep-effect`. No private key or token was printed or
written to a local file during verification.

The disposable [acceptance PR #1765](https://github.com/beep-effect/beep-effect/pull/1765)
was closed without merging and its branch was deleted after these checks:

| Acceptance case | Observed result |
| --- | --- |
| Start and repeat on the same head | Check `116076032475` was `in_progress`; the second start reused its id |
| Complete with zero P0/P1 | The check completed successfully with title `4/5 · L2 · P0 0 · P1 0 · P2 2` |
| Upsert the summary twice | [Comment `6177272852`](https://github.com/beep-effect/beep-effect/pull/1765#issuecomment-6177272852) was edited in place by `beep-reviewer[bot]`, with no 403 |
| Post a COMMENT review with an inline comment | [Review `5523948807`](https://github.com/beep-effect/beep-effect/pull/1765#pullrequestreview-5523948807) was `COMMENTED` by `beep-reviewer[bot]` on the requested head |
| Complete with one P1 | Check `116076857549` concluded `failure` |
| Cancel a superseded run | Check `116076907500` concluded `cancelled` |
| Same-named success from another actor | A success status from `kriegcloud` did not satisfy `reviewer gate` |
| Correct App's success | Check `116077100236` satisfied the gate on head `7e22e095003bef87101305d29790b3b692bac7c7` |
| Head changes | The old head was rejected and its successful check did not carry forward |
| Code-to-document rename | Moving `scripts/cloud/bootstrap.sh` to a Markdown path still required review |
| Documentation-only head | [Check `116078568151`](https://github.com/beep-effect/beep-effect/runs/116078568151) immediately succeeded as L0 and satisfied the gate |

The active [main ruleset](https://github.com/beep-effect/beep-effect/rules/10240248)
now requires `{ "context": "beep-reviewer", "integration_id": 5321138 }`.
The update was applied using `kriegcloud`'s gh login. A comparison of the saved
before/after responses confirmed that every other rule, required check, condition,
and bypass actor was preserved, including the fleet orchestrator's bypass actor.

On 2026-10-26 the operator switched the reviewer to advisory mode after the
model quota behind it ran out: the `beep-reviewer` entry was removed from
ruleset 10240248 and the other 16 required checks, the conditions and both bypass
actors were confirmed unchanged (decision D41 in
`goals/cloud-agent-readiness/SPEC.md`).

These results verify the installed App and this checkout's CLI gate. They do not
establish that a separately deployed fleet controller has adopted the commands;
that deployment must run the `l0` and `gate` calls described above.

## Rotation and revocation

For rotation, issue a second key through a verified in-memory browser response
capture with downloads denied. Stream its PEM into the existing 1Password field
through stdin, restart the reviewer to discard its key/token cache, and verify a
new token and scratch check before deleting the old key in GitHub. Never use the
ordinary PEM download or a temporary file, even on tmpfs. The manifest bootstrap
creates a new App and is not an existing-App key rotation tool.

For immediate revocation, suspend/uninstall the reviewer installation or revoke
the compromised App key in GitHub; revoke the 1Password service account separately
if its credential was exposed. Existing installation tokens can remain usable
until expiry unless revoked or the installation is suspended. Stop the reviewer
and explicitly revoke outstanding tokens if necessary using GitHub's installation
token endpoint with credentials held in memory. Audit checks and comments from the
affected interval. Do not remove the required rule merely to bypass a failed review.
For an intentional rollback, run `beep reviewer ruleset release` (preview, then
`--apply`), then uninstall the App and retire the service account.
