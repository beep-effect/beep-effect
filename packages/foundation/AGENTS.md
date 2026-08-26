# Foundation Agent Guide

## Purpose

Foundation packages are reusable, domain-agnostic substrate for the repo. They
are allowed to support slices, shared-kernel packages, drivers, tooling, and
apps, but they must not depend on product-specific slice language.

## Package Kinds

- `primitive`: leaf type and data substrate.
- `modeling`: identity, schema, messages, and domain-modeling helpers.
- `capability`: reusable technical capability packages with runtime behavior.
- `ui-system`: product-agnostic UI primitives, hooks, themes, styles, and repo
  brand identity (`@beep/brand`).

## Rules

- Preserve public `@beep/*` package names unless a migration explicitly changes
  API shape.
- Keep package manifests honest with `beep.family = "foundation"` and the
  correct `beep.kind`.
- Prefer repo automation (`bun run config-sync`, docgen aggregation, Turbo
  filters) over hand-maintaining generated references.
- Do not add product-domain concepts to foundation packages.
- Record mixed internal surfaces as follow-up cleanup unless they block boundary
  correctness.
