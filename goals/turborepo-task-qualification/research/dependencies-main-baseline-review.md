# Qualification baseline after the second quality-lane merge

Main `d68f1a11dd` is integrated by `26ae03d182`. The refreshed census still
contains 142 workspaces, 2,840 configured nodes and 1,474 executable
computations. The [delta](./dependencies-main-baseline-delta.json) contains no
added or removed executable computation, dependency-edge change, task command
change, effective configuration change or global configuration change.

The 123 changed command digests belong to 13 workspaces whose complete script
maps changed in main. The census intentionally binds nested script definitions,
including the removal of duplicate app compiler passes. This review accepts
those inherited command-map changes without granting cache qualification.
Planner and workflow snapshots must be regenerated for main's new config,
Storybook and affected-build lanes before a new complete entrypoint attachment
can be accepted.

The scope remains identity lint and types lint in `local-linux-x64-bun1.4.2`,
epoch `qualification-v2`. Both computations remain excluded and cache-disabled.
The identity-specific dependency edge and root-alias input correction remain
intact. The canonical baseline writer must compare the previous baseline digest
and this review's exact bytes. The qualification ledger must remain unchanged.

Installed dependency snapshots now bind the observed full tree and its copied
view. The runtime fingerprint and pilot are being extended to require that
identity and the Node launcher pin. This baseline refresh does not accept the
new runtime matrix in advance, reinterpret earlier source-fixture observations,
or satisfy the signed-remote and trust dependencies. Native evidence, complete
read/write and capture coverage, and final Yeet acceptance remain required.
