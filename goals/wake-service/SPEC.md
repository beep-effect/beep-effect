# Wake Service Spec

## Objective

Port [kitlangton/skulk](https://github.com/kitlangton/skulk) (MIT) to Effect
v4, with attribution, as a general **wake service**: durable watches that
fire on a time or an event and deliver exactly one wake. Holds from
[`goals/hold-ledger`](../hold-ledger/README.md) are the first producer.
Wakes are messages through the existing agent-message router to the live
orchestrator. If no orchestrator is live, a dispatcher launches a hold lane
down the quota-only fallback chain. The service runs as a `systemd --user`
daemon on the workstation, with a GitHub Actions dead-man check. Graduated
from
[`explorations/expiring-repo-facts`](../../explorations/expiring-repo-facts/README.md);
see its [`BRIEF.md`](../../explorations/expiring-repo-facts/BRIEF.md) and
[`DECISIONS.md`](../../explorations/expiring-repo-facts/DECISIONS.md).

## Non-Goals

- Installing upstream skulk, or any OpenCode dependency.
- Moving `yeet monitor`, `job wait` or orchestrator sleeps onto watches. That
  is a gated re-entry point in the exploration `MAP.md`.
- A Junie session adapter (gated). Until it exists, the dispatcher starts at
  the fallback chain.
- Adding Muse to the chain, or changing the fallback doctrine in `AGENTS.md`.
- Hosting on beep-worker, or running leader election across hosts.
- A launch authority beyond hold lanes. The dispatcher is not a second
  orchestrator.
- Any new paid service, endpoint or quota purchase.

## Source Hierarchy

1. The operator request captured in
   `explorations/expiring-repo-facts/CAPTURE.md`.
2. `AGENTS.md` (volume pools, fallback chains, autonomy), `CLAUDE.md`, and the
   schema-first and effect-first skills.
3. `standards/ARCHITECTURE.md`,
   `standards/architecture/07-non-slice-families.md`,
   `docs/runbooks/agent-pools.md` and `docs/runbooks/systemd-timers.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. The exploration packet, `research/`, `ops/` and `history/` files.

## Target Surfaces

- A new tooling library created with `bun run beep create-package`, holding
  the `Condition` and `Watch` schemas, the engine, triggers, the reconciler
  and the dispatcher.
- `packages/tooling/tool/cli/src/commands/` — a `Wake` command group
  (`in`, `at`, `when`, `poll`, `list`, `show`, `cancel`, `daemon`, `status`),
  plus the reconciler over hold-ledger records.
- `packages/tooling/tool/cli/src/commands/AgentMessage/` — wake delivery
  through the router's store (extend only).
- `@beep/ai-provider-cli` — reused by the dispatcher. Extend it only for gaps
  the dispatcher proves.
- The systemd user-unit rendering beside the research timers, a
  `--refresh` install path, and `docs/runbooks/systemd-timers.md`.
- `.github/workflows/` — a daily dead-man workflow that reads a committed
  heartbeat.
- Agent guidance (a skill) on when to arm a watch instead of sleep-polling.

## Constraints

- **Schema-first.** `Condition` is a LiteralKit tagged union (`timer`, `npm`,
  `gh-run`, `pr-checks`, `idle`, `done`, `changes`, `equals`, `matches`,
  `succeeds`, `hold-probe`). `Watch` is a schema class. Services are
  `Context.Service` contracts. No native `Set` or `Map`.
- **Check classification (skulk).**
  - For value conditions, a non-zero exit, empty output or a timeout is a
    failed check, never a change.
  - At creation the check runs once, and arming is refused if it fails or the
    condition already holds.
- **Limits (skulk).** One wake, then done. A 14-day maximum deadline, at most
  20 open watches, custom polls no more often than every 60 seconds, and a
  wake after five consecutive failures. Observed values are quoted as data in
  the wake text.
- **Delivery.** Delivery is idempotent: the message identity is stored before
  posting, through the router's transactional store. A retry never
  double-delivers.
- **Launch authority.** A wake goes to the live orchestrator first. The
  dispatcher launches only when none is live, and only hold lanes, under the
  `AGENTS.md` pins. Fallback (Opus, then Codex, then Cursor, then grok)
  happens only on confirmed quota, availability or unsupported-model
  failures, with the launch argv captured. Junie is preferred first while
  JetBrains credits remain, once its adapter exists.
- **Reconciler.** It arms one watch per live hold, re-arms watches when their
  cap expires, and fails lint when a live hold has no armed watch.
- **Commands and secrets.** `SKULK_ALLOW_EXEC`-style gating for stored
  commands. Commands fetch their own credentials through the `op` shim.
  Nothing secret is stored or logged.
- **Daemon.** It runs under `agent-runs.slice` or its own user unit, and writes
  a heartbeat the dead-man workflow can read.
- **Attribution.** The port carries MIT attribution to kitlangton/skulk.

## Acceptance Criteria

- [ ] `Condition` and `Watch` schemas, plus engine tests for the check
      classification, the creation check, one wake and the limits.
- [ ] Timer and npm triggers deliver one wake through the router to a live
      orchestrator session, with a receipt from a real run.
- [ ] The reconciler arms watches for live hold-ledger records and fails lint
      on a live hold with no armed watch.
- [ ] gh-run and pr-checks triggers work with adaptive polling.
- [ ] With no live orchestrator, the dispatcher launches a hold lane through
      `@beep/ai-provider-cli`, and a forced quota failure falls through the
      chain with the argv captured. A receipt is attached in `history/`.
- [ ] The daemon user unit is rendered and installed through a `--refresh`
      path, and the dead-man workflow opens an issue on a stale heartbeat
      (fixture-tested).
- [ ] An agent skill documents arming watches instead of sleep-polling, and
      the safe-subcommand permission list.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/wake-service/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/wake-service/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/wake-service` | Passes |
| Package handoff | `bun run beep quality package-verify <new wake package>` and `@beep/repo-cli` | Passes |
| Live wake receipt | A timer and an npm watch delivered once to an orchestrator session | Recorded in `history/` |
| Dispatcher receipt | A forced quota failure walks the chain | Recorded in `history/` |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-31 | A general skulk port with delivery through the router; the orchestrator first, then the dispatcher; Junie preferred, Muse excluded; the daemon on the workstation with a dead-man check; a new tooling library plus a `Wake` command group. | Settled in the exploration align and shape rounds, [`DECISIONS.md`](../../explorations/expiring-repo-facts/DECISIONS.md). | Reopen the exploration at `align`. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
