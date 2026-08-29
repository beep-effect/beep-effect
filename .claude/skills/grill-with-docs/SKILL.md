---
name: grill-with-docs
description: Repo-native grilling session for beep-effect2 architecture work. Use when stress-testing a plan against the binding architecture standard, glossary, decision log, shared-kernel promotion records, and package topology before updating docs or implementation.
---

<what-to-do>

Run a `/grilling` session (frontier rounds, recommended answers, sub-agent fact-finding) over the plan, using the repo doctrine surfaces below as this repo's domain model — challenge terms, cross-reference code, and update the owning doc as each decision crystallizes.

If a question can be answered by exploring the codebase or architecture docs, explore first instead of asking.

Treat this repo's architecture docs as target doctrine. If current code disagrees with the docs, surface the disagreement as possible drift unless the docs explicitly mark the rule as transitional compatibility or cleanup-on-touch.

</what-to-do>

<supporting-info>

## Canonical docs

This repo does not use the generic `CONTEXT.md` plus ADR directory model for architecture grilling.

Use these surfaces instead:

- `standards/ARCHITECTURE.md` - binding architecture constitution and default rule source.
- `standards/architecture/README.md` - rationale packet index, transition notes, known unknowns.
- `standards/architecture/GLOSSARY.md` - canonical architecture vocabulary.
- `standards/architecture/DECISIONS.md` - dated architecture-wide decision log.
- `standards/architecture/02-shared-kernel.md` - shared-kernel promotion record rules.
- `standards/architecture/13-onboarding-the-minimum-viable-slice.md` - smallest legal slice and first cross-slice promotion.
- Package README files - promotion records and package-local ownership policy.
- `packages/fixture-lab/specimen` - executable proof target for package shape, boundary subpaths, and strict port-to-action error translation.

When a plan touches a specific doctrine area, read the matching numbered doc before asking the next question:

- slice topology and cross-slice imports: `01-hexagonal-vertical-slices.md`
- shared-kernel placement: `02-shared-kernel.md`
- external wrappers and repository implementations: `03-driver-boundaries.md`
- schema-first rich domain behavior: `04-rich-domain-model.md`
- Effect Layer ownership: `05-layer-composition.md`
- config/public/server/secrets/layer/test boundaries: `06-configuration-boundaries.md`
- foundation, drivers, tooling, and capability routing: `07-non-slice-families.md`
- testing boundaries: `08-testing.md`
- action, port, driver, and protocol error translation: `09-errors-across-boundaries.md`
- workflows, events, and cross-slice processes: `10-cross-slice-coordination.md`
- deprecation, versioning, and feature-flag retirement: `11-evolution-and-deprecation.md`
- tracing, logging, span names, and attributes: `12-observability.md`

## Grilling posture

Start by classifying the proposal:

- Product behavior or product language -> owning slice first.
- Product language deliberately shared by multiple slices -> `shared/*`, after the promotion gate.
- External engines, SDKs, services, frameworks, or browser platform wrappers -> `drivers/*`.
- Repo-owned domain-agnostic reusable substrate -> `foundation/*`, after the specific-home-first routing test.
- Typed runtime/application settings -> slice or shared `config` package.
- Product-agnostic UI primitives -> `foundation/ui-system`.
- Browser/client product behavior -> slice `client` or `ui`.
- App runtime wiring -> app entrypoint or app-local `src/runtime/Layer.ts`.

Then work the frontier in rounds per `/grilling`. Every question should materially change the plan, lock an assumption, or choose between meaningful tradeoffs. Provide your recommended answer.

Good first questions usually decide:

- Which slice, shared-kernel package, driver, foundation family, or tooling package owns the meaning?
- Is this target doctrine, transitional compatibility, cleanup-on-touch, forbidden in new work, or pending automation?
- Does this need a new package, or can it fit the smallest legal slice/package set?
- Is a shared export really deliberate cross-slice product language, or just reusable shape?
- Is live Layer composition staying in `server`, `client`, or app-local runtime code rather than `use-cases`?
- Do public action errors, server-only port errors, driver/internal errors, and protocol failures die at the right boundaries?
- Can the slice be tested with only its own Layers plus shared test-kit and driver test Layers?

## Challenge against doctrine

Challenge vague or conflicting language immediately:

- If the user says `shared`, ask whether they mean shared-kernel product semantics or domain-agnostic foundation substrate.
- If the user says `provider`, ask whether the target architecture calls it a repo-level driver.
- If the user says `env`, ask whether this should be a typed config contract and whether direct environment reads are being avoided.
- If the user says `runtime layer`, ask whether it is app-local composition or a God Layer smell.
- If the user says `application error`, ask whether it is a public action error, server-only port error, domain failure, internal driver failure, or protocol failure.
- If the user says `common`, `core`, `utils`, or `lib`, route it through the specific-home-first table before accepting the home.

When the user proposes a boundary, test it against concrete repo scenarios:

- Can another slice import this without a direct cross-slice package dependency?
- Can browser code import this without pulling server config, secrets, driver roots, or live Layers?
- Can the owning slice be removed or rewritten without editing unrelated slices?
- Would a trace tree mirror the architecture boundaries?
- Would a test have to boot another slice or an app runtime Layer?
- Would a future reader know the module's role from package path and role suffix?

## Cross-reference with code

When the user states how something works, check the repo before accepting it.

Prefer targeted reads and searches:

- root package, workspace, and export maps when package boundaries are involved
- package README and package manifests when shared/foundation/driver/tooling placement is involved
- role files and imports when topology or subpath safety is involved
- `packages/fixture-lab/specimen` when strict architecture proof is relevant
- existing tests when acceptance criteria or slice-isolation claims are involved

If code contradicts doctrine, say so plainly and classify the contradiction:

- current drift from target doctrine
- transitional compatibility allowed by the docs
- cleanup-on-touch candidate
- missing doc decision or glossary term
- genuine doctrine gap that needs a decision-log update

## Update docs inline

Update canonical docs as decisions crystallize, but only the surface that actually owns the decision:

- New or changed architecture term -> `standards/architecture/GLOSSARY.md`; follow `CONTEXT-FORMAT.md`.
- Architecture-wide doctrine change -> `standards/architecture/DECISIONS.md`; follow `ADR-FORMAT.md`.
- Rule text or examples changing -> the relevant numbered architecture doc and, if binding, `standards/ARCHITECTURE.md`.
- High-bar `shared/*` export -> package README promotion record; use the schema in `02-shared-kernel.md`.
- Package-local ownership, consumers, or routing policy -> the affected package README or agent guidance.

Do not create generic context files or ADR directories for this repo. If a proposed doc update does not fit one of the surfaces above, ask whether it is package-local guidance, architecture doctrine, or implementation notes.

## Offer durable records sparingly

Only propose a DECISIONS entry when all are true:

1. The decision changes architecture-wide doctrine or supersedes prior doctrine.
2. It is hard enough to reverse that future maintainers need the rationale.
3. It resolves a real tradeoff or a known-unknown from the architecture packet.

For high-bar shared exports, do not use DECISIONS as a substitute for promotion records. The package README record is the durable proof of deliberate shared coupling.

</supporting-info>
