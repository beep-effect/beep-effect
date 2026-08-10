# Ecosystem Packages

`ecosystem` is the package family for repo-authored libraries built for the
wider TypeScript/effect ecosystem: packages this repo intends to publish to
npm and then consume like any external dependency. The family was chartered
2026-08-10 for the graduation of `scratchpad/bsl` into
`@beep/effect-drizzle`; see the matching `DECISIONS.md` entry.

Every other family exists to serve this repo's product. An ecosystem package
exists to serve strangers, and the repo is merely its first consumer. That
inversion of audience drives every rule below.

## The Grammar

```txt
packages/ecosystem/<name>   ->   @beep/<name>
```

The family is flat, like `drivers`: no `<kind>` segment. The workspace name is
the npm name — what the monorepo imports is exactly what the outside world
will install. A member never has a repo-internal alias that differs from its
published identity.

## The Inverted Gate

Everywhere else in the repo, `@beep/*` imports are the normal fabric.
Ecosystem members invert the polarity:

- **`src/` and runtime manifest edges (`dependencies`,
  `peerDependencies`) are 100% `@beep/*`-free.** The published artifact
  carries no thread back into the monorepo.
- **Tests and `devDependencies` are unrestricted.** Repo test harnesses
  (`@beep/pglite`, test kits, fixtures) are legitimate development machinery
  and never reach the artifact.

The contract is **"publishable from the monorepo,"** not "extractable
repo-free." A member is allowed to depend on repo tooling to be built, tested,
and proven — it is not allowed to make its consumers depend on any of it.

The gate belongs in two places: a package-local boundary test inside the
member, and a repo lint lane so a violating import fails repo-wide checks, not
just the member's own suite. Enforcement is pending automation until the first
member lands: the boundary test and lint lane ship with the member-creation
phase of `goals/effect-drizzle-graduation` (P1).

## Style-Law Scoping

Inside `packages/ecosystem/*`, published-package standards supersede the
repo's effect-first style laws where they conflict. The member is read by
outsiders, bundled by consumers, and type-checked in projects that never see
this repo's conventions:

- Named imports from effect module paths — for example
  `import { taggedEnum } from "effect/Data"` — instead of namespace imports;
  tree-shaking for consumers outweighs the repo's namespace idiom.
- Native helpers where behavior is equivalent (`["a", "b"].map(...)`) instead
  of mandatory effect helper modules — bundle size outweighs idiom
  consistency.
- Everything exported is documented to the measured effect JSDoc grammar;
  everything not exported for consumers is marked `@internal` and stripped
  from published declarations.
- Line-leading `@` in JSDoc prose is escaped so editors do not parse package
  names as tags.

Repo law scripts, lint lanes, and review tooling must scope themselves so
members are not flagged for following these standards. Outside
`packages/ecosystem/*`, the repo's laws are untouched by this doc.

## Ecosystem Is Not Drivers

The two families are easy to confuse because both sit at the repo's edge, and
the first member wraps the same engine an existing driver wraps. The split is
by direction:

```txt
drivers    = external engines wrapped for THIS repo's consumption
ecosystem  = repo-authored libraries built for EXTERNAL consumption
```

Worked example: `@beep/drizzle` (drivers) keeps EXECUTION — the SQL service,
transactions, error normalization for this repo's runtime.
`@beep/effect-drizzle` (ecosystem) owns schema-derived PROJECTION — deriving
drizzle tables, DDL, and repositories from effect/Schema models — and the
repo consumes it exactly as any outside project would. Generic table
projection therefore lives in `@beep/effect-drizzle`; the shared-tables
contract points there.

A capability belongs in `ecosystem` only when the repo would build and
maintain it even if the repo were not its consumer. Anything whose design is
driven by this repo's product belongs in a slice, `shared`, `foundation`, or
`drivers` as usual.

## Artifact And Peer Policy

Members publish a deliberately strict artifact:

- ESM-only (`"type": "module"`); no dual-format builds.
- An exports map naming exactly the supported entry points (plus
  `"./package.json"`); no wildcards, so deep imports are impossible. A root
  entry point may stay alongside granular subpaths as a convenience whose
  bundle cost is documented.
- `sideEffects: false`, with pure annotations where a bundler needs help.
- Declarations built with `stripInternal`: `@internal` symbols do not exist
  in the published `.d.ts`.
- Runtime dependencies are peers only (the host library plus effect), so the
  consumer — not this repo — owns version resolution. While an upstream peer
  is prerelease, peers pin the exact proven version.

## Release Lane

Members are wired into changesets and the release lane at creation but stay
dormant: `private: true` until every upstream peer is stable enough that the
published artifact needs no compatibility shims (for the first member: effect
v4 stable AND drizzle 1.0 final). Pre-npm feedback flows through the public
repository meanwhile. Flipping `private` is an operator decision, never a side
effect of other work.

## Gate Profile

Members run the standard workspace lanes (check, test, lint, docgen) plus
family additions:

- the inverted-import gate in repo lint (see above);
- a member-scoped tstyche type-test lane, created with the member itself.
  This is a deliberate exception to the 2026-08 repo-wide type-test removal
  (see `DECISIONS.md`): for an ecosystem member the published `.d.ts` IS the
  product, and a type-level regression is a user-facing break, so members pay
  the lane cost the rest of the repo deliberately dropped;
- a bundle probe in CI, so size regressions are visible per PR;
- instantiation budgets only after repeated sampling on a pinned machine —
  a noisy budget is worse than none.

For the first member these additions land through
`goals/effect-drizzle-graduation`: the boundary test, repo lint gate, and
member tstyche lane at package creation (P1); CI wiring for the family lanes
and the bundle probe in the quality-integration phase (P2).

## Promotion And Demotion

A package enters the family through the front door: a proven exploration
(scratchpad or `explorations/`), an operator grill locking the decisions, and
a goals packet executing them — never by moving code first and asking
questions later. `goals/effect-drizzle-graduation` is the template instance.

Demotion is symmetric. If a member stops being ecosystem-worthy before it is
published, it moves back into a normal family and loses this doc's
exemptions. Once published, npm obligations attach: the package is deprecated
upstream, not silently deleted, and the repo keeps consuming its last
published shape or migrates off it explicitly.
