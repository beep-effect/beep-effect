# Design ideas — beep-effect shipping pipeline

Date: 2026-08-13
Lane: g2 (design ideation)
Repo read: `~/beep-effect (checkout)` (read-only)

Stance: do not invent four new systems. The checkout already contains ~80% of
C, a fleet mirror that already solves routing, a quality profile that
*documents* slots it does not *enforce*, and a generated-file policy that
still commits the projections and therefore still pays the treadmill. The
highest-leverage designs are the ones that delete work, not the ones that
add a daemon, a tunnel, or a merge queue.

---

## What is already true (do not redesign these)

These facts bound every design below. New work that re-derives them is waste.

| Fact | Where | Consequence |
| --- | --- | --- |
| Comment poll is already 10s; merge-loop poll is already 30s | `MonitorComments.ts:22`, `MonitorLoop.ts:83` | Sub-minute *detection* exists. The hole is *delivery into a session that is not running `yeet monitor`*. |
| Full-proof lock is **per checkout**, under the branch artifact dir | `ProofState.ts:125`, `acquireFullProofLock` at `:426` | There is no machine-wide mutex in code. Serialization is social (`ps` in the yeet skill) plus a profile number nobody enforces. |
| Workstation profile: `fullProofSlots: 1`, `reviewFixSlots: 3`, `turboConcurrency: 8` | `Quality.plan.ts:51-58` | The number the operator wants is already written down. It is rendered by `quality profile config` and never consulted by `acquireFullProofLock`. |
| `yeet verify --merged` already materializes `git merge-tree` into a throwaway worktree, `bun install --frozen-lockfile`, and runs the ordinary proof | `MergedPreview.ts` entire module; refuse-symlink-node_modules at `:28-33` | Design C is not "invent merge-tree verify". It is "when to escalate to the flag that already exists, and which hosted lanes the local proof still skips". |
| `--merged` is verify-only, full-tier-only, and proves committed HEAD (not dirty work) | `Guards.ts:160-174`, `Handler.ts:1132-1143` | Correct. Do not make publish prove a tree the operator does not own. |
| Local pre-push quality lanes: build, lint, check, knip, jsdoc-ratchet, `docgen:local --allow-full`, test. **No coverage.** | `GithubChecks.ts:223-254`; asserted at `quality-tasks.test.ts:463-471` | The recurring "Coverage Regression" remote red is not a merge-tree miss. The lane is absent locally. |
| Hosted PR Check workflow **does not read** the remote Turbo cache | `check.yml:118-124` (`TURBO_CACHE: local:rw` unless `event_name == push`) | "Asymmetric: CI writes, others read" is deployed on `main` and then denied to every PR. Warming a cache nobody reads is theatre. |
| `goals/INDEX.md` is already a deterministic projection of `goals/*/ops/manifest.json` | `PortfolioIndex.ts:1-9`; header of `goals/INDEX.md` | The shards already exist. Committing the projection is the bug. |
| `explorations/ATLAS.md` is **not** generated. No CLI writer exists. It is hand-edited "at every exploration stage transition" | `explorations/ATLAS.md:8-9`; zero hits for an atlas generator under `packages/tooling/tool/cli` | The problem statement lumps ATLAS with INDEX. They are different kinds. Treat them differently. |
| `standards/*` snapshots are chore-PR-only by written policy | `standards/generated-artifacts.policy.md` | Feature PRs that regen these are policy violations, not a missing merge driver. |
| Fleet mirror already enumerates every clone+worktree sharing the origin URL, joins liveness, and indexes contested paths | `Fleet.service.ts` (`scanFleet` ~1279-1316); `buildContestedIndex` at `:367` | Routing (PR → checkout) and hot-file *detection* are built. Enforcement was an explicit no-go (D1). |
| No hook interrupts a running tool. Worst-case bulletin latency = longest in-flight Bash | `explorations/fleet-coordination/research/T3-delivery-vector.md` §0 | A 5-second webhook that lands during a 30-minute `yeet verify` is still a 30-minute bulletin. |
| Claude same-machine `SendMessage` exists; Codex is pull-at-next-tool-boundary; socket reachability ≠ liveness | T6 | Delivery is three adapters over one inbox, not one push primitive. |
| Merge queue and `strict=true` were declined until main's full-repo gauntlet is ≥80% over 14 days (measured 19%) | fleet-coordination D / Q6; T4 | Revisit only against that flip condition. `merge_group` is a third `event_name` that `check.yml` does not handle. |
| Coverage Regression hosted p95 is **29.5 min**, cache-bypassed | `goals/ci-lane-economics/research/cache-warm-lane-census.md:52` | Local coverage preflight is expensive. Scope it. Do not silently add a 30-minute lane to every `yeet verify`. |

---

## A. Sub-minute backpressure loop

### Verdict

