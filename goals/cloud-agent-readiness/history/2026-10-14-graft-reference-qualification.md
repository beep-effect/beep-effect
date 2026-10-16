# Graft and Effect reference qualification — 2026-10-14

## Result

Graft 0.21.1 on beep-worker builds and navigates structural graphs for the Beep
checkout and Effect references. Provisioned the eleven canonical reference
members and all `.repos/<member>` links plus `.repos/effect-workspace`. Each
member's structural freshness check exits zero with `graph.ok=true`. Beep's
7,948-file graph also builds and checks successfully without reported parse
failures. All reference clones and the worker checkout remain Git-clean.

Qualification has two explicit limits: Alchemy reports one generated-file
parsing failure, and the aggregate workspace freshness check exhausted the
worker's memory/swap budget and was stopped. This is not blanket workspace,
deep-summary, deployment or fleet readiness.

## Provisioning and transport

The reference root was absent before provisioning. Used the repo-owned
`bun run beep refs provision`; source inspection confirms this command clones
and links, without executing the deep commands printed by `refs plan`. Its
maintenance child environment strips arbitrary Git configuration variables.
A private, command-scoped PATH wrapper invoked system Git with an HTTPS rewrite
for the manifest's eight SSH URLs. No administrator agent or permanent global
Git rewrite was used.

After cloning, changed the eight newly created SSH origin URLs to equivalent
HTTPS URLs so future reads do not depend on the temporary wrapper. The other
three origins were already HTTPS. An `env -u SSH_AUTH_SOCK git ls-remote`
against Effect's origin succeeded with output suppressed. No existing reference
checkout was overwritten, and no branch, commit or upstream tracked file was
changed. Clone-local excludes cover Graft cache artifacts.

References are source snapshots, not dependency replacements. Branches follow
`scripts/references.json`; Effect main need not exactly match the installed
package snapshot. No upstream dependencies or submodules were installed.

## Recorded source snapshots

All rows have clean Git status and HTTPS origins. File counts are attempted
structural input counts, not a promise that every file produced a card.

| Member | Branch | Source HEAD | Files | Structural result |
| --- | --- | --- | ---: | --- |
| effect | main | e271997a14a6ae5201c70217f86537818abbe664 | 1,864 | fresh; no reported parse failures |
| effect-tsgo | main | 13a46c929153920a4ec0b2b60fc6492b99335214 | 1,327 | fresh; no reported parse failures |
| ai-plugin-marketplace-manager | main | 3521ee7d1831a2c582336e6b4ef1e96a8802432b | 40 | fresh; no reported parse failures |
| okfit | main | 1dc1ac41cbb95cadad67023c38817fbebfa879f8 | 477 | fresh; no reported parse failures |
| tsdoctor | main | 3c2945f6512d573ea295cdea748c1d1f18b45646 | 367 | fresh; no reported parse failures |
| effected | main | 3a4b265c8b5a6a8b30954212cafce32a9ecd49a6 | 1,462 | fresh; no reported parse failures |
| pluginfinity | main | 5a2dbd482da2625c9f9487e5e3475bb3b4c31c9b | 145 | fresh; no reported parse failures |
| vitest-agent | main | 1c2100a26c3a6acccc7ca6ba7ceeccefd7d76388 | 617 | fresh; no reported parse failures |
| t3code | main | 4cd0076ec65d51974dbe3efdd03be6ed5bf91c80 | 5,456 | fresh; no reported parse failures |
| opencode | v2 | 4617210822bdbb31e5749751afbfb4584ccedac8 | 5,157 | fresh; no reported parse failures |
| alchemy | main | 1c1461cb8dad6c24a4824f36cb58b10cc3c5b7d1 | 17,435 | fresh; one parse failure |

## Builds and freshness evidence

Ran exact structural `graft build` per member, then the parent workspace and
Beep checkout. GRAFT_NO_GITIGNORE and GRAFT_NO_IGNORE preserve tracked ignore
files. No `--deep`, reference refresh, fresh timer installation or model pass
ran. The parent build correctly reports eleven federated repositories.

T3's 5,456-file graph built successfully but its initial freshness check timed
out at 120 seconds. A bounded 600-second retry passed; earlier successful
member checks were reused. The cached retry replayed all T3 files. Each member
check subsequently reported a fresh graph. Missing concept context and pending
summaries are expected for this structural-only pass; they are not deep proof.

Alchemy's build and parent build report:

> packages/alchemy/src/AWS/IAM/actions.generated.ts: parse failed — Maximum call stack size exceeded

Its build/check exits are zero despite that coverage gap. Preserve the warning
as a parser/extraction finding; do not claim complete Alchemy coverage from exit
status alone. No cause outside the observed file/tool/profile was established.

The aggregate parent freshness check reached roughly 10 GiB process memory,
filled the 4 GiB swap allocation and left about 444 MiB available. Stopped only
our identified read-only timeout process after matching its command, cwd and
parent script; it exited 143. The host recovered to about 11 GiB available.
T3, rootless Docker and CLIProxyAPI remained active. The aggregate check is
unqualified, rather than silently marked successful from child checks.

## Bounded worker and query proof

Beep build and freshness check ran in transient user scopes with MemoryMax=8G,
MemorySwapMax=256M, a 600-second timeout and a process-local Node heap limit.
Verified the active check scope's actual limits; sampled roughly 3.4 GiB memory
use with about 7.9 GiB available. Both operations exited zero; the graph is fresh.
No system-wide memory, swap or service settings were changed.

Three navigation proofs succeeded:

- Direct Effect source query returned schema-related source locations; scoped
  `graft grep "Struct"` located the implementation in
  `packages/effect/src/Schema.ts:3585`.
- Parent-workspace query scoped to `effect/` returned namespaced Effect hits,
  proving the link and federation work. It used MemoryMax=4G/MemorySwapMax=128M.
- Beep source query scoped to the Refs command returned source-backed
  ReferenceWorkspace symbols. It used MemoryMax=6G/MemorySwapMax=128M.

The final two queries had 180-second bounds, explicit socket removal and
`--no-refresh`, using the newly checked child/checkout graphs. They do not prove
that default unscoped aggregate auto-refresh is safe. Example admitted lookup:

```sh
cd "$HOME/YeeBois/projects/beep-effect"
timeout 180 systemd-run --user --scope \
  --property=MemoryMax=4G --property=MemorySwapMax=128M \
  env -u SSH_AUTH_SOCK GRAFT_NO_GITIGNORE=1 GRAFT_NO_IGNORE=1 \
  NODE_OPTIONS=--max-old-space-size=3072 \
  graft ask "Schema Struct" .repos/effect-workspace \
  --in effect/ --source --no-refresh -n 3
```

Persistent worker resource guards and freshness policy remain a follow-up.
Do not route an unbounded aggregate check through an agent merely because the
lookup above passes. Deep ingestion and other host profiles remain unqualified.

## Rollback and remaining scope

These are regenerable caches and new reference clones. Inventory ownership and
any later edits before removal; preserve future user work. Origin transport can
be changed back per clone without changing history. Transient scopes exited;
no scheduled jobs or persistent resource policy was installed.

The goal retains Alchemy parser coverage, aggregate resource behavior, model
policy, required/optional MCP connections and detached Yeet as explicit work.
No tracked worker file, GitHub write, cloud resource or staking host was changed.
