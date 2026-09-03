# Research

## 2026-09-03 — Synthesis

This packet asks where Grok Bot can add judgment without becoming an unsafe or
unverifiable publisher.

The complete lane record is preserved under [`research/lanes/`](./research/lanes/).
The conclusions below distill the product, practice, prior-art, repo-audit, and
bot-pack-design lanes rather than replacing them.

### A. Product facts reframe the vehicle

Grok Bot is a Cursor-hosted product, not a local xAI CLI mode.

Once a Heavy subscription is linked, Bot use is metered on the Cursor account.

Official product pages verified on 2026-09-03 describe a weekly usage reset.

They do not publish a Bot-specific spend cap.

They also do not expose bots as code: roles, skills, connectors, routines, and
computer state are configured through the hosted product.

Published limits are 50 Bots and group chats combined per account, 50 routines
per Bot, 20 retained run records per routine, a 10-minute Teach a Task
recording, 2–6 Bots per group chat, and one computer-use task per Bot screen.

Primary product sources:

- [Introducing Grok Bot](https://x.ai/news/introducing-grok-bot)
- [Grok Bot is now available on more plans](https://x.ai/news/grok-bot-more-plans)
- [Plans and usage](https://cursor.com/help/grok-bot/plans)

The earlier framing incorrectly blended two quota pools. The Cursor-side Bot
grant pays for hosted Bot work; the xAI API pool pays for local CLI or
CLIProxyAPI work. Using the local pool for checkout verification does not
reveal the hosted weekly grant or the actual Heavy charge. Those values remain
operator-visible questions in the usage meter.

The hosted environment is one shared Firecracker microVM per user. Bot
identities are roles, not security boundaries. Provider OAuth is the
appropriate hosted credential shape. The VM must not receive 1Password or
publishing authority.

The exact served model, VM toolchain, scheduler semantics, connector tools, and
Cloud Agent payload ceiling remain unverified.

See [the product-facts lane](./research/lanes/g1-grok-bot-facts.md) and
[the practices lane](./research/lanes/g2-use-cases-and-practices.md).

### B. Hosted routines are useful but not deterministic

The strongest field pattern is a specialist Bot with one recurring job.
Hosted strength is broad discovery and judgment across web, X, GitHub, and
computer-use surfaces.

Hosted weakness is proof against a particular local checkout and its tools.

The observed scheduler queued nominal slots 10–37 minutes late.

Some successful runs produced no visible chat message.

That makes chat history and the Bot UI's 20-run window insufficient receipts.

The local receiver therefore needs durable outcome receipts for success,
no-op, partial, and failure.

A local boot catch-up can cover a missed or late hosted run only when it uses
the same idempotency key.

Exact grace-window arbitration remains a shape-stage schema decision.

See [the practices lane](./research/lanes/g2-use-cases-and-practices.md) and
[the synthesis](./research/lanes/SYNTHESIS.md).

### C. The repo has a real backlog, not a generic token sink

The repo audit found 58 packages and 347 modules in the sampled documentation
surface, with 99 exports.

Four sampled exports lacked an example.

Twelve carried an undescribed `@see` reference.

The audit counted 427 prose findings requiring classification rather than an
unreviewed rewrite sweep.

The knowledge-reference inventory found 29,335 references. Of those, 2,446
were broken and 491 unchanged in the measured comparison.

The style-and-law inventory counted 221, 92, 2, 66, 385, and 87 candidate
occurrences across its six measured rule families. These numbers prove useful
work exists; they do not prove that an LLM should edit it automatically.

The existing nightly research corpus contained 106 claims and 101 suggested
actions across five partial packets.

That volume exposes a disposition problem: suggestions need an append-only,
single-writer ledger outside immutable packets.

See [the automation audit](./research/lanes/codex-c1-automation-audit.md) and
[the synthesis](./research/lanes/SYNTHESIS.md).

### D. Prior art favors proposals, evidence, and deduplication

Documentation products couple prose to paths or code symbols and surface
attention when drift is detected.

Review bots repeatedly fail when comment volume outruns precision.

Public reports show teams mute a noisy bot after a short bad run.

A second model that merely suppresses the first model's comments compounds the
problem instead of creating proof.

Agentic workflow systems converge on read-only defaults, declared outputs,
isolated execution, and human review.

Scheduled coding agents have also produced near-duplicate, failing pull
requests in the exact model-and-schedule shape considered here.

This packet therefore treats zero duplicate delivery as a promotion gate.

It also separates sensing, judgment, verification, and publication.

See [the prior-art lane](./research/lanes/g3-prior-art.md).

### E. Existing repo capabilities should be composed

GitHub Actions can sense deterministic repository and GitHub state.

The local checkout can prove facts that depend on `bun`, the Effect reference
checkout, the 1Password shim, and recorded browser QA.

Yeet already owns publication and hosted closeout.

The repo scheduler already models admitted local work and backpressure.

The Research command family already owns the nightly-research operational
surface, although its promised nightly commands are planned and not shipped.

The architecture routes repo automation to `packages/tooling/tool/cli`.

The existing `@beep/skill-contract` package exports `EvidenceReceipt`,
`EvidenceDigest`, `EvidenceLadder`, and `RecoveryAttemptReceipt`.

Bot receipts must bind those models instead of creating a parallel family.

The desired authored source is a future top-level pack root, while runtime
schemas, validation, rendering, dry-run behavior, timers, and receipt handling
belong in the repo CLI.

No pack directory or runtime code belongs in this exploration PR.

See [the automation audit](./research/lanes/codex-c1-automation-audit.md),
[the bot-pack design](./research/lanes/codex-c2-botpack-design.md), and
[`standards/architecture/07-non-slice-families.md`](../../standards/architecture/07-non-slice-families.md).

### F. The runtime contract is a capability split

Hosted Grok Bot discovers and judges public or provider-authorized material.

GitHub Actions senses deterministic repository and GitHub events. A local
timer or local proxy lane verifies checkout-dependent claims. Only the local
lane publishes, and it publishes through Yeet. Hosted connectors never open
pull requests. Merge authority remains human.

Version one may write reports, GitHub issues, and handoff artifacts only.

A later pack may earn local draft-PR authority after several clean,
deduplicated runs and pack-specific evaluation.

The first report-only pack is `effect-v4-upstream-watch`.

Its fixtures cover both no-change and real-change cases.

Hosted and local runs must derive identical idempotency keys.

Truncated or capability-incomplete handoffs must be rejected.

Capability partials must stay explicit.

Duplicate delivery must remain zero.

After that proof, the sequence is research suggested-action reconciliation,
knowledge and staleness disposition, then one-package documentation enhancement.

The documentation bot is the first candidate for earned write authority.

See [the synthesis](./research/lanes/SYNTHESIS.md),
[the grill](./research/lanes/GRILL.md), and
[the bot-pack design](./research/lanes/codex-c2-botpack-design.md).

### G. Handoffs must fail closed

The public-safe mailbox is a GitHub issue.

A small envelope comment precedes numbered JSONL parts.

Each part carries its byte count and SHA-256 digest.

A completion marker closes the transfer.

Before any model or publisher sees records, the receiver verifies the schema,
part count, record count, byte count, per-part and whole-object digests,
completion marker, and redaction result.

Partial recovery is rejection, not degraded success.

Private records use a content-addressed local store instead.

Inline base64 or gzip prompt payloads are forbidden.

This design keeps hosted transport public-safe and makes completeness
independent of model judgment.

See [the bot-pack design](./research/lanes/codex-c2-botpack-design.md) and
[the grill](./research/lanes/GRILL.md).

### H. Security and promotion boundaries

External web, X, issue, comment, commit, and file text is data, never
instructions.

State-changing hosted tools require approval.

The shared Bot VM holds provider OAuth only.

It holds neither 1Password access nor publisher authority.

A routine that reads untrusted material must not also hold secrets and
state-changing tools.

This is the existing Rule of Two boundary applied to bot automation.

The `beep-mode` decisions remain binding where they define vendor shape,
model-role routing, agent responsibilities, autonomy, stickiness, evaluation,
and graduation.

This packet is a sibling exploration and later goal, not a fourth phase of
that packet.

Numeric budgets, pause thresholds, trigger coordinates, arbitration details,
and connector preflights remain deferred exactly as recorded in
[`DECISIONS.md`](./DECISIONS.md).

The resulting architecture is deliberately asymmetric: hosted judgment finds
work; deterministic local proof decides whether it may be published.
