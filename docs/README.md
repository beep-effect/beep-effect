# docs

Tracked, authored documentation for the beep-effect monorepo.

## Layout

| Path | Tracked | Purpose |
| --- | --- | --- |
| `docs/*.md` | yes | Repo-level identity documents (mission, story). |
| `docs/ROADMAP.md` | yes | Canonical cross-portfolio priority layer (lanes, horizons, resume conditions); lifecycle status truth stays in tracked packet manifests. |
| `docs/product/` | yes | Per-product specs and PRDs (one named file per product — no generic `PRD.md`). |
| `docs/runbooks/` | yes | Operational runbooks: step-by-step command sequences with gates (first: `lab-promotion.md`). |
| `docs/generated/` | **no** (gitignored) | Docgen aggregate output. Produced by `bun run docgen` / `bun run docs:aggregate`; safe to delete, regenerable. |
| `docs/_internal/` | **no** (gitignored) | Private working notes. This repository is public — never commit anything under `_internal/`. |

## Rules

- Authored documents live here and are committed like code.
- Product vision prose graduates into `docs/product/` from the fuzzy front end
  in [`explorations/`](../explorations/README.md); raw brainstorm and research
  material lives in exploration packets, not under `docs/`.
- Machine-generated research intelligence (the nightly research routine's
  dated packets) lands under top-level `research/`, not here and not in
  `explorations/` — exploration packets are the human fuzzy front end;
  `research/` packets are automated intel that *proposes* exploration
  candidates via their `SUGGESTED_ACTIONS.md`. Conventions:
  `research/README.md`.
- Never hand-edit anything under `docs/generated/` — it is overwritten by `beep docgen aggregate` (the `--clean` flag removes only `docs/generated/`).
- A future docs site (e.g. a `@beep/docs` app in the style of <https://effect-ts.github.io/effect/>) should consume `docs/generated/` as its content source.
