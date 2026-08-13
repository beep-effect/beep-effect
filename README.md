# beep-effect

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/beep-effect/beep-effect)
[![Greptile: The War on Bugs](https://www.greptile.com/badge.svg)](https://www.greptile.com/?utm_source=oss_badge&utm_medium=readme&utm_campaign=greptile_for_open_source)

This repository is a trauma response with dependency injection.

It started as a way to never rebuild auth. It stayed because my father is
opening a solo intellectual-property practice, and every legal AI that can
cite its sources wants his client files in someone else's cloud.

**Prose-to-Proof** is the product. A local-first workbench for a professional
who cannot afford a hallucination. Documents go in. Candidate claims come out.
Nothing becomes practice memory until the exact source span checks out and the
attorney says yes.

> Obsidian for lawyers — but it proves its sources.

---

## What this is

A solo IP attorney is the whole firm: partner, associate, paralegal, librarian,
and IT. Cloud tools that "show their work" process client material on someone
else's servers. Local tools that keep the files on-device mostly shrug when you
ask *where that sentence came from*.

This repo exists to occupy the unoccupied intersection:

- **local-first** — client data stays on the machine by default
- **every assertion grounded** — a plausible citation is not evidence
- **IP-specialized** — office actions, matters, inventors, claims, deadlines

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
- **Not a cloud SaaS.** Practice files and the local store stay on the
  machine. The current desktop default still calls a configured model
  provider (Anthropic today) for chat turns and extraction when a key is
  present — that is an explicit egress, not a silent vault upload.
  Embeddings are intended on-device. Privilege is not a Terms-of-Service
  checkbox.
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
[`docs/ROADMAP.md`](docs/ROADMAP.md). Packet lifecycle lives in
[`goals/INDEX.md`](goals/INDEX.md).

---

## How it started

I used to work on a warehouse management system. Fortune 500 clients.
Healthcare. Pharmaceuticals. The VA. Regulated industries where data integrity
is not a nice-to-have.

The codebase had no foreign keys.

Not "some tables were missing foreign keys." *None of them had foreign keys.*
`tenant_id` was a vibes-based suggestion. Multi-tenant isolation was "we trust
the application layer" and "QA will catch it." The POC became production
because someone showed it to a stakeholder. The hardening phase is in the
backlog. It will always be in the backlog.

I sat in sprint reviews for two years. We pointed at the same debt. We agreed
it mattered. We walked out. Nothing moved. Story points are astrology for
project managers. Velocity is a number we invented so the board would have a
number. The deadline was set before the requirements existed. You said two
weeks. You lied. Pressure code borrows time at a rate you cannot pay.

Every SaaS idea I spawned after that started the same way: three weeks
rewiring auth, uploads, and settings, then I got impatient and duct-taped the
dream. This repo was supposed to make Idea #37 start at "ship."

Then the idea that mattered showed up, and it was not another SaaS. It was
building the machine my father will actually run his practice on.

The VA deserved foreign keys. An IP attorney deserves a privilege wall and
citations that exist.

---

## This repo has no backlog

It has compile errors.

If a table needs a tenant, the type system rejects the table. If a third-party
contract is violated, the schema throws. If a citation cannot point at a real
span, it does not become a fact. The backlog is empty because bad states do
not merge.

This is not agile. This is spite.

Every factory is a scar. Every type constraint is a promise that you will not
repeat my mistakes, because I have made them impossible to compile.

- **Branded IDs.** `UserId` is not `string`. `OrganizationId` is not `string`.
  The type system remembers what you will forget.
- **Drivers, not SDK leakage.** Treat every third-party like it is trying to
  kill you. They ship breaking changes on Tuesdays. When — not if — they
  betray you, the adapter burns. The domain does not know. The domain does
  not care.
- **Ground before cite.** Machine output has zero citation authority. A
  quote crosses only when the proposed span reproduces the source. See
  [`docs/product/citation-grounding.md`](docs/product/citation-grounding.md).
- **Matter walls.** A matter is a named subgraph and an ethical wall. Cross-
  matter reads for conflict checks are a specific, bounded question — not
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

APIs get validated against the checked-in Effect source in `.repos/effect`,
not against whatever an agent remembers from training. See
[`standards/effect-first-development.md`](standards/effect-first-development.md)
and
[`standards/schema-first-development-prompt.md`](standards/schema-first-development-prompt.md).

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
research/       machine intel — it proposes, it does not append itself
```

If this concerns you, remember: the alternative was me doing it manually at
2am. The agents do not get tired. The agents do not cut corners when they are
frustrated. I trust the recursion more than I trust myself after midnight.

Shipping that recursion without lying to git is
[`bun run beep yeet`](packages/tooling/tool/cli/README.md). Feature branch.
Proof. PR. Hosted checks. No `wip` on `main`.

---

## Run it

This is a laboratory, not `npx create-beep`. You want Bun, a willingness to
read, and the onboarding doc — not a four-command fantasy.

```bash
bun install
bun run beep yeet verify          # the real quality bar
bun run beep architecture         # the generator surface
```

Dev servers go through portless hostnames, never raw `localhost:3000`:

```bash
# examples — see each app's package.json
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

---

## First-party history vs `.repos/effect`

First-party work lives under `packages/`, `apps/`, `infra/`, `goals/`,
`explorations/`, `standards/`, and the authored `docs/` tree.

`.repos/effect` is a squash-pinned Effect v4 source pin so agents validate
APIs against checked-in Effect source instead of training-data priors. It is
force-tracked under an otherwise-ignored `.repos/*` rule.

Do **not** add new full-history git subtrees. Refresh Effect with a squash.
Historical subtree imports still sit in git objects and poison naive
`git log` author counts — those names are not first-party contributors.

---

## The promise

I will never again:

- Forget a foreign key
- Trust a third-party SDK
- Let tenant data leak
- Ship untyped errors
- Send privileged files to a cloud chatbot and call it "AI strategy"
- Let a model invent a citation
- Attend a sprint review where tech debt does not move

If you call this over-engineered, wait until you meet a malpractice carrier.

This is not documentation. This is a restraining order against bad decisions,
signed by the TypeScript compiler, served on every language model that wants
to practice law without a license.

---

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

Public laboratory. Session notes you can clone. Not a support contract.

---

*"It's not a business priority."*

— Everyone who has ever created a production incident that was absolutely
their fault
