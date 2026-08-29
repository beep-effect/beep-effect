# Lab Promotion Runbook

Operational command sequence for promoting an earned lab app out of
`apps/labs/*` into its lawful durable home and deleting the lab clean. The
doctrine behind every step is
[15-lab-apps.md](../../standards/architecture/15-lab-apps.md); this runbook is
the command layer only.

## 0. Preconditions

- Set the lab manifest disposition to `promote` (hand-edit the lab's
  `lab.manifest.json`); confirm the inventory reflects it with
  `bun run beep labs list`.
- No product code imports the lab (labs-must-never law). Step 5's
  `bun run beep delete-package <lab> --dry-run` re-proves this mechanically via
  the dependents refuse table.

## 1. Choose the destination home

Pick the smallest lawful durable home, mirroring the "How To Use This
Standard" routing table in
[ARCHITECTURE.md](../../standards/ARCHITECTURE.md):

| Promotion result | Home |
| --- | --- |
| Product behavior or product language | The owning slice. |
| Product language shared by multiple slices | `shared/*`, through the shared-kernel promotion gate ([02-shared-kernel.md](../../standards/architecture/02-shared-kernel.md)). |
| External engine/SDK/service wrapper | `drivers/*`. |
| Domain-agnostic reusable substrate | `foundation/*`, after the specific-home-first routing test. |
| Repo tooling | `tooling/*`. |
| Externally published library | `ecosystem/*`, through the gate in [14-ecosystem-packages.md](../../standards/architecture/14-ecosystem-packages.md). |
| A durable product application | `apps/*` (non-labs). |

## 2. Create or extend the destination with full ceremony

- New package: `bun run beep create-package` (never `mkdir` — see the
  Touch table in the repo agent guide). Existing home: add role files per the
  `bun run beep architecture` grammar.
- Full registration applies at the destination: changeset, docgen surface,
  JSDoc and coverage ratchets, Storybook if UI, tsconfig-sync — everything the
  lab was path-exempted from.

## 3. Move code and migrate consumers in the same change

- Rewrite lab-local `@/*` alias imports to the destination's `@beep/*`
  subpaths.
- Product code never imports the lab path, before or after the move.

## 4. Identity

- Same semantic ownership: keep the package identity. The composer leaves the
  generated labs segment and enters its family segment through create-package
  registration; the labs segment writer regenerates without it.
- Changed ownership: record an explicit identity transition — a retired-name
  entry in `standards/changesets.retired-packages.json`. `create-package`
  refuses to reuse a retired name without `--reuse-retired-name`.

## 5. Delete the lab and prove clean

```sh
bun run beep delete-package <lab> --dry-run   # review the inverse plan
bun run beep delete-package <lab>             # execute the deletion
bun run beep delete-package <lab> --check     # doctor: zero residue
```

- `--force` never overrides a live dependent.
- Manifest-declared Postgres state: deletion never drops the lab-owned
  `lab_<slug>` schema automatically. With explicit `--drop-data` consent it
  reports the exact manual `DROP SCHEMA` cleanup step; without consent it
  leaves data intact and still reports the step. Non-local connections require
  the additional `--allow-non-local-data` override.

## 6. Gates (every promotion)

- `bun run docgen:local` when the destination gained exported surface.
- Changeset for the new or changed destination package.
- Shared-kernel promotion record when the home is `shared/*`.
- DECISIONS entry when the promotion creates or changes a shared export
  ([DECISIONS.md](../../standards/architecture/DECISIONS.md)).
- `bun run beep yeet repair` → `... verify` → `... publish` → `... monitor`
  until merge-ready.
