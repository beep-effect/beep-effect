# Cache baseline review addendum: main merge (2026-10-31)

Follows [`cache-baseline-review-2026-10-31.md`](cache-baseline-review-2026-10-31.md).
This branch merged `origin/main`, which brought in #2390 (per-task lint policy
fingerprint seals) and #2381 (GlobPattern onto `@beep/glob`). Then
`bun run beep lint policy-fingerprint --write` regenerated the seals. The only
input changes are:

- `packages/tooling/tool/cli/src/internal/GlobPattern.ts` (deleted by #2381) leaves
  the seal closures and `packages/tooling/tool/cli/src/commands/Docgen/internal/JsDocNodes.ts`
  enters them. This drift is inherited from main.
- `apps/beep-effect-web/package.json` joins the workspace-manifest inputs. This comes
  from the new app on this branch.

Drifted subjects:

- `//`: tasks `//#lint:policy-fingerprint`, `:goals-doctor`, `:goals-index`,
  `:knowledge`, `:lint-deprecated-apis`, `:lint-roadmap-refs` and `:quality`.
- `@beep/beep-effect-web`: tasks `#lint:deprecated-apis`, `#lint:jsdoc` and `#lint:laws`.
  The new app's lint tasks pick up the #2390 seal inputs.

Commands, outputs, env, cache flags and dependency edges are unchanged. No
qualification is granted, and scope, profile and epoch are copied unchanged.
