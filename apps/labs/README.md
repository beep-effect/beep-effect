# Lab Apps (`apps/labs/*`)

Law-abiding experimental applications. Doctrine:
[`standards/architecture/15-lab-apps.md`](../../standards/architecture/15-lab-apps.md);
glossary term "Lab App"; decisions D1–D14 in
`goals/lab-apps-lifecycle/SPEC.md`.

- **Create**: `bun run beep create-package <name> --type app --app-kind <nextjs|vite|service> --lab --description "..."`
- **List**: `bun run beep labs list`
- **Delete**: `bun run beep delete-package <name>` (doctor proves zero residue)
- **Promote**: `docs/runbooks/lab-promotion.md`

Labs obey the full code law (schema-first, effect-first, import boundaries,
portless `http://<name>.labs.beep.localhost:1355`) and are exempt only from
package ceremony (docgen, coverage ratchet, changesets, storybook) by
path-scoped construction. Lab CI runs in the non-required `Labs` lane; required
lanes exclude `apps/labs/**`.

Registration is zero-root-churn: the one-time `apps/labs/*` workspace glob and
path-scoped gate rules cover every lab; creating or deleting a lab must not
hand-edit any shared config. Lab identity composers live in the generated labs
segment of `@beep/identity`'s registry.

This directory is a pure container of lab workspaces: it must never gain its
own `package.json` or `src/` (the one-level `apps/*` entry globs would then
treat it as an app). This README exists so the directory — and therefore the
required-lane `--filter=!./apps/labs/**` turbo filters — survive on every
checkout even with zero labs present.

No lab may publish a public `@beep/*` API, be imported by product code, or add
tables to `packages/*/tables`. See the doctrine chapter for the full
"labs must never" list.
