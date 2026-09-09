# Identity dependency invalidation repair

The [native counterexample](./dependency-cache-invalidation.json) reproduces
a stale success on both exact Turbo clients after the root-alias input repair.
An isolated identity source imports an ordinary types-package export. Adding
a deprecation annotation only to that dependency preserves identity's task
hash `750fbc908c142716`: local replay succeeds, while fresh lint fails.
The [direct wrapper probe](./dependency-deprecation-observation.json) attributes
the failure to the enabled `lint/suspicious/noDeprecatedImports` rule.

Both clients also validate the same isolated correction: add `^lint` to the
identity child task's `dependsOn`. The dependency continues to execute fresh
because types lint is excluded and cache-disabled. The changed dependency
hash participates in identity's hash; after the annotation changes, identity
executes fresh and fails. Repeating with reuse disabled produces the same
failure at the same changed hash. The old successful result is not replayed.

The [baseline delta](./dependency-edge-baseline-delta.json) changes only
identity lint's dependency edge. Its 46 file inputs, command, cache-disabled
state, environment policy and output declarations are unchanged. The population
remains 142 workspaces, 2,840 configured nodes and 1,474 executable computations.
The root Turbo configuration and the two-computation/profile/epoch scope are
unchanged. The canonical writer must compare the previous baseline digest and
this review's bytes. The qualification ledger must remain byte-identical.

This scoped edge preserves the fresh dependency task and its observable
execution cost. It does not restore dependency lint across the repository.
The observer already validates this two-task closure and requires types to
execute fresh. Its controlled missing-child case may remove the child-owned
edge; any dependency still present must remain within the reviewed closure
and execute fresh. Graph-only nodes are not credited as executions.

The durable mutation matrix now includes a dependency-source case. Its first
fresh run fails on the deprecated import; removing that annotation must change
the hash, execute successfully and permit a subsequent successful local replay.
The separate counterexample above covers the unsafe success-to-failure
direction. Full stable/canary validation must bind the new observer and v5
activation fragments. The earlier v4 root/configuration controls all pass,
but do not establish dependency invalidation.

Other source reads, installed dependency resolution, write/capture adversaries,
signed sibling receipts and final Yeet acceptance remain unresolved. This
repair establishes one dependency boundary, not a complete semantic read set
or qualification. Live caching stays disabled.
