---
"@beep/repo-ai-metrics": patch
"@beep/repo-cli": patch
---

Absorb the ai-metrics invariants into their schemas: absence becomes `Option`
fields on the forwarder, install, retention selector, config snapshot, OTLP
projection and transcript models; literal families (event names, annotation
optimization and target kinds, mutation policies, coverage gaps, mirror
sync/data-class stamps, derived table names) become `LiteralKit` domains;
module-level decode/encode walls become in-body codec statics; double-wired
defaults use the `SchemaUtils` combinators; imperative accumulation becomes
folds. Retention plan rows now decode through schemas so NULL legacy
timestamps no longer coerce to 0 inside `--before` delete windows, and the
mirror privacy proof rejects leaked paths that extend the data root. The CLI
AI-metrics programs consume the Option-valued inputs.
