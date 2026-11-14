# Issue: on Effect Cluster, a new consumer's backfill finds no instances

Written for alchemy `packages/domain` (33c10dd, 2.0.0-beta.87). Found in phase 9;
not filed (D44), and not patched here: the prototype carries three patches only.

## Title

Effect Cluster: object-call arguments go through `JSON.stringify`, so the
directory listing's absent cursor arrives as `null` and every backfill lists
nothing.

## What happens

On Effect Cluster, a Durable-Object-style method call is sent as one RPC,
`Call({ method, args: JSON.stringify(args) })`, and the entity calls the method
with `...JSON.parse(payload.args)` (`EffectCluster/index.ts`). `JSON.stringify`
writes an `undefined` array element as `null`.

A backfill run lists the directory from its root with
`net.node.list(path, after)`, `after` being `undefined` for a first page
(`Backfill.ts`, `listed`). On the node, `makeNode(...).list` tells a first page
by `after === undefined`:

- `children` is listed only when `after === undefined`, so with `null` it is
  `[]`;
- `startAfter: after` is passed to the storage list, and the cluster storage
  adds `AND key > ${startAfter}` whenever it is not `undefined`, so with `null`
  the query is `key > NULL` and returns no rows.

Every listing is empty, so the run's root sees no subtrees, both passes are
"done" at once, and the run completes with no instance scanned. A consumer
added by a deploy (a new projection or view, or one rebuilt by a version bump
outside the in-place case) never receives the history; it sees only events
committed after it started.

Cloudflare's RPC keeps `undefined`, and the in-memory platform calls methods
directly, so neither shows it.

## Failing case

On two runners with Postgres, restoring a dump that holds six claims (one
decided) into a stack whose model adds a projection over `Claim`:

- the directory holds all six (`Party.DomainDirectory/node:` lists `c:Claim:`,
  and the leaves list each claim);
- the runner logs `backfill run-pass projection:ClaimDecisions discover
  done=true subtrees=0 ... in 8ms`, then the same for `ready`;
- the run's progress is `phase: complete, subtrees: 0, instances: 0`;
- the projection's input log holds only the one decision made after the
  restore.

The same defect explains an earlier observation: a projection rebuilt by a
view's version bump took the first live event as its input 1, without
replaying history.

## Proposed change

Either (or both):

1. Keep `undefined` across the wire: encode arguments with a codec that
   distinguishes it (or pad trailing optional arguments out), so a method sees
   what its caller passed.
2. Make the node's `list` treat `null` like `undefined` (`after == null`), and
   have the cluster storage's `list` skip `start`, `startAfter` and `end` when
   they are `null`.

A test: the stranded-drain style in-process host, with its namespace sending
arguments through `JSON.stringify`/`JSON.parse` as the cluster does, a model
with history, and a redeploy adding a projection: the projection must receive
every past event.
