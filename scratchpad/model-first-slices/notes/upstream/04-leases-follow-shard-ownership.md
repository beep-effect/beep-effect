# Proposal: drain leases that follow instance ownership

For alchemy `packages/domain` at 33c10dd (2.0.0-beta.87). A proposal, not a patch. It builds on
`01-drain-lease-takeover.patch`, which makes recovery wait out the lease instead of stranding the
rows.

## What happens

Every durable queue (an aggregate's or view's outbox, a policy's inbox) and every projection key's
input log is drained under a storage lease: `<name>-lease` holds a wall-clock expiry,
`now + LEASE_MS` (60 s, `DurableObjects.ts`). A drain that finds the lease unexpired leaves it
alone.

The lease is the only thing that tells a live drain from a dead one, and it cannot tell them apart
before it expires. When a runner dies mid-drain, the rows it was delivering wait for the rest of its
lease, then for the host to deliver the wake (on Effect Cluster, a persisted message read on the
entity-message poll, 10 s by default).

The host already knows something better than the clock. An instance runs in one activation at a
time: a Durable Object by construction, and on Effect Cluster an entity is activated on the runner
that holds its shard lock. A new activation of an instance means the shard moved, so a lease taken
by an earlier activation was taken by a drain that is gone, or by one that no longer owns the
instance.

## Evidence

With 01, on Effect Cluster with PostgreSQL 17 (two runners and a front on a single-node Docker
swarm): a command committed, then both runners killed. Every reaction happened once, finishing
66.8 s, 67.7 s and 67.0 s after the kill in three runs, against a bound of `LEASE_MS` plus two
entity-message polls (80 s). Most of the wait is the 60 s lease the killed drain left.

## Proposed change

1. **An activation id.** The object state gets a random `activation` minted when the platform
   activates the instance (`ObjectState.activation`). It costs nothing to store and never leaves
   the process.
2. **Leases name their holder.** A lease is `{ holder: activation, expires }`. The stored number
   form keeps reading, as a lease with no holder that only the clock can expire.
3. **Acquire follows ownership.** A drain may take the lease when it has expired, as now, or when its
   holder is not this activation. A lease held by this activation is respected until it expires, so
   two drains in one activation still run one at a time.
4. **Hosts opt in.** A platform declares that a new activation implies the old one ended
   (`singleActivation`). Durable Objects and Rivet do; Effect Cluster does, with the caveat below.
   Hosts that do not keep today's behaviour.

The first drain of a new activation (the backstop callback, or the first commit's kick) then takes
over at once. Recovery after a kill becomes the time until the new owner activates the instance: on
Effect Cluster, the dead runner's shard lock expiry (35 s) and the next assignment refresh, instead
of up to 60 s of lease plus the wake.

### The overlap window

On Effect Cluster a runner that stalls past its shard lock (a GC pause, a partition, a frozen
container) keeps its activation while another runner activates the same instance. With this
proposal the new activation takes the lease while the stale one may still be draining, so both may
deliver the same rows for a while.

That adds no new kind of behaviour. Delivery is already at least once: a drain that dies after
delivering a row and before deleting it delivers it again, and every consumer handles a redelivery
(the receipt of a command id answers a repeated `send`; inboxes keep what they processed). What
changes is when a duplicate can happen, not whether. With `03-commit-version-check.patch`, a stale
activation cannot overwrite the instance's state either, and with
`07-commit-fenced-on-shard-ownership.patch` it cannot commit at all.

### What changes

- `DurableObjects.ts`: `ObjectState` gains `activation`; `queue` and the projection drain's `acquire`
  read and write the holder; the backstop and the reschedule from 01 stay as the fallback for hosts
  without `singleActivation`.
- Each platform sets `activation` when it builds an instance's state, and declares
  `singleActivation`.
- No change to stored rows other than the lease value; no wire change.

### Tests it needs

- In memory: a lease left by a dead activation is taken by the next activation at once, not after
  `LEASE_MS` (the stranded-drain cases with a second activation instead of a `TestClock` advance).
- In memory: two activations of one instance draining together deliver each row at least once, and
  the consumers' results are the same as with one.
- On Effect Cluster: the kill-after-commit case finishes within the shard lock expiry plus the
  assignment refresh, measured from the kill.
