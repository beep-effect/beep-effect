# Reference workspace (`.repos/effect`)

First-party work lives under `packages/`, `apps/`, `infra/`, `goals/`,
`explorations/`, `standards/`, and the authored `docs/` tree. Everything under
`.repos/` is a gitignored link into a reference workspace that agents validate
Effect APIs against; nothing there is part of the tracked tree.

## Layout

The reference workspace holds `effect` and `effect-tsgo` child clones.
By default it lives at `$HOME/YeeBois/references/effect` (the manifest's
`rootDefault`). `bun run beep refs provision` provisions it from
`packages/tooling/policy-pack/repo-configs/data/references.json`;
`BEEP_REFERENCES_ROOT` overrides the workspace root.

- `.repos/effect` points to the [Effect-TS/effect](https://github.com/Effect-TS/effect)
  child, whose `main` is Effect v4, so existing relative source links stay valid.
- `.repos/effect-tsgo` points to the tsgo child.
- `.repos/effect-workspace` points to the parent.

## Refresh

The nightly 03:30 `beep-refs-refresh` timer, installed by
`beep refs install-timer`, fast-forwards each clean member on its configured
branch. See the [timer runbook](systemd-timers.md). Agents may run
`beep refs plan` and `beep refs install-timer --refresh` to inspect the plan or
re-render an installed timer. Agents never run `beep refs refresh` or a fresh
`beep refs install-timer`.

## Do not add subtrees

Do **not** add git subtrees under `.repos/`. Historical subtree imports still
sit in git objects and poison naive `git log` author counts; those names are
not first-party contributors.