Build a **machine-wide watch process that writes a typed file inbox**. Do not
build a webhook tunnel. Do not use `repository_dispatch` (wrong direction).
Treat ntfy as an *operator* pager, not an *agent* router.

The 30-second poll is not the problem. `yeet monitor` already beats
"sub-minute" when a session is running it. The failure mode in the problem
statement — "the operator manually reminds agents to look" — is a session
that never armed a monitor, or a session blocked inside a long tool so the
monitor's stdout is sitting in a pane nobody is sampling.

### Comparison (and why three of the four options lose)

| Option | Latency if armed | Why it loses here |
| --- | --- | --- |
| Smarter polling daemon (conditional REST) | 10–30s, already the current numbers | **Wins.** One GitHub client for the whole box, ETag/`If-Modified-Since`, shared across every checkout. |
| GitHub webhook → local receiver | <5s | Needs a public inbound (cloudflared / smee / ngrok). New secret, new failure domain, new "is the tunnel up" page. Buys ~20s over conditional poll. Forbidden-adjacent for any session that might later touch OIP material if the relay stores payloads. |
| Actions workflow POSTs to a workstation endpoint | <30s after job completion | Same inbound problem. Also: Actions cannot see review comments that are not `check_run` events unless you subscribe to a pile of event types, each its own workflow file. |
| Actions → ntfy topic | <30s | Good **operator** surface (phone, Ghostty hook). Useless as a router: ntfy does not know which of 13 checkouts owns PR #N. |
| `repository_dispatch` | n/a | Outbound *from* the box *to* GitHub. Solves the opposite problem. |

A webhook is the right answer for a fleet of laptops behind NAT that must
wake in <2s. This is one workstation, one user, one filesystem, GitHub
already answering conditional GET in well under a second. Tunnel complexity
is not justified.

### Mechanism sketch

Schema first, then the service, then the process.

```ts
// yeet-watch-event/v1 — the inbox row. Decoded type == class.
class YeetWatchEvent extends S.Class<YeetWatchEvent>("YeetWatchEvent")({
  schemaVersion: S.Literal("yeet-watch-event/v1"),
  at: S.DateTimeUtc,
  pr: S.Finite,
  headSha: S.NonEmptyString,
  kind: WatchKind, // LiteralKit, not a hand-rolled union
  checkout: S.Option(S.NonEmptyString), // measured or unknown — never guessed
  sessionHint: S.Option(S.NonEmptyString),
  summary: S.NonEmptyString,
  url: S.String,
  payload: S.Option(S.Unknown),
}) {}

const WatchKind = LiteralKit([
  "check-failed",
  "check-recovered",
  "review-comment",
  "review-thread-opened",
  "merge-conflicted",
  "merged",
  "closed",
])
```

`WatchService` (Effect `Context.Service`) has three methods:

1. `scan: Effect<ReadonlyArray<YeetWatchEvent>>` — one conditional REST pass
   over the union of open PRs whose `headSha` is checked out locally.
2. `route: (event) => Effect<RoutedEvent>` — join against the latest
   `FleetSnapshot`.
3. `deliver: (routed) => Effect<DeliveryReceipt>` — write the inbox, then
   attempt accelerators.

**Routing law** (from T5, still binding): the PR → checkout join is
one-to-many. Git's checkout exclusivity is per-clone, and this fleet is
independent clones. Never key on branch name alone. Join key is
`(head repository id, headSha)`, then prefer `liveness === "live"`, then
fan-out to every remaining match. A miss is `checkout: none` — **silence**,
not a guessed checkout. That is the D5 measured-or-unknown law applied to
routing.

**Delivery surface — file inbox is the authority.**

```
${XDG_RUNTIME_DIR}/beep/inbox/<pr>.ndjson     # ephemeral, Monitor-friendly
<checkout>/.beep/yeet/inbox/<pr>.ndjson       # durable across reboot
<checkout>/.beep/yeet/inbox/<pr>.cursor.json  # last-seen id / ETag
```

Why a file, not a socket the harness tails as the *only* channel:

- Claude, Codex, and Grok all already read files. Only Claude has
  `SendMessage`. Codex hooks inject `additionalContext` at the next tool
  boundary (T3). Grok's Monitor tool can `tail -F` the ndjson. One schema,
  three adapters.
- A file survives the watch process restarting. A Unix socket does not.
- `yeet monitor` becomes a *subscriber* of the inbox (and can still talk to
  GitHub if the watch is down). Today every monitor is its own GitHub
  poller. That is N sessions × 2 endpoints × 30s, for no gain.

Accelerators, never authorities (fleet-mirror D7, same shape):

- Claude: `SendMessage` when `messagingSocketPath` is non-null **and**
  `procStart` matches `/proc/<pid>/stat` field 22. Otherwise skip. Do not
  treat a missing socket as "not live".
- Codex: a `UserPromptSubmit` / `PreToolUse` hook that reads new inbox
  rows into `additionalContext`. Pull-only, by construction.
