# Entrypoint attachment after the ignore-input repair

This source attachment follows the
[root-ignore repair and dependency exclusion](./ignore-repair-baseline-review.md).
The population, commands, script digests, dependency edges and root global
configuration are unchanged. Two child task definitions changed: identity
adds ancestor ignore-file inputs and types lint disables cache reuse. The
new types child configuration joins the current source bindings.

The five complete CI/Quality, Yeet and workflow documents retain the exact
bytes reviewed in the [main-integration attachment](./post-merge-entrypoint-review.md).
This repair changes no planner implementation, manifest script or workflow
source. Those documents describe the same illustrative planner scenarios
and workflow definitions. They still establish no task execution or hosted
verdict, and do not exhaust interpreter behavior.

The command-group recipe runs against the fresh repaired census. Its
execution groups, wrapper groups and root scripts are unchanged; its census
reference now binds the repaired configuration. The attachment request binds
current source bytes and this review, while reusing the five unchanged source
documents and attaching the regenerated command groups as its sixth document.
All six existing review/runtime obligations remain unresolved.

Reproduction uses the current Bun pin:

```sh
python3 goals/turborepo-task-qualification/research/refresh-command-groups.py \
  .beep/qualification-local-preflight/census-ignore-repair.json \
  --output goals/turborepo-task-qualification/research/command-groups-ignore-repair.json
mise exec bun@1.4.2 -- bun --no-env-file \
  goals/turborepo-task-qualification/research/refresh-entrypoint-review.ts \
  .beep/qualification-local-preflight/census-ignore-repair.json post-merge \
  ignore-repair-entrypoint-request.json ignore-repair-entrypoint-review.md \
  command-groups-ignore-repair.json
mise exec bun@1.4.2 -- bun run beep cache census \
  --entrypoint-review goals/turborepo-task-qualification/research/ignore-repair-entrypoint-request.json \
  --output .beep/qualification-local-preflight/census-ignore-repair-attached.json
```

Native invalidation and exclusion controls are separate execution evidence.
This attachment grants no qualified status or cache activation.
