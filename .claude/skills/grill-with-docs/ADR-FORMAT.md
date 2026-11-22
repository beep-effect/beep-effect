# Architecture Decision Format

In this repo, architecture-wide decisions live in
`standards/architecture/DECISIONS.md`. Do not create a generic ADR directory
under `docs/` for architecture work.

Use `DECISIONS.md` only for decisions that amend, supersede, retire, or clarify
architecture-wide doctrine. Package-local decisions that pass the admission
test below are one file each under `<package>/decisions/`; ownership and usage
notes stay in the package README or agent guidance. High-bar `shared/*` exports
require promotion records, not decision-log entries.

## Entry shape

Append a dated section:

```md
## YYYY-MM-DD: Short Decision Title

- **Status:** Active

Decision:

{One or two short paragraphs stating the new doctrine. Name the affected
boundaries, package families, export surfaces, or migration buckets.}

Rationale:

{One or two short paragraphs explaining the tradeoff, rejected direction, and
why the chosen rule preserves modularity, optionality, or boundary clarity.}
```

When revising older doctrine, update the old entry too:

```md
- **Status:** Superseded
- **Superseded-by:** [YYYY-MM-DD: New Decision Title](#yyyy-mm-dd-new-decision-title)
```

For retirements, follow `11-evolution-and-deprecation.md`: mark the original
entry superseded when applicable and append the new retirement decision.

## When to add a DECISIONS entry

All of these should be true:

1. The decision changes repo-wide architecture doctrine or closes a known
   doctrine gap.
2. The decision is hard enough to reverse that future maintainers need the
   rationale trail.
3. The decision resolves a real tradeoff, rejected alternative, or current
   ambiguity in the architecture packet.

Good fits:

- changing slice topology, canonical package kinds, or dependency direction
- changing public subpath contracts such as `/public`, `/server`, `/layer`, or
  `/browser`
- accepting or retiring a non-slice family/kind rule
- changing shared-kernel promotion rules
- changing driver/server/use-case ownership boundaries
- changing error taxonomy, testing isolation, observability, or deprecation
  doctrine
- retiring a slice or superseding a prior architecture rule

Poor fits:

- one package's implementation detail; use a package decision file instead
- a temporary migration note with no doctrine impact
- a reusable helper that only needs package README ownership notes
- a high-bar `shared/*` export promotion; use the package README promotion
  record instead
- enforcement implementation details that do not change the architecture rule

## Package decisions

A package decision records why one package's code is the way it is. Write one
only when all three hold:

1. A named rejected alternative exists that a competent agent would choose again.
2. Undoing the decision stays green, or turns a check red without telling the
   reader why.
3. It governs more than one statement, or crosses a security, legal, protocol,
   data or package boundary.

Otherwise move the knowledge to the first rung that carries it: a name, a type
or schema, an assertion, a test title, or exported JSDoc `**Gotchas**`.

Each decision is `<package>/decisions/<YYYY-MM-DD>-<slug>.md`. Frontmatter:
`title`, `date`, `reversal`, `governs` (non-empty list of
`<package-relative path>#<declaration>` anchors), `enforcedBy` (list, may be
empty, of `<test path>#<describe or test title>` or `lint:<rule>`, written
only after the stated reversal turned that check red in a scratch copy),
optional `supersedes` and `pullRequest`. The body holds at most 12 lines and
no code fences: the decision, the reason, `Rejected:` and, if any,
`Accepted limit:`. The slug is the id; superseding deletes the old file in the
same change. Source may cite one with a line comment `// decision: <slug>`
alone on its line. `bun run beep decisions check` resolves every anchor and
pointer; `bun run beep decisions for <path>` lists the decisions governing a
file.

## Promotion records are different

For meaningful exports in high-bar `shared/*` packages, use the promotion record
schema from `standards/architecture/02-shared-kernel.md` in the affected
package README:

```md
### Promotion record: <export name>

- **Date promoted:** YYYY-MM-DD
- **Shared product semantics:** <one sentence on the cross-slice meaning>
- **Current consumers:** <list at least two packages or explicit cross-slice rationale>
- **Rejected homes:**
  - Owning slice - <why it cannot stay local>
  - Foundation - <why it is not domain-agnostic substrate>
- **Surface:** <symbols and canonical subpaths>
- **Runtime limits:** <contract-only, no live Layers, or the approved limit>
- **Coupling acceptors:** <review sign-off or PR link>
- **Removal trigger:** <condition for retirement>
```

Records are kept with the package because they document coupling accepted by
that package. `DECISIONS.md` records architecture policy; it does not replace
promotion evidence.

## Updating doctrine docs

If a decision changes rule text, examples, or routing guidance, update the
relevant numbered architecture doc in the same pass:

- `01` for slice topology and direct-import rules
- `02` for shared kernel and promotion records
- `03` for driver/server/table boundaries
- `04` for rich schema-first domain modeling
- `05` for Layer ownership
- `06` for config boundaries
- `07` for non-slice family/kind routing
- `08` for testing isolation and contract tests
- `09` for error translation boundaries
- `10` for cross-slice events and processes
- `11` for evolution, deprecation, and flags
- `12` for observability
- `13` for scratchpad, minimum viable slice, and onboarding

Update `standards/ARCHITECTURE.md` when the binding constitution itself changes.
Use the companion packet for rationale and examples.
