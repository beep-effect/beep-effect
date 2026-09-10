# Entrypoints after the runtime key repair

Identity lint now declares `BEEP_CACHE_TOOLCHAIN_DIGEST` while keeping
`cache: false`. Types lint stays excluded and fresh. The baseline review
accepts this one definition change; no task command, dependency edge, global
configuration or executable population changes.

The durable pilot derives the environment value from the verified installed
tree and observed toolchain, including the requested native Turbo client.
Native dry-plan and run-summary metadata must confirm the expected hashed
value. A per-run field records that observation. The named missing-child
negative control can deliberately remove the declaration; that outcome is
not credited as evidence of a correctly keyed computation.

The preceding installed-export experiment reproduces stale success under the
old native key. Separate native experiments demonstrate invalidation from
the effective installed-tree digest and from the complete reviewed toolchain
digest. Those observations do not qualify a tuple. Full v5 matrix evidence
must retain its actual runtime-key digest and source bindings.

Fresh local/hosted CI, Quality and Yeet projections and the complete workflow
snapshot are byte-identical to the retained `installed-v3` documents. The
[parity receipt](./runtime-key-planner-parity.json) binds the fresh copies and
their retained equivalents. They still contain 72 CI plans, nine Quality
modes, 15 partition plans, four local dispatch shapes, 30 Yeet branch/mode
scenarios per context, three hardware examples and ten local workflow/action
documents. The command-group snapshot is regenerated from the final census.

Ordinary CI/Quality/Yeet invocations do not yet supply this verified runtime
key to Turbo. The existing policy audit can check a reviewed contract, but
that check alone does not seed the invocation's environment. Enforcing that
boundary is required before live activation. Complete semantic inputs,
reads/writes/captures, dynamic interpreter outcomes and accepted signed sibling
evidence remain separate obligations. These source attachments retain the
existing hosted proof owners and grant no cache qualification.
