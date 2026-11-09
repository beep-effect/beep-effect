# beep-effect

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/beep-effect/beep-effect)
[![Greptile: The War on Bugs](https://www.greptile.com/badge.svg)](https://www.greptile.com/?utm_source=oss_badge&utm_medium=readme&utm_campaign=greptile_for_open_source)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/beep-effect/beep-effect?utm_source=oss&utm_medium=github&utm_campaign=beep-effect%2Fbeep-effect&labelColor=171717&color=FF570A&label=CodeRabbit+Reviews)

beep-effect is a public Effect v4 monorepo where I build **Prose-to-Proof**, a
grounded-citation workbench for a solo intellectual-property practice, with
coding agents working under CI gates and an auditable execution record.

It started as a way to never rebuild auth. It stayed because my father is
opening a solo IP practice, and every legal AI he tried wanted his client
files and still could not show which page a sentence came from.

Documents go in. Candidate claims come out. Nothing becomes practice memory
until the exact source span checks out and the attorney says yes.

> Obsidian for lawyers, but it proves its sources.

---

## How it is built

The product is the reason this repo exists. The engineering practice is what a
visitor can actually read today.

- **Every change passes gates before it lands.** Change profiling and
  heavy-tier admission, coverage regression, property laws, a JSDoc ratchet,
  secrets and security scans, SAST
  ([`.github/workflows/check.yml`](.github/workflows/check.yml)). Ratchets
  only tighten ([`goals/quality-gate-ratchets/`](goals/quality-gate-ratchets/README.md)).
  In October 2026 that let 900+ agent-authored PRs merge to `main`, up from
  217 in July, while the median PR got smaller.
- **Review findings block the merge.** Every actionable finding, from a bot
  reviewer or a human, any severity, is fixed in the PR before it lands, and
  whoever merges re-reads the review threads first ([`AGENTS.md`](AGENTS.md)).
- **Agents get default-deny authority.** A tool call needs a grant, and every
  verdict, including a refusal, lands in a hash-chained, append-only record
  ([`goals/agent-execution-authority/`](goals/agent-execution-authority/README.md)).
- **Machine output has zero citation authority.** A quote crosses only when
  the proposed span reproduces the source
  ([`docs/product/citation-grounding.md`](docs/product/citation-grounding.md)).
- **Tenancy and audit are schema, not convention.** Tenant scope is a typed,
  indexed capability that product entities compose, next to actor and source
  columns ([`EntityKit.ts`](packages/shared/domain/src/entity/EntityKit.ts)).
- **Third-party SDKs live only in drivers.** Retries, rate limits and error
  translation stop at that boundary; the domain never imports a vendor
  ([`03-driver-boundaries.md`](standards/architecture/03-driver-boundaries.md),
  56 driver packages so far).
- **Errors are typed and translated at every boundary**, so an API client or an
  MCP tool never sees a stack trace or somebody else's identifier
  ([`09-errors-across-boundaries.md`](standards/architecture/09-errors-across-boundaries.md)).
- **A read-only MCP server over the practice graph**, with tool declarations in
  use-cases and only the process in the app
  ([`apps/practice-kg-mcp`](apps/practice-kg-mcp/README.md)).
- Scale, for what it is worth: about 200 packages, 280+ goal packets, 3,400+
  test files, one maintainer.

---

## What this is

A solo IP attorney is the whole firm: partner, associate, paralegal, librarian,
and IT. Cloud tools that "show their work" rarely prove where a sentence came
from. Local tools that keep the files on-device mostly shrug when you ask.

This repo exists to occupy the unoccupied intersection:

- **local by default**: client data stays on the machine unless a call is
  explicitly configured
- **every assertion grounded**: a plausible citation is not evidence
- **IP-specialized**: office actions, matters, inventors, claims, deadlines

The first user is not a persona. He is my dad. His archive is the seed. His
daily use is the standard. Agents propose; he approves; the record only keeps
what survived. That loop is the product strategy, not a footnote.

The full vision, in human and in schema:

- [`docs/PROSE_TO_PROOF_VISION.md`](docs/PROSE_TO_PROOF_VISION.md)
- [`docs/PROSE_TO_PROOF_FOR_TOM.md`](docs/PROSE_TO_PROOF_FOR_TOM.md)
- [`docs/product/prose-to-proof.md`](docs/product/prose-to-proof.md)
- [`goals/agentic-professional-runtime/`](goals/agentic-professional-runtime/)

```txt
document in
    → model proposes a claim
    → the span must reproduce the source
    → the attorney approves
    → practice memory
```

The model *guesses*. The graph *proves*. Confidence gets you to the boundary.
Only proof gets you across.

---

## What this is not

- **Not a chatbot with a gavel emoji.** A confident model is not an attorney.
- **Not a vault upload.** Practice files and the local store stay in the
  attorney's control. The desktop calls a configured model provider (Anthropic
  today) for chat turns and extraction when a key is present. That is an
  explicit, configured egress, not a silent sync.
- **Not an autonomous lawyer.** Legal advice, filings, and anything a client
  sees wait behind an explicit approval gate.
- **Not a replacement for email, billing, docketing, or the USPTO.** Those
  stay systems of record. This owns claims, evidence, drafts, approvals, and
  provenance.
- **Not a community starter kit.** This is a public laboratory and
  publication, not a help desk. See [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Not a place for privileged files.** Real client material never enters
  git. The repo carries synthetic fixtures only.

---

## What's in front of a user

Honest status, not a launch deck.

| Surface | What it actually is |
| --- | --- |
| [`apps/professional-desktop`](apps/professional-desktop) | Tauri workbench. Today a local chat shell on PGlite. Becoming the document portal. |
| [`apps/practice-kg-mcp`](apps/practice-kg-mcp) | Read-only local MCP server over a portable practice graph. First-user front: Claude Desktop asks the archive; the corpus never enters this repo. |
| [`apps/oip-web`](apps/oip-web) | Public site for Oppold IP Law. Decoupled from the first-user metric. |

The north star is **Prose-to-Proof in front of Tom**: a real attorney doing
real work in a shipped surface. Priority lives in
[`docs/ROADMAP.md`](docs/ROADMAP.md). Packet lifecycle lives in each tracked
`goals/<slug>/ops/manifest.json`; `bun run beep goals index` renders the local,
untracked portfolio view.

---

## How it started

I spent two years building a multi-tenant warehouse management system for
customers in regulated industries. Four products went from empty repositories
to production in that time, and I am proud of them. I am less proud of the
feedback loop. Typecheck grew to half an hour and type errors stopped
surfacing in the editor. I learned that feedback speed is a feature.

Every SaaS idea I spawned after that started the same way: three weeks
rewiring auth, uploads, and settings, then I got impatient and duct-taped the
dream. This repo was supposed to make Idea #37 start at "ship."

Then the idea that mattered showed up, and it was not another SaaS. It was
building the machine my father will actually run his practice on.

The rule I took with me: feedback has to be fast, and the invariants that
matter have to fail before merge, not in a retrospective.

---

## This repo has no backlog

It has compile errors.

Tenant scope is a typed, indexed capability product entities compose, not a
column someone hand-rolls. If a third-party contract is violated, the schema
throws. The backlog stays small because the states I can encode do not merge.

Every type constraint is a promise that a mistake I have already made stays
made once.

- **Branded IDs.** `UserId` is not `string`. `OrganizationId` is not `string`.
  The type system remembers what you will forget.
- **Matter walls.** A matter is a named subgraph and an ethical wall. Cross-
  matter reads for conflict checks are a specific, bounded question, not
  "the model has context."
- **Workspace as data.** Panels, splits, and documents are schema values, so
  an agent arranges the desk through the same kernel the mouse uses. See
  [`docs/product/workspace-substrate.md`](docs/product/workspace-substrate.md).

---

## Effect-first, cry-never

This codebase uses Effect. All of it. v4, because the alternative is waiting
for a newsletter to tell me the ecosystem moved.

- No `async/await` in domain code
- No `try/catch` in domain code. Boundaries may catch; they still surface
  typed errors.
- Dependency injection via Layers
- Errors as values, typed and tracked
- Schema as the source of truth for shape, codecs, and persistence

```typescript
const program = Effect.gen(function* () {
  const db = yield* Database
  const result = yield* db.query(/* ... */)
  return yield* S.decode(ResponseSchema)(result)
})

// NOT this
// async function program() {
//   try {
//     return await db.query(/* ... */) // hope it's valid lol
//   } catch (e) {
//     console.log(e) // cool, very helpful
//   }
// }
```

The Effect version tells you what it needs, what can go wrong, and what it
returns. The async version *hopes*. I am done hoping.

APIs get validated against the live Effect source, not against whatever an
agent remembers from training. See
[`standards/effect-first-development.md`](standards/effect-first-development.md),
[`standards/schema-first-development-prompt.md`](standards/schema-first-development-prompt.md)
and the [reference workspace runbook](docs/runbooks/reference-workspace.md).

---

## The recursion

There is a `goals/` directory. There is an `explorations/` directory. There
is a nightly `research/` routine that proposes, and does not silently become
the plan.

I use agents to write packets for agents to implement. The agent researches.
The agent writes the plan. The agent executes. The agent reflects. The
reflection improves the next packet.

```txt
explorations/   fuzzy front end
goals/          the things we actually committed to
research/       machine intel. It proposes; it does not append itself
```

If this concerns you, remember: the alternative was me doing it manually at
2am. I do not trust the agents either. That is what the gates, the authority
record and review on every PR are for.

Shipping that recursion without lying to git is
[`bun run beep yeet`](packages/tooling/tool/cli/README.md). Feature branch.
Proof. PR. Hosted checks. No `wip` on `main`.

---

## Run it

This is a laboratory, not `npx create-beep`. You want Bun, a willingness to
read, and the onboarding doc, not a four-command fantasy.

```bash
bun install
bun run beep yeet verify          # the real quality bar
bun run beep architecture         # the generator surface
```

Dev servers go through portless hostnames, never raw `localhost:3000`:

```bash
# examples, see each app's package.json
# http://professional-desktop.beep.localhost:1355
# http://oip-web.beep.localhost:1355
```

If something does not work, it is probably Docker. It is always Docker.

Newcomers who came for the *shape* of the monorepo, not the product: start at
[`standards/architecture/13-onboarding-the-minimum-viable-slice.md`](standards/architecture/13-onboarding-the-minimum-viable-slice.md).
The executable architecture proof lives in `packages/architecture-lab/*` with
the `apps/architecture-lab-proof` harness. Binding law:
[`standards/ARCHITECTURE.md`](standards/ARCHITECTURE.md).

---

## The rules

1. **Make `any` painful.** The friction is the point.
2. **Slices do not import other slices.** Cross-slice language earns a
   promotion record or it does not exist.
3. **The compiler is the first reviewer.** Warnings do not compile. Hope
   does not type-check.
4. **Search live source before inventing a helper.** The symbol you want is
   probably already named.
5. **Publish through Yeet.** `main` is PR-only.

Human contribution and vulnerability reporting:
[`CONTRIBUTING.md`](CONTRIBUTING.md) and [`SECURITY.md`](SECURITY.md).
Agent law: [`AGENTS.md`](AGENTS.md).

First-party work lives under `packages/`, `apps/`, `infra/`, `goals/`,
`explorations/`, `standards/`, and the authored `docs/` tree. The gitignored
`.repos/` links point at a reference workspace that
`bun run beep refs provision` sets up; see
[`docs/runbooks/reference-workspace.md`](docs/runbooks/reference-workspace.md).

---

## The promise

I will never again:

- Let a vendor SDK leak past its driver
- Let tenant data leak
- Ship untyped errors
- Let a model invent a citation
- Let a model's output become a record without a human approving it

If you call this over-engineered, wait until you meet a malpractice carrier.

---

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

Public laboratory. Session notes you can clone. Not a support contract.
