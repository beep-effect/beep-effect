# Cache review for the IRI schema move out of `@beep/rdf` (2026-11-19)

Branch `goals/text-knowledge-stack-rebuild-p1-l0-identity` (text-knowledge-stack-rebuild
P1, PR A commit 2, `refactor(identity): move the RFC 3987 IRI schemas from rdf`).
Reviewer: Claude Opus 5.5 (P1 L0 identity lane).

`bun run beep cache audit` reports 4 blocking findings in one subject:

- `@beep/documents-domain`: `configuration-drift` on `build`, `check`,
  `lint:deprecated-apis` and `test`.

## Cause

The RFC 3987 schemas `IRI`, `IRIReference`, `RelativeIRIReference` and `AbsoluteIRI`
moved from `@beep/rdf` (`rdf/src/Iri.ts`) to `@beep/identity` (`identity/src/Iri.ts`).
`@beep/documents-domain` imported nothing else from `@beep/rdf` (its two Taxonomy
files imported only `IRIReference`), so the commit removes its `@beep/rdf` dependency
from `package.json`, and `bun run beep tsconfig-sync` prunes the three rdf project
references. The drift is the removal of the `@beep/rdf#build` and `@beep/rdf#transit`
dependency edges from those four tasks. `@beep/documents-domain` already depended on
`@beep/identity`, so no edge is added.

## Judgement

The tasks keep the root task definitions with no package `turbo.json` override: no
command, cache flag, input, output or environment changes. Removing an upstream edge
only stops these tasks from rerunning on `@beep/rdf` changes they no longer read.
Recording the subject grants no qualification.

## Reversal

Restore `"@beep/rdf": "workspace:^"` in `packages/documents/domain/package.json`,
rerun `bun install` and `bun run beep tsconfig-sync`, and re-record the
`@beep/documents-domain` subject.
