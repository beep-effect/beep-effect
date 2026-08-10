# Architecture Rationale Packet

This folder is the companion packet for
[`standards/ARCHITECTURE.md`](../ARCHITECTURE.md).

`ARCHITECTURE.md` is the binding constitution/tutorial. It tells the repo what
is allowed, what is preferred, and where code belongs. This folder explains why
those rules exist, records the vocabulary, and preserves the decision trail.

## Thesis

beep-effect should be easy to experiment in without becoming easy to damage.
The architecture therefore treats topology as durable product infrastructure:
package boundaries, domain-kind folders, role suffixes, driver boundaries, and
shared-kernel boundaries are not cosmetic. Configuration boundaries and
non-slice family/kind boundaries now carry the same weight. They are how the
repo keeps domain experiments modular, composable, and reusable.

## Transition Note

This packet stays target-only. Start with
[`ARCHITECTURE.md#how-to-use-this-standard`](../ARCHITECTURE.md#how-to-use-this-standard)
for the task-routing quick start, then use this packet for rationale.

Use the routing table below to translate current repo names while migrating; do
not treat legacy roots, package-root exports, or `./*` wildcard exports as the
normative target shape.

| Current label | Route to target                                                                                                                                                  |
|---------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `providers`   | `drivers`                                                                                                                                                        |
| `env`         | `config`                                                                                                                                                         |
| `protocol`    | `use-cases/public` when client-safe; otherwise `use-cases/server`                                                                                                |
| `runtime`     | `server` or `client`; use `drivers` only when wrapping an external engine; treat top-level app assembly as an entrypoint concern, not a canonical package family |
| `common`      | `foundation` by default; use `shared/*` or a concrete slice when the code carries product semantics                                                              |
| `core`        | `foundation` for runtime-neutral substrate; otherwise `shared/*` or a concrete slice when the code carries product semantics                                     |
| `utils`       | `foundation` for domain-agnostic helpers; otherwise route to `shared/*` or the owning slice                                                                      |
| `lib`         | `foundation` by default; route to `shared/*`, `drivers`, or a concrete slice when the code has a clearer boundary                                                |

Boundary-sensitive packages use explicit subpaths as the canonical contract.
Package roots and `./*` exports may still exist during migration, but they are
compatibility leftovers rather than the intended architecture.
Legacy names such as `common`, `core`, `utils`, and `lib` should be treated the
same way: compatibility leftovers to be routed into `foundation`, `shared/*`,
`drivers`, or a concrete slice rather than preserved as target-era package
roots.

The binding standard separates migration state into five buckets: `Target
Doctrine`, `Transitional Compatibility`, `Cleanup-On-Touch`, `Forbidden In New
Work`, and `Pending Automation/Generator Support`. Cleanup-on-touch is scoped
to the boundary being edited; it is not a default instruction to sweep whole
package families.

Compile-ready proof lives in `packages/architecture-lab/*` with
`apps/architecture-lab-proof`. The numbered docs may use short membership
sketches to explain the rule, but the architecture lab WorkItem slice is the
canonical executable example for package shape, boundary subpaths, and
port-to-action error translation.

## Start here

New to this architecture? Read
[`13-onboarding-the-minimum-viable-slice.md`](./13-onboarding-the-minimum-viable-slice.md)
first. It walks through the smallest legal slice, the smallest legal
cross-slice promotion, and a 60-second guide to reading any slice path. Come
back here for the rationale once the shape clicks.

## Document Index

| Document                                                             | Purpose                                                                        |
|----------------------------------------------------------------------|--------------------------------------------------------------------------------|
| [`GLOSSARY.md`](GLOSSARY.md)                                         | Canonical taxonomy for architecture terms.                                     |
| [`DECISIONS.md`](DECISIONS.md)                                       | Dated decision log and amendment trail.                                        |
| [`00-philosophy.md`](00-philosophy.md)                               | North star and grounding principles.                                           |
| [`01-hexagonal-vertical-slices.md`](01-hexagonal-vertical-slices.md) | Why slices combine hexagonal ports with vertical package topology.             |
| [`02-shared-kernel.md`](02-shared-kernel.md)                         | Why `shared` is a DDD shared kernel, not a dump.                               |
| [`03-driver-boundaries.md`](03-driver-boundaries.md)                 | Why drivers expose technical capability while server implements product ports. |
| [`04-rich-domain-model.md`](04-rich-domain-model.md)                 | Why the repo prefers hybrid rich domain models over anemic data bags.          |
| [`05-layer-composition.md`](05-layer-composition.md)                 | Why slice-local Layer composition replaces runtime God Layers.                 |
| [`06-configuration-boundaries.md`](06-configuration-boundaries.md)   | Why config is a typed contract package, not env access or a constants dump.    |
| [`07-non-slice-families.md`](07-non-slice-families.md)               | Why foundation, drivers, and tooling need explicit topology grammar.           |
| [`08-testing.md`](./08-testing.md)                                   | Testing strategy: domain in isolation, use-case stubs, fixture ownership, contract tests, slice-isolation guarantee. |
| [`09-errors-across-boundaries.md`](./09-errors-across-boundaries.md) | Error translation across hexagonal boundaries: who translates, where, what the function looks like. |
| [`10-cross-slice-coordination.md`](./10-cross-slice-coordination.md) | Workflow / saga / process-manager governance; future `shared/use-cases` event contracts; God Process Manager anti-pattern. |
| [`11-evolution-and-deprecation.md`](./11-evolution-and-deprecation.md) | Slice retirement, future `shared/use-cases` versioning, port deprecation, feature-flag lifetime. |
| [`12-observability.md`](./12-observability.md)                       | Span naming, attribute conventions, logging vs tracing vs Console; slice boundaries as span boundaries. |
| [`13-onboarding-the-minimum-viable-slice.md`](./13-onboarding-the-minimum-viable-slice.md) | Scratchpad lane, minimum-viable-slice walkthrough, first cross-slice promotion, slice-path reading guide. |
| [`14-ecosystem-packages.md`](./14-ecosystem-packages.md) | Why publishable repo-authored libraries get their own flat family: inverted `@beep/*` gate, style-law scoping, artifact/peer policy, release lane, gate profile, promotion/demotion. |

## Known Unknowns

The architecture standards in this set were authored over a 10-day burst
(2026-04-21 → 2026-05-01) and have not yet been load-tested at scale. The
following areas are most likely to be revised after first contact:

- **Promotion record enforcement.** The schema (`02-shared-kernel.md` Appendix)
  is in place but lint enforcement (`lint:promotion-records`) is planned, not
  implemented.
- **Cross-slice workflow boundaries.** `10-cross-slice-coordination.md`
  codifies the rules but the God Process Manager diagnostic has not yet caught
  a real case in this repo.
- **Deprecation windows.** `11-evolution-and-deprecation.md` proposes
  2-minor-release / 1-quarter / 6-week defaults; these are starting values that
  should be tightened or relaxed based on actual evolution velocity.
- **Span/attribute conventions.** `12-observability.md` codifies the mapping
  but no live trace from this repo has yet validated that the names render
  legibly in our actual tracing tooling.
- **Onboarding claims.** `13-onboarding-the-minimum-viable-slice.md` claims a
  "smallest legal slice" of ~15 files; this should be verified by an actual new
  contributor on a real task.

When any of the above is revised, append a corresponding `DECISIONS.md` entry
and remove or update the bullet here.

## Relationship To Standards

| Standard                                                               | Relationship                                                   |
|------------------------------------------------------------------------|----------------------------------------------------------------|
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md)                             | Binding architecture constitution.                             |
| [`../effect-first-development.md`](../effect-first-development.md)     | Effect implementation style used inside the architecture.      |
| [`../effect-laws-v1.md`](../effect-laws-v1.md)                         | Repo-wide Effect law checks that implementation must satisfy.  |
| [`../memory-architecture/README.md`](../memory-architecture/README.md) | Precedent for standards that close architectural search space. |

## Anti-Goals

- This is not a repo-cli design.
- This is not a codegen matrix.
- This is not a lint implementation plan.
- This is not an archive of every debate.

This packet preserves the reasoning that matters for future design work. The
binding rules live in `ARCHITECTURE.md`.
