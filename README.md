# beep-effect

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/beep-effect/beep-effect)

**Mission.** beep-effect is the Effect-first, schema-first monorepo for building local-first, evidence-backed, governed **professional agentic runtimes**. It ships reliable domain experiments as production-quality vertical slices that can be added, rewritten, or removed without long-term topology debt.

**North Star** (from `standards/ARCHITECTURE.md`)

> beep-effect uses a hexagonal vertical slice architecture for product code. Domain-agnostic reusable substrate, developer-operational packages, and technical boundary wrappers use explicit non-slice family/kind grammar so they are as legible as slices instead of becoming generic `common` buckets.

**Core Bet** (from `standards/architecture/00-philosophy.md`)

> high modularity + consistent topology > low ceremony + improvised structure

---

## Start Here (Newcomers)

**Read this first:** [`standards/architecture/13-onboarding-the-minimum-viable-slice.md`](standards/architecture/13-onboarding-the-minimum-viable-slice.md)

This document walks through the smallest legal slice, the 60-second path decoder, and the promotion ceremony for cross-slice language.

**Minimum viable slice (MVS) shape** (abridged target sketch):

```txt
packages/notes/
  domain/
    src/
      aggregates/Note/
        Note.model.ts
        Note.errors.ts
  use-cases/
    src/
      Note/
        Note.commands.ts
        Note.queries.ts
        Note.ports.ts
        Note.service.ts
      public/
      server/
  server/
    src/
      Note/
        Note.repo.ts
        Note.http-handlers.ts
      Layer.ts
```

**60-second path decoder example**

`packages/iam/server/src/Membership/Membership.http-handlers.ts`

- `packages/` — monorepo packages root
- `iam/` — the slice (bounded context)
- `server/` — slice-family layer (adapters + Layer)
- `src/Membership/` — the concept
- `Membership.http-handlers.ts` — role file (HTTP wiring for the concept)

The onboarding examples are intentionally small sketches. The executable proof
for the current architecture lives in `packages/architecture-lab/*` with the
`apps/architecture-lab-proof` harness.

**Common role suffixes**

| Suffix                | Purpose                                      |
|-----------------------|----------------------------------------------|
| `.model.ts`           | Schema-first class + pure behavior           |
| `.errors.ts`          | `TaggedErrorClass` definitions               |
| `.commands.ts` / `.queries.ts` | Intent shapes                           |
| `.ports.ts`           | Port declarations (`Context.Tag`)            |
| `.service.ts`         | Use-case service composing ports + domain    |
| `.repo.ts`            | Port implementation (server side)            |
| `.http-handlers.ts`   | HTTP wiring (server side)                    |

**Next reading**

- `01-hexagonal-vertical-slices.md` — why slices + hexagonal boundaries
- `08-testing.md` — testing strategy and slice isolation
- `02-shared-kernel.md` — promotion record rules

**Legacy name quick reference** (see `standards/architecture/README.md`)

`providers` → `drivers`, `common`/`core`/`utils` → `foundation` (or `shared/*` or a concrete slice).

---

## Repository Topology

### Foundation Family

Domain-agnostic reusable substrate.

Path: `packages/foundation/<kind>/<name>`  
Kinds: `primitive`, `modeling`, `capability`, `ui-system`

Manifest contract:

```json
{
  "beep": { "family": "foundation", "kind": "modeling" }
}
```

See [`packages/foundation/README.md`](packages/foundation/README.md) and `standards/architecture/07-non-slice-families.md`.

### Shared Kernel

Deliberate DDD cross-slice product language (high bar).

Normal doctrine homes: `domain/`, `config/`.

High-bar leaves: `use-cases/`, `client/`, `server/`, `tables/`, `ui/`. These
must prove a deliberate cross-slice product contract before growing meaningful
exports.

Active leaves in this checkout include `domain/`, `tables/`, and `ui/`;
`config/`, `use-cases/`, `client/`, and `server/` are scaffolded or narrow
boundary surfaces.

**Promotion Bar** — code belongs here only when it is:

- Durable product semantics shared by multiple slices
- Free of driver or slice-specific imports
- Reviewed with a dated promotion record

**Example (abridged promotion record)**

**OnePasswordReference** (promoted 2026-05-14)  

- Shared semantics: A credential input in installer flows is a reference to a 1Password item field, never a plaintext secret.  
- Current consumers: no active product-slice package consumers in this checkout; driver-side probe contracts still share the no-plaintext-secret vocabulary.  
- Rejected homes: Foundation (product security language, not domain-agnostic substrate).  
- Surface: `@beep/shared-domain/values/OnePasswordReference`.  
- Runtime limits: value object only — no live Layers.  
- Full record (including coupling acceptors + removal trigger): see `packages/shared/domain/README.md`.

See [`packages/shared/README.md`](packages/shared/README.md) and `standards/architecture/02-shared-kernel.md`.

### Drivers Family

Thin, repo-level wrappers around external engines, SDKs, and platforms.

Path: `packages/drivers/<name>` (flat family)

Manifest:

```json
{
  "beep": { "family": "drivers" }
}
```

Examples: `postgres`, `drizzle`, `openai`, `xai`, `phoenix`, `ffmpeg`, `runpod`, `discord`, etc.

