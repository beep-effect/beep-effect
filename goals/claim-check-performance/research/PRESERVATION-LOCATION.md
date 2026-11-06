# Historical runner preservation location decision

Accepted main `31e2ac20f3` contains the mechanical runner updates from #2637.
Restoring the exact historical runners at their active TypeScript paths produces
13 mandatory `yieldInCallArgument` diagnostics. Disabling that rule, excluding
those source files, or silently changing the original freeze would hide the
conflict.

The original preservation manifest remains unchanged. Exactly three historical
runner sources now live as byte-identical `.ts.txt` artifacts under
`research/legacy-protocol/`. The location addendum names each original path,
archive path, original manifest hash, and accepted active-runner hash. All other
1,210 frozen files remained at their original paths at that decision. No labels, scorer, source
fixtures, previous results, numerical gates or passing-claim identities change.
The verifier rejects unknown or duplicate mappings, changed archive bytes,
changed active-runner bytes, and hashes that differ from the original manifest.

The active runner changes are schema-codec naming/hoisting, intermediate
`yield*` bindings, and formatting. They do not change selections or scoring.
Equivalence requires an unchanged frozen-cohort replay and byte comparison of
all prediction reports and the full result. This proof is distinct from an
accuracy improvement. Package verification retains every current diagnostic.

For historical execution, create a separate temporary checkout of commit
`1a8d73c780d0e31080b10e73c165f9190cb15e1b`, use its recorded Bun version and
lockfile, and materialize the three archives at their original paths. Verify
their original-manifest hashes before running. Keep the historical compiler
configuration with that checkout; do not disable current diagnostics in the
active worktree. Supply a fresh output directory and the historical source
freeze to the existing evaluation environment variables. Keep all new outputs
separate. Licensed source fixtures stay in their authorized private cache.

## Accepted generated metadata

Main #2704 subsequently makes every goal's `researchReports` a generated
directory projection. This changes exactly that field in the frozen old goal
manifest. Its original bytes remain at
`research/legacy-protocol/claim-element-antecedent-manifest.json.txt`, with the
original preservation-freeze hash unchanged. A separate
`preservation-generated-metadata-addendum.json` names exactly one original path,
archive path, historical digest and active generated digest. The verifier pins
the addendum's digest independently, checks both versions, permits no other
semantic field change, and checks the native immediate nonhidden-file projection.
There are now 1,209 original-path files, three historical runner archives and
one historical generated-metadata archive: all 1,213 original artifacts remain.

No label, source fixture, result, scorer or numerical gate is relocated by this
new decision. An extra mapping, path traversal, archive/active tamper or
self-updated addendum fails verification. A future generated projection needs
a separately reviewed binding; this is not an automatic acceptance of new bytes.
