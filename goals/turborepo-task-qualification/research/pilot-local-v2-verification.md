# Native v2 local pilot and dependency boundary

Stable `2.10.12` and exact canary `2.10.13-canary.1` each pass 67 selected-task
observations, 40 checks and ten local shadow decisions. Their executable
digests and namespaces remain separate. The backing worktrees are at
`ed12e4ede8`; observer sources and the v5 activation preview are bound
separately. The observation profile still omits installed node_modules and
does not qualify the normal workspace computation.

| Per exact client | Observed |
| --- | ---: |
| Successful fresh selected executions | 44 |
| Successful local hits | 19 |
| Expected fresh selected failures | 4 |
| Fresh dependency executions | 65 |
| Configuration/manifest/dependency mutations | 8 |
| Setup/absent-script controls | 4 |
| Local shadow decisions | 10 |

The 63 successful selected observations retain 53-byte logs. The four expected
failures retain 138-byte logs. The two missing-child runs deliberately lose
the child-owned dependency edge; no dependency execution is invented for
them. Every dependency that is observed belongs to the reviewed closure and
executes fresh. Package snapshots and registered source worktrees remain
unchanged under the native observer's checks.

The root-alias correction first passed its 21-observation, 11-check matrix.
A later dependency probe exposed stale successful replay on both clients:
deprecating an ordinary imported types-package export preserved the selected
task hash, so local replay exited zero while fresh lint exited one. The
identity-only `^lint` edge repairs that counterexample by including the fresh
dependency's task hash. Types remains excluded and cache-disabled. The durable
dependency-source control covers a fresh deprecation failure followed by
invalidation, fresh success and local replay after removing the annotation.

The reviewed baseline still has 142 workspaces, 2,840 configured nodes and
1,474 executable computations. Cache policy has zero blocking findings and
922 inherited cached computations remain unassessed. The qualification ledger
is byte-identical. No live task is activated by the v5 preview.

The refreshed entrypoint attachment binds 286 sources and six complete
documents. Five planner/workflow documents are byte-identical to the
main-integration versions; command groups bind the current census. These
remain source/planner evidence rather than hosted execution or an external
verdict. Package verification passes for CLI (447.9-second audit,
17.7-second docgen) and identity (4.5-second audit, 3.1-second docgen), along
with typechecking, formatting and schema-first validation.

## Installed dependency finding and next repair

The fixtures provide pinned executables but no installed dependency tree.
The [installed-dependency probe](./installed-dependency-observation.json)
demonstrates that this matters. Normal installed lint passes. An added import
and nondeprecated export pass; marking only that external export deprecated
makes installed lint fail. The source fixture without installed packages
still succeeds. Quiet and verbose exit codes agree, and the verbose diagnostic
attributes the failure to the configured deprecation rule. The installed
view is read-only, but it is not a complete dependency integrity attestation.

Before qualification, the runner must materialize and bind the installed
dependencies used by the selected computation, then validate that view in
the isolated roots. It must preserve workspace-relative package resolution,
pin the executed launcher/binary chain and refuse incomplete or changed
dependency materialization. Re-run the comparison/shadow matrix and external
deprecation adversary against that representation. The current source-only
fixture results remain useful local observations, with this explicit limit.

Further semantic read/write and capture adversaries, accepted signed
conformance/trust receipts, dynamic interpreter and external-verdict coverage,
adoption handoff and the final Yeet/reflect lifecycle remain required. Both
sibling runtime packets are still paused. The goal remains active and both
pilot tuples remain excluded.
