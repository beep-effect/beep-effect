# Compiler config declaration inventory

The current-head census and nested command inventory resolve all 420 compiler
step sites to 418 existing configuration files. The recipe parses each file
with the installed JSONC parser and rejects parse errors. It preserves the
entire declared document and its original-byte digest, together with every
owning command and script step.

| Observation | Count | Meaning |
| --- | ---: | --- |
| Explicit command-line `--noEmit` | 147 sites | Literal argv fact, not proof of all side effects. |
| Build-mode `-b` | 1 site | Must retain build-mode/reference behavior rather than treat it as `-p`. |
| Configs declaring `extends` | 418 | Every leaf depends on inheritance resolution. |
| Configs with nonempty references | 268 | Reference structure remains part of the compiler boundary. |
| Configs directly declaring `noEmit: true` | 288 | Declaration only; not a merged-options result. |
| Configs directly declaring `noEmit: false` | 1 | Explicit emission posture in that leaf. |
| Configs omitting local `noEmit` | 129 | Effective value is unresolved here, not assumed false. |
| Configs declaring a build-info path | 7 | Potential incremental/build state requires interpretation with effective options. |

Declared output directories include `dist`, `dist-test`, `dist-scripts`,
`dist-stories` and `dist-types`. Their presence does not prove files are emitted:
command flags, inherited no-emit settings, composite/incremental behavior and
compiler version all participate. The report deliberately does not substitute
a homemade merger for TypeScript or tsgo resolution.

Reproduce with the retained current-head census:

```sh
python3 goals/turborepo-task-qualification/research/refresh-compiler-configs.py \
  .beep/qualification-local-preflight/command-boundaries-reviewed-census.json \
  goals/turborepo-task-qualification/research/command-boundaries-post-main.json \
  goals/turborepo-task-qualification/research/compiler-configs-post-main.json
```

Two independent invocations produced identical report bytes. No compiler was
executed. This is a declared-config inventory for source/type/config resolution
and output review, not a runtime result, complete transitive input closure or
qualification. The existing seven semantic/runtime obligations remain open.