- Grok: operator (or the session) arms `monitor` on the runtime ndjson.
- Human: optional ntfy publish of `check-failed` / `review-thread-opened`
  for the phone. Not in the agent path.

**Process shape.** A user-level systemd unit (`beep-yeet-watch.service`)
running `bun run beep yeet watch`, or a long-lived Effect program the
operator starts once. Not a Git hook. Main is PR-only, so there is no local
`post-merge` to hang this on (fleet Q3). This is a *different* daemon than
the one Q3 rejected: Q3 rejected watching *main movement* (derivable from
fetch + the fleet epoch file). Check failures and review comments are
**not on disk** until someone asks GitHub. A watch process is justified
here and was not there.

`yeet publish --pr` registers the PR in the watcher's interest set (or the
watcher just derives interest from the fleet snapshot — prefer derive; do
not make publish the only registration path). `yeet monitor --until-merged`
keeps working as a blocking foreground for agents that want to sit on the
loop; it should read the inbox first and fall back to REST.

### Failure modes

- **Long tool call.** Unsolved by any transport. A 30-minute `bun run check`
  will not see a Greptile thread until it returns. Mitigate by making the
  *next* tool boundary cheap: hook `additionalContext` is one read of the
  inbox, and by teaching agents that `yeet monitor` is not optional after
  `--pr`. Do not pretend SendMessage interrupts Bash. It does not.
- **Ambiguous ownership.** Two live checkouts on the same head SHA (clone +
  linked worktree, or two clones of the same branch). Fan-out is correct;
  dropping one is a silent miss.
- **Stale cursor / missed event.** Conditional GET 304 is not "no events"
  if the cursor was advanced past an unread row. Cursor advances only after
  durable write of the event.
- **GitHub rate limit.** One watcher is the fix, not the risk. Today's N
  independent monitors *are* the rate-limit risk.
- **Watch process down.** Inbox stops growing. `yeet monitor` and
  `yeet status --remote` remain. Pull fallback is the whole point of
  file-as-authority.
- **OIP / Remote Control.** Same-machine only. No Anthropic-relayed
  messaging. No webhook SaaS that stores PR bodies. ntfy payloads are
  `PR #N check X failed`, not diffs.

### Effort

- Ship-first: 2–3 agent-days (schema + watch command + inbox writer +
  `yeet monitor` reads inbox + fleet join).
- Adapters (Claude SendMessage, Codex hook, ntfy): +1–2 days.
- Tunnel/webhook path: do not budget. It is a regression.

### Ship first

1. `YeetWatchEvent` schema + `beep yeet watch --once` (derive, print, write
   inbox, exit). Prove routing against the live fleet snapshot.
2. Make `yeet monitor` consume the inbox before hitting GitHub.
3. Only then a long-running unit, and only then accelerators.

Do **not** start with the tunnel. Do **not** start with ntfy. Those are
how this design turns into a weekend of YAML.

---

## B. Cross-checkout orchestration

### Verdict

The simplest thing that works is a **lockfile admission protocol in
`XDG_RUNTIME_DIR`**, called from `yeet verify` / `yeet publish`, with
memory-weighted slots. Not a daemon. Not a reservation branch. Not a claim
registry.

And: if Design D lands, most of the "hot-file publish race" this coordinator
was asked to prevent **goes away**. Build admission for RAM. Treat hot-path
publish exclusion as a thin advisory on top of the fleet mirror's already-
computed `contestedPaths`, not as a second source of truth.

### Challenge the premise

The problem statement says "a contention gate serializes quality runs
machine-wide". In this checkout that gate is not a gate:

- `quality-lock` is created at
  `.beep/yeet/runs/<branch>/quality-lock` (`ProofState.ts:125`). Sibling
  checkouts cannot see each other's locks.
- `fullProofSlots: 1` is a field on `QualityProfileConfig`
  (`Quality.plan.ts:51-58`) that `acquireFullProofLock` never reads.
- Agents serialize by reading `ps` (yeet skill) and by politeness.

So the work is not "relax a mutex". The work is "install the mutex the
profile already describes, at machine scope, with a memory budget instead
of `N=1`".

### Comparison

