# Nested manifest references after main integration

The retained census at implementation revision `028262e8c0` supplies every
configured executable root: 1,957 computations across 143 workspaces. The
recipe `refresh-nested-commands.py` expands argument-free local `bun run`
references, including `--if-present`, and static ` && ` chains. It does not
execute commands or interpret a shell. Graph-only nodes remain outside this
executable root set.

The resulting graph has 3,317 reachable manifest definitions and 2,136 local
script edges. All 140 optional script edges resolve to existing definitions.
There are no cycles or missing local targets under the supported grammar.
Another 1,952 steps retain their terminal command strings for tool-specific
review. These are definition/edge counts, not task executions.

Twenty-one definitions retain their complete uninterpreted shell expression:

| Definitions | Count | Semantic boundary retained |
| --- | ---: | --- |
| Root Fallow commands | 8 | Selected Git base comes from `BEEP_PROOF_BASE`; reports and external verdicts require the existing Quality review. |
| Portless development and preview services | 8 | Shell quoting, selected port and persistent subprocess lifetime; no finite-task qualification. |
| Identity quiet lint | 1 | Redirection discards Biome diagnostics; current pilot capture and failure controls are the relevant runtime evidence. |
| Infra build placeholder | 1 | Quoted echo emits a message; it is an executable script, not a missing build. |
| Infra Lambda tests | 1 | Directory change, nested dependency installation, typecheck, tests, bundle and ZIP checks. Nested manifest selection cannot inherit the parent workspace blindly. |
| Storybook lint and fix | 2 | Git-root substitution and cross-workspace glob selection; fix also mutates source. |

The earlier compound-audit gap now has reconstructable local references for
every supported alias. Terminal commands with forwarded arguments, environment
assignments, external binaries, file entrypoints and any unsupported shell
syntax retain their command text; this graph does not claim their arguments
or runtime behavior have been fully interpreted. AND-chain children are
possible steps, not evidence that preceding commands succeeded.

Reproduce with:

```sh
python3 goals/turborepo-task-qualification/research/refresh-nested-commands.py \
  .beep/qualification-local-preflight/post-main-reviewed-census.json \
  goals/turborepo-task-qualification/research/nested-commands-post-main.json
```

The report binds its census and recipe bytes. The successor entrypoint-review
request adds this graph and review without rewriting the earlier accepted
attachment. All seven runtime/semantic obligations remain explicit. No command
is qualified by manifest expansion, and no cache configuration changed.
