# Post-main command boundary inventory

The retained nested graph has 95 distinct terminal command strings across 1,952
step sites and 21 additional uninterpreted shell sites. The new inventory maps
all 1,957 executable computation roots through every resolved local alias to
these boundaries. Each composite inherits the union of its reachable children;
no root is classified solely from a task name. Graph-only nodes remain outside
the executable population.

| Boundary | Step sites | Review needed before reuse |
| --- | ---: | --- |
| Repository dispatch | 586 | Downstream arguments/cwd, Git/workspace selection, subprocesses, outputs and external verdicts. |
| Compiler | 420 | Selected config and reference closure, source/type resolution, emission and build-info settings. `--noEmit` alone does not certify all effects. |
| Unit/other tests | 140 | Actual suite/config/dependencies, selection, no-test success, clocks, randomness, services, writes and capture. |
| Source check | 139 | Selected files, config/ignore closure, cross-workspace/installed reads, toolchain and diagnostics. |
| Source fix | 138 | The check boundary plus explicit source mutation; this is not the read-only pilot computation. |
| Coverage | 134 | Test boundary plus output trees, aggregation and baseline ownership. |
| Docgen | 132 | Examples, compiler/rendering dependencies, generated documentation and source effects. |
| Compiled output rewrite | 117 | Prior `dist`, Babel/plugin configuration, output/source-map writes and logs. |
| Integration tests | 90 | Test boundary plus explicit service, credential and external-state ownership. |
| Doctest | 27 | Example source, doctest environment selection and the test runtime boundary. |
| Shell expressions | 21 | Preserve full expressions; resolve cwd, substitution, globs, redirection and nested execution separately. |
| File entrypoints | 12 | Actual script/import graph, arguments, inputs and writes; a file suffix is not a purity claim. |
| Application builds | 7 | Framework environment, source/config closure, build-time network and generated assets. |
| External tools | 5 | Resolved executables/configuration, package resolution, inputs, writes and verdicts. |
| Python tooling | 3 | Python/project/lock identity, environment materialization, selected code and runtime effects. |
| Services | 2 | Persistent process lifetime, ports/readiness, mutable state and cleanup. Eight more service expressions remain in the shell category. |

Counts describe sites, not distinct executions or qualified computations. A
command with an integration exclusion is not classified as integration merely
because that exclusion contains the word. Integration selectors, coverage and
doctest modes retain separate review routes. Test code can still access services
in any category. The categories grant no lifecycle status and leave the seven
operational census obligations open.

The JSON retains every command string, defining script and step index, plus
per-root family membership and explicit remaining review subjects. Reproduce:

```sh
python3 goals/turborepo-task-qualification/research/refresh-command-boundaries.py \
  goals/turborepo-task-qualification/research/nested-commands-post-main.json \
  goals/turborepo-task-qualification/research/command-boundaries-post-main.json
```

The report binds the original graph and recipe bytes. It is a static inventory
for semantic review and adoption preparation, not an accepted runtime receipt
or a replacement for the existing operational census attachment. Only the real
pilot has the local runtime evidence described in the runtime boundary record;
signed qualification remains pending.

The [package test typecheck review](./package-test-typecheck-boundary.md) traces
140 repository-dispatch sites through discovery, config selection, compiler
execution, artifact writes and the separate root verdict interpreter. It
retains runtime obligations and the existing disabled-cache posture.