| Option | Fits? |
| --- | --- |
| Pure lockfile protocol | **Yes.** Atomic `O_EXCL` create of `slot-<n>.json` (the same primitive `tryClaimProofLockExclusive` already uses). Lease carries `pid` + `/proc` `starttime` so a recycled PID cannot hold a slot (T6's lesson). |
| Tiny daemon | Only if you want a cgroup pressure observer pushing "shed a proof" events. Not needed to admit 2–3 verifies. Adds a process that can die and freeze the fleet. |
| Git-native reservation branch | No. Requires a push, fights the force-push deny, pollutes `origin`, and makes GitHub the lock server for a single box. The worst of distributed locking with none of the distribution. |

fleet-mirror D1 banned a *claim registry* (file ownership, mutual exclusion
of edits). This is not that. Admission is "may this process start a 20 GB
tsgo", not "this agent owns `goals/INDEX.md` until Friday". D1 still holds
for claims. Do not smuggle a claim registry in through the admission door.

D1 also banned `flock`-based **liveness**. Correct: this fleet orphans
`bun`/`turbo` children, and flock lifetime follows the last inherited fd,
not the claim. Admission leases must therefore key on `pid` + `starttime`
and treat "pid dead" as `replace-stale`, exactly as `acquireFullProofLock`
already does per-checkout (`ProofState.ts:455-472`). Do not flock the
turbo grandchild.

### Mechanism sketch

```ts
const AdmissionKind = LiteralKit([
  "full-proof",
  "review-fix",
  "merged-preview",
  "publish",
])

class YeetAdmissionLease extends S.Class<YeetAdmissionLease>("YeetAdmissionLease")({
  schemaVersion: S.Literal("yeet-admission/v1"),
  pid: S.Finite,
  procStart: S.NonEmptyString, // /proc/<pid>/stat field 22
  kind: AdmissionKind,
  estimateGiB: S.Finite,
  checkout: S.NonEmptyString,
  hotPaths: S.Array(S.String), // measured from `git diff --name-only` vs origin/main
  enqueuedAt: S.DateTimeUtc,
}) {}
```

Layout:

```
${XDG_RUNTIME_DIR}/beep/admit/
  slot-0.json
  slot-1.json
  queue.ndjson          # FIFO waiters for publish-on-hot-paths
```

Admission rules, workstation profile as the default on this box
(32c / 128 GB, 50–60 GB typically free):

| Kind | Estimate (starting numbers; measure, then edit the profile) | Concurrent |
| --- | --- | --- |
| `review-fix` | 4 GiB | up to 3 (already in the profile) |
| `full-proof` | 16 GiB | as many as fit under a 48 GiB budget |
| `merged-preview` | 24 GiB (second install + proof) | usually 1; counts against the same budget |
| `publish` | 1 GiB | unlimited unless `hotPaths` intersects another in-flight publish |

48 GiB is deliberate: leave the observed 50–60 GB free *plus* headroom for
browsers, Claude, Codex, and the desktop. Two full proofs (32 GiB) plus one
review-fix (4) plus one publish (1) fits. Two `--merged` previews (48) do
not, and should not.

`acquireFullProofLock` stays as the *per-checkout* re-entry guard (two yeets
in the same worktree). The machine lease is acquired first, released last.
Profile field `fullProofSlots` should be deleted or demoted the moment the
budget exists — a slot count and a memory budget will disagree, and the
budget is the one that matches the hardware.

**Fair publish order.** Only for publishes whose measured `hotPaths`
intersect. FIFO on `enqueuedAt`. A publish that does not touch a hot path
never queues. After Design D, the hot-path set shrinks to
`standards/*.json` (and only when the PR actually diffs them) plus genuine
source collisions the fleet mirror already lists. That is a rare path.

Hot paths must be **measured**, not curated (D3). A hardcoded
`["goals/INDEX.md", "explorations/ATLAS.md", "standards/*.json"]` will rot
the moment someone adds `standards/foo.generated.jsonc`. Derive: union of
(a) paths the fleet snapshot currently marks contested among *live*
checkouts, (b) paths this publish's own diff actually contains. (a) ∩ (b)
is the only set worth serializing.

### Failure modes

- **Underestimate.** A "16 GiB" check that actually RSS-spikes to 30 GiB
  will OOM-adjacent the box. Mitigate with a cheap `/proc/<pid>/rss`
  sampler in the watch process (or in the next `yeet status`) that marks
  the lease `over-budget` and refuses new full-proofs. Do not preempt.
- **Orphaned lease, live pid, dead intent.** Agent killed by the operator
  with a stray `bun` still running. `starttime` match keeps the lease
  until that bun exits — correct, because the bun is still the memory.
- **Starvation.** A long `--merged` preview holds 24 GiB for 20 minutes.
  Review-fix lanes still fit. Full proofs wait. This is the desired
  behavior. Surface it in `yeet status` ("blocked on admit: 24 GiB held by
  beep-effect3 `--merged`").
- **Queue jumping.** `--allow-stale-base` energy applied to admission
  (`--skip-admit`) must exist for the operator and must be loud. Agents
  do not get it.
- **Building this before D.** You will serialize every packet-state PR on
  INDEX, which is exactly the treadmill. Ship D's "publish refuses INDEX"
  in the same change series.

### Effort

- Machine lease + budget + `yeet status` visibility: 1–2 agent-days.
- FIFO publish queue on contested hot paths: +1 day, and only after D
  shrinks the set.
- Daemon / cgroup observer: do not ship in v1.

### Ship first

Replace social `ps` serialization with `XDG_RUNTIME_DIR` leases that honor
the workstation memory budget. Wire it inside `acquireFullProofLock`'s
caller so every existing yeet path gets it. Do not build the publish FIFO
until INDEX is no longer a publish input.

---

## C. Local gate that near-guarantees remote green

### Verdict

`--merged` is real and should stay opt-in, with **automatic escalate** when
the branch is behind or the fleet policy-surface signal fires. The local ≠
remote gap the problem statement names is **not** primarily base drift. It
is three missing or shape-divergent lanes, in this order:

1. **Coverage Regression is not in the local pre-push battery.**
   `GithubChecks.ts:223-254` vs hosted `check.yml` matrix id `coverage`.
2. **Docgen local is `docgen:local --allow-full`** (`GithubChecks.ts:244-251`);
   hosted PRs are affected-mode unless docgen inputs changed
   (`check.yml:154-169`). Both directions of false signal exist.
3. **Check** is full `bun run check` locally and `--affected` on hosted PRs
   (`check.yml:220-228`). Local is usually stricter. When hosted Check
   fails and local does not, it is almost never "you didn't merge main" —
   it is source-mode / effect-LSP / tsgo config, or an affected-graph
   miss. `--merged` will not fix a config skew.

`MergedPreview.ts:1-11` already states the Mode B case cleanly: a
conflict-free merge of disjoint paths can still break a repo-level
invariant, and the stale-base guard is a *textual* intersection
(`PublishScope.ts` overlapping-paths). That is why `--merged` exists. Use
it for that class. Do not spend 15 extra minutes on every docs PR "just
in case".

### Mechanism sketch

Keep three proof trees distinct in the schema. Do not collapse them.

```ts
const ProofTree = LiteralKit([
  "worktree",       // ordinary yeet verify — dirty or HEAD, operator-owned
  "committed-head", // head-install-preflight — already exists
  "merge-preview",  // yeet verify --merged — already exists
])
```

A verdict that does not name which tree it proved is how this class of
false green is reintroduced.

**When to run `--merged` (escalate, do not default):**

| Condition | Why |
| --- | --- |
| `behindCount > 0` **and** fleet signal 3 (main moved onto a *measured* policy path) | This is Mode B. The textual overlap guard will warn and proceed. |
| `behindCount > 0` **and** overlapping paths non-empty | Already a hard refuse at publish. `--merged` is how you prove the resolution. |
| Operator / agent passes `--merged` | Always allowed on full verify. |
| Every verify | **No.** Extra worktree + frozen install (`MergedPreview.ts:605-619`) + full proof. On a cold preview this is "another CI", locally. |

**Coverage preflight, scoped.**

Do not drop `bun run coverage` onto every `yeet verify`. Hosted coverage is
a 13.6 / 29.5 minute p50/p95 on the fleet, and it is cache-bypassed
(census). Local equivalent:

```
beep ci lane coverage --affected --base origin/main
```

against whichever proof tree was selected, with the **baseline file taken
from `origin/main`**, not from the worktree. A branch that edited
`standards/coverage.regression-baseline.jsonc` is testing itself; the
ratchet's reference is main. Implementation: `git show
origin/main:standards/coverage.regression-baseline.jsonc` into the preview
(or a temp path the lane accepts). Escalate to unscoped coverage only when
the affected graph is empty or includes the coverage runner / baseline
itself — same shape as the docgen lane-gate.

Worth it when: the PR touches `packages/**` or `apps/**` test or source
files. Not worth it when the PR is `goals/<slug>/**` only (see wildcards:
those PRs should not run hosted coverage either).

**Keeping `--merged` incremental.**

`MergedPreview.ts:28-33` is load-bearing: do **not** symlink the primary
`node_modules`. Bun workspace links would make the preview read unmerged
sources and report a meaningless green.

Do share caches that are content-addressed:

- `TURBO_CACHE_DIR` → a machine-wide directory (e.g.
  `~/.cache/beep/turbo`). Both the primary worktree and the preview hash
  inputs the same way. This is the entire local incrementality story.
- Remote cache **read** for local and for hosted PRs. Today
  `check.yml:124` gives PRs `local:rw` only, and `.env.example:199-200`
  plus this checkout's `.env` show `TURBO_TOKEN` as an `op://` ref with
  `TURBO_TEAM=""`. Wiring:

  - Hosted PRs: `TURBO_CACHE: local:rw,remote:ro` (token that the Lambda
    authorizer already treats as read). `main` keeps `remote:rw`.
  - Local: `op run -- bun run beep yeet verify`, with `TURBO_API` /
    `TURBO_TOKEN` / `TURBO_TEAM` actually set. A warming strategy without
    this is a no-op.
- `bun` install in the preview stays frozen and local. Do not try to share
  `node_modules`. Accept the install minutes; they are smaller than a
  false green.

`--merged` should also reuse the machine admission lease as
`kind: "merged-preview"` (Design B) so two previews cannot eat 48 GiB at
once.

### Failure modes

- **Defaulting `--merged`.** Agents will run it on every loop because it
  sounds safer. Wall-clock doubles, admission saturates, turbo cache
  thrashes on lockfile merges. Escalate on signal, not on vibes.
- **Proving the dirty tree as merged.** The module already refuses this
  (`Handler.ts:1132-1143`). Keep the warning fatal in spirit: a dirty
  `--merged` that prints a path list and continues will be misread as
  "the dirty work is in the proof".
- **Coverage against the branch baseline.** Self-ratchet. Always pin the
  reference to `origin/main`.
- **Affected-graph miss.** Local `--affected` and hosted `--affected` can
  agree and both be wrong. Full coverage stays a `main`/nightly job
  (placement-decision already says this).
- **Config skew (Check).** If hosted Check uses a flat source-mode tsgo
  config the local `bun run check` does not, no merge-tree will save you.
  Diff the exact argv. `beep ci lane check` exists so local can replay
  hosted shape; yeet currently runs `bun run check` instead
  (`GithubChecks.ts:232-235`). That argv gap is a one-line design fix
  and should land before any `--merged` default discussion.

### Effort

- Add scoped coverage (+ main-pinned baseline) to the full verify battery:
  1 agent-day, highest local≠remote ROI.
- Point yeet Check/Test at `beep ci lane <id>` so argv matches hosted:
  hours.
- Auto-escalate `--merged` on (behind ∧ policy-surface): 1 day, depends
  on fleet signal 3 being trusted.
- Turbo remote-read on PRs + local `op run`: half day of config, plus
  confirming the Lambda authorizer's read token. Do this before any
  "warming strategy" work.
- Making `--merged` the default: do not.

### Ship first

1. Coverage lane in local full proof, affected + main-pinned baseline.
2. Yeet Check/Test/Integration invoke `beep ci lane`, not a parallel argv.
3. PR remote-cache **read**.
4. `--merged` auto-escalate on the Mode B predicate.

---

## D. Kill the derived-file conflict class

### Verdict

**Stop committing `goals/INDEX.md`.** Generate it on read. That is the
end-state. ATLAS is not the same file and must not ride along until it
has a generator. `standards/*.json` stay tracked and chore-PR-only —
collisions there are real semantic conflicts and *should* rebase.

The problem statement offers five end-states and asks for one. The honest
answer is: they are not alternatives for one file class. They are
tools for three different classes, and only one class is eating the
cycles.

### Split the class before picking

| File | Actually derived? | Collision meaning | Right end-state |
| --- | --- | --- | --- |
| `goals/INDEX.md` | Yes. `beep goals index --write` from `goals/*/ops/manifest.json` (`PortfolioIndex.ts:1-9`). 137 rows today. | Two PRs flipped different packets; both rewrote the same table. No semantic conflict. | **Untracked build artifact.** |
| `explorations/ATLAS.md` | **No generator in this repo.** Hand-updated at stage transitions (`ATLAS.md:8-9`). | Two humans/agents edited one document. That is a real merge. | Either write the generator and then untrack, or assign one owner and stop parallel-editing. Do not hang a merge driver on prose. |
| `standards/*.json{,c}` snapshots | Mixed. Some are regen'd whole-repo catalogs; policy already says feature PRs must not touch them (`generated-artifacts.policy.md`). Allowlists are hand-edited. | Two PRs changing the coverage baseline is a real ratchet fight. | Keep tracked. Enforce the chore-PR rule in `yeet publish` (refuse those paths on a non-chore branch). |

### Why untracked INDEX beats the other four

**Union / custom merge drivers + regen-on-conflict.**
This is the local already-documented procedure ("merge conflicts are
resolved by regenerating", `goals/INDEX.md:5`). A `merge=goals-index`
driver that runs `beep goals index --write` makes that procedure
automatic **in a local `git merge`**. It does **not** run on GitHub's
merge UI, does **not** run in `refs/pull/N/merge`, and does **not** stop
the second PR from going conflicted the moment the first lands. Agents
will still rebase, still re-verify, still re-queue the 17 checks. Merge
drivers treat a *projection conflict* as a *content conflict* and then
paper over it locally. The treadmill is the GitHub merge, not the local
one. **Reject as the end-state.** Accept as a one-afternoon bandage if D
slips.

**Sharded per-packet index files composed on read.**
The shards already exist: `goals/<slug>/ops/manifest.json`. A second
tree of `goals/index/active/<slug>.md` is a shadow inventory. Compose on
read from the manifests you already have. Do not add a shard layer.

**Append-only ledger + compaction.**
Git history of the manifests *is* the ledger. A new event log is a third
copy of packet status. Compaction recreates INDEX. You already have
INDEX. The only move is to stop committing it.

**Server-side regeneration bot.**
Keeps a committed INDEX on `main` for GitHub browsing. Feature PRs never
touch it. This works, and it is the right *migration* if a committed
file on `main` is load-bearing for cold humans. Cost: either the bot
pushes to `main` (policy smell — main is PR-only) or the bot opens a PR
(another 17-check ride, which is the thing we are trying to stop). A
path-filtered "INDEX-only" required-check set makes the bot-PR cheap;
at that point you are maintaining a committed convenience file with a
robot. Prefer untracked. If GitHub-browsable INDEX is non-negotiable,
the bot is the fallback, not the first choice.

**Untracked build artifact (the pick).**

- `.gitignore` `goals/INDEX.md`.
- `beep goals index` still writes the same bytes to the same path.
- `beep goals index --check` in CI becomes "generate succeeds and, if a
  committed copy is present, it matches" — then, after the deletion PR,
  just "generate succeeds". Drift-from-committed is a meaningless check
  once the file is not committed.
- `yeet repair` generates it. SessionStart / Codex extra-context can
  generate it. Agents that `Read goals/INDEX.md` keep working.
- `yeet publish` **refuses to stage** `goals/INDEX.md` (and ATLAS, until
  generated). This is the law change: the "same-PR packet-state flip
  must rewrite INDEX" rule is what *creates* the hot file. Flip the
  manifest; the projection follows.
- The fleet mirror's contested-path index loses INDEX as a permanent
  resident. Live collisions become real source collisions.

### ATLAS, honestly

Do not untrack a hand-written map and hope. Two honest paths:

1. **Generate it** from `explorations/*/ops/manifest.json` the way INDEX
   is generated from goal manifests, then apply the same untrack rule.
   This is the missing CLI. Worth a small packet.
2. **Admit it is prose** and stop requiring every exploration PR to touch
   it. A weekly ATLAS pass by one session is cheaper than N conflicted
   exploration PRs.

Until (1) exists, ATLAS is not a derived-file problem. Calling it one is
how you ship a merge driver that mangles prose.

### Failure modes

- **Cold clone, agent expects INDEX to exist.** Generate in `yeet repair`
  and in a tiny `beep goals index --write` on SessionStart. Fail closed
  if someone commits it (`yeet publish` refuse + a repo-sanity lane).
- **External links to `goals/INDEX.md` on GitHub.** They 404. Accept, or
  keep a generated copy on `main` via the bot fallback.
- **`--check` in existing packets.** Several SPECs assert
  `beep goals index --check` (e.g. honest-repo-signal). Update those
  assertions to "generate succeeds".
- **Silent reintroduction.** An agent "helpfully" `git add goals/INDEX.md`
  after `yeet repair`. The publish refuse is the actual control. A
  pre-commit hook is optional and must not be the only control.
- **Applying this to `standards/coverage.regression-baseline.jsonc`.**
  That would delete the ratchet. Do not.

### Effort

- Untrack INDEX + publish refuse + repair/SessionStart generate: 1
  agent-day, plus a dedicated deletion PR.
- ATLAS generator: 2–3 days, separate packet.
- Merge-driver bandage: half day, only if the deletion PR is blocked.
- Regen bot: 2 days plus a path-filtered check set; only if untracked
  INDEX is rejected on "GitHub must show the table" grounds.

### Ship first

`yeet publish` refuses `goals/INDEX.md` **today**, even while the file is
still tracked: regenerate at the last second from manifests so every PR
carries an INDEX that is a pure function of *this* tree, then — the
actual kill — stop staging it and delete it from `main` in one chore PR.
The refuse is useful immediately (stops agents from hand-merging the
table). The deletion is what stops GitHub from conflict-blocking the
next packet PR.

---

## Premise challenges & wildcards

Things the operator did not ask, and should.

### 1. A GitHub merge queue is not the answer. Not yet.

T4 is still right. Speculative merge testing makes *main* unbreakable, not
*your PR* unbreakable, and `check.yml` is a binary `pull_request`/`push`
fork (~30 `github.event_name` sites, no `merge_group`). A queue would
evaluate like a push run (21–46 min historically, not the ~15 min PR
p50) until every lane learns a third event. The flip condition — main
full-repo gauntlet ≥80% over 14 days — was 19% when measured. Revisit
when that number moves. Do not open the queue to "fix INDEX conflicts";
D fixes INDEX conflicts.

`strict_required_status_checks_policy: true` is the cheaper mechanical
cousin: one extra run per merge against current main, no queue, no
`merge_group`. T4 already separated this from the thundering-herd
story. If Mode B at *merge time* is the remaining hole after C's
escalate, flip `strict` before adopting a queue.

### 2. Packet-state PRs should not ride the 17-check suite.

This is the highest-leverage unasked item. A PR whose diff is
`goals/<slug>/**` (and, today, `goals/INDEX.md`) does not need Coverage
Regression, Check, Test Integration, or Docgen. Those jobs are why a
conflicted INDEX rebase costs another 15–30 minutes, twice.

`check.yml` already path-gates Docgen (`:154-169`) and has a Skip lane
that still reports a job (`:257-259`) so required contexts do not go
missing. Extend that lane-gate. GitHub's trap is well-known: a skipped
required job is a failed required job unless a skip-success step runs
under the same `name:`. They already solved this once.

Pair with Design D: after INDEX is untracked, a packet-status PR is
*only* the packet subtree, and the cheap path-filter is obvious.

### 3. Do not train packet PRs. Own them.

A "docs train" (one agent batches N packet flips) is a process patch for
a file that should not be in the merge. If D slips, a single
`chore/packet-state` branch owned by one session is cheaper than N
parallel INDEX PRs. Do not Graphite-stack thirteen agents onto a
generated table.

### 4. The remote cache is not wired for the readers who need it.

`check.yml:118-124` is explicit: PRs stay local-only even when repository
secrets exist. The Lambda/S3 cache that just landed writes on `main` and
is invisible to every PR and, unless `op run` fills `TURBO_TEAM`, to
every local checkout. "Warming" without PR `remote:ro` is a strategy
for a cache that nobody hits. Wire reads. Then let `main` continue to
be the warmer — every green push already is.

### 5. `fullProofSlots: 1` is a documentation bug, not a hardware limit.

The workstation profile's own notes say "parallel review-fix loops while
keeping full proofs serialized" (`Quality.plan.ts:58`). On 128 GB with
50–60 GB free, two affected verifies fit and two `--merged` previews
may not. A boolean is the wrong type. Design B's budget is the type.

### 6. Agents that do not run `yeet monitor` will not see any of this.

A is a watch + inbox. It does not inject a mid-tool interruption. The
operator-as-pager is a symptom of sessions that publish and wander off
to implement the next packet. Two cheap cultural/harness moves beat
another transport:

- `yeet publish --pr` prints a blocking reminder: arm `yeet monitor
  --until-merged` or arm a Grok Monitor on the inbox path.
- Default `--pr` to also register interest with `yeet watch` (derive,
  actually — if the PR's head is checked out, the watcher already
  cares).

### 7. openclaw / Greptile threads are the same inbox event.

Do not build a second "review comment daemon". `WatchKind` already has
`review-comment` / `review-thread-opened`. `yeet closeout` stays the
classifier; the watch only has to say "new thread, go closeout".

### 8. Local ≠ remote will not die from `--merged` alone.

The skill still claims "if `yeet verify` is green, CI should be green
on the first push" (yeet `SKILL.md`, "Authoritative Gates"). That
sentence is currently false: coverage is missing, docgen shape differs,
Check argv differs. Fix those three and the sentence becomes *mostly*
true. `--merged` then covers the remainder (Mode B). Shipping `--merged`
as the default *instead* of adding coverage is how you spend 20 local
minutes to still fail Coverage Regression remotely.

### 9. Do not build a claim registry to fix INDEX.

fleet-mirror D1 was right. A lease on `goals/INDEX.md` is a distributed
lock on a file that should not be committed. Every hour spent on
`FleetClaim` for this class is an hour not spent deleting the file.

---

## Cross-cutting sequence (what to actually do)

Ordered by "cycles returned per day of work", not by letter.

| # | Change | Kills | Days |
| --- | --- | --- | --- |
| 1 | `yeet publish` refuses to stage `goals/INDEX.md`; then untrack + delete | most of the hot-file treadmill | 1 |
| 2 | Put scoped, main-pinned coverage into local full proof; point Check/Test at `beep ci lane` | the largest local≠remote class | 1 |
| 3 | Hosted PR `TURBO_CACHE=local:rw,remote:ro` + local `op run` actually sets team/token | cold PR / local verifies | 0.5 |
| 4 | Path-filter required checks for `goals/**`-only (and later `explorations/**`-only) PRs | 17-check rides on packet flips | 2 |
| 5 | `XDG_RUNTIME_DIR` admission leases with a 48 GiB budget | over-serialized *and* accidental double-`--merged` | 1–2 |
| 6 | `beep yeet watch --once` + inbox; `yeet monitor` reads it | operator-as-pager, once agents actually consume the inbox | 2–3 |
| 7 | `--merged` auto-escalate on (behind ∧ policy-surface) | residual Mode B | 1 |
| 8 | ATLAS generator, then untrack — or stop requiring ATLAS edits on every exploration PR | the other "derived" file that isn't | 2–3 |
| 9 | Claude SendMessage / Codex hook / ntfy adapters | leftover minutes after 6 | 1–2 |

Do not schedule: webhook tunnel, `repository_dispatch`, reservation
branch, merge queue, claim registry, default `--merged`, merge driver as
the INDEX end-state.

The pipeline is slow because derived projections are treated as sources,
because the local proof does not run the hosted coverage lane, because
the remote cache is write-only to its intended readers, and because
backpressure is a command agents forget to run. Four designs, one
theme: stop committing projections, prove the hosted argv locally, share
the cache you already built, and put PR events in a file every harness
can already read.