See `standards/architecture/03-driver-boundaries.md`.

### Tooling Family

Repo operations, generators, quality automation, and policy.

Path: `packages/tooling/<kind>/<name>`

**Key Commands** (most-used day-to-day)

```bash
# Explore architecture commands (the generator surface)
bun run beep architecture

# Example of adding a canonical concept (see full CLI reference for create/add/plan)
bun run beep architecture add concept architecture-lab Worker --domain-kind entities --stage persistence --dry-run

# Create a new package following the rules
bun run beep create-package sandbox --family foundation --kind capability --dry-run

# Local docgen (preferred)
bun run docgen:local

# Quality, security, and effect-law checks
bun run beep quality repo-exports-catalog --check
bun run beep codex quality-review-fix-loop "close the current initiative"
```

Full reference (all commands, flags, and schemas): [`packages/tooling/tool/cli/README.md`](packages/tooling/tool/cli/README.md)

### Product Slices (Vertical Domains)

Each slice owns its own product language and adds only the role packages it
currently needs: domain, use-cases, config, server/client adapters, tables, and
UI are canonical roles, not mandatory scaffolding.

Current slices at a glance (checkout snapshot):

| Slice                  | One-line Role                                      | Live roles                         |
|------------------------|----------------------------------------------------|------------------------------------|
| `workspace`            | Core workspace and thread runtime                  | `domain`, `tables`                 |
| `agents`     | Skills, capabilities, and agent governance         | `domain`, `use-cases`              |
| `epistemic`            | Evidence, claims, candidate work, and provenance   | `domain`                           |
| `law-practice`         | IP law practice models and workflows               | `domain`                           |
| `architecture-lab`     | Canonical executable architecture proof            | `domain`, `use-cases`, `config`, `server`, `tables`, `client`, `ui` |

This list is a point-in-time view. The live workspace graph is produced by
`bun run topo-sort`; new architecture work should go through the architecture
generator. The architecture docs describe target doctrine, not a claim that
every current slice has every canonical role.

### Apps

Entry points and public surfaces:

- `professional-desktop` — Tauri desktop shell
- `oip-web` — Public site for Oppold IP Law
- `architecture-lab-proof` — Executable architecture proof harness

---

## Product Vision (the Proofs)

beep-effect exists to power local-first, evidence-backed agentic runtimes for professional services.

**Primary proofs**

- **Agentic Solo Practice Law Firm (OIP)** — IP attorney runtime for context capture, document drafting, matter memory, and safe administrative loops under explicit attorney approval. Forces the same epistemic and approval primitives.

See the full product definition and runtime proofs in [`goals/agentic-professional-runtime/`](goals/agentic-professional-runtime/).

---

## How the Repo Works

The repository is built on three pillars:

- **Effect-first** — Typed errors, Layer-based dependency wiring, and Effect modules (`A`, `O`, `Str`, `Match`, etc.) are the default. Native JavaScript patterns are used only at explicit boundaries.
- **Schema-first** — `effect/Schema` (plus `@beep/schema` helpers) is the single source of truth for shape, validation, codecs, and persistence metadata.
- **Topology as compressed context** — Package paths, role suffixes (`.model.ts`, `.ports.ts`, etc.), and family/kind declarations in `package.json` carry meaning so readers can understand intent before opening files.

See [`standards/effect-first-development.md`](standards/effect-first-development.md) and [`standards/ARCHITECTURE.md`](standards/ARCHITECTURE.md) (especially the Core Principles).

---

## Contributing & Quality

All changes must keep the repo quality commands green and follow the non-negotiable habits below:

- Use `bun run beep architecture` and `bun run beep create-package` for new slice or package work.
- Search live source and package barrels before introducing new shared symbols.
- Prefer `bun run docgen:local` for documentation work.
- Publish through Yeet: feature branch, reviewed staged changes,
  `bun run beep yeet publish --message "type(scope): summary"`, PR, green
  required checks, merge.
- Never commit `saving`, `wip`, or temporary checkpoint work to shared branches.
  `main` is PR-only and protected by required hosted checks.
- Keep GitHub merge/squash commit messages conventional too; their bodies are
  server-side commitlint input, including the 100-character line limit.
- Run the quality gates (`bun run beep yeet verify`, targeted
  `bun run beep ci lane <name>`, etc.) and keep them green.
- Treat hosted PR checks as the final merge gate. Local
  `bun run beep yeet verify` replays the full pre-push collector:
  aggregate build/check/lint/test/docgen quality, Knip, JSDoc Ratchet, Repo
  Sanity plus changeset status, promoted Fallow, Secret Scanning, Security,
  SAST, and Nix. The remaining hosted-only residue is event-shaped:
  Commitlint's pushed range, Security's GitHub dependency-review sub-gate, and
  path-gated desktop IPC setup. Replay those with `bun run beep ci lane
  commitlint ...`, `bun run beep ci lane desktop-ipc`, or the PR checks when
  they are relevant.
- Follow the rules in [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md).

---

## License

Licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.

---

*Start here: [`standards/architecture/13-onboarding-the-minimum-viable-slice.md`](standards/architecture/13-onboarding-the-minimum-viable-slice.md)*
