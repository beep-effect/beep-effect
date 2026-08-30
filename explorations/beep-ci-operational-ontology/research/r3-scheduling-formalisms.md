# R3: scheduling and incrementality formalisms

**Date:** 2026-08-27

The proposed model is coherent if it treats scheduling, admission, stopping, and cache
validity as four separate mechanisms. DRR answers who receives the next service budget.
Admission control answers whether a request may enter. Fail-fast policy answers when an
episode has enough evidence to stop. Incremental-build logic answers whether an old proof
is still valid. Combining these into one score or one epoch flag would erase useful
guarantees.

## (a) Fair queueing, deficit round robin, and weighted service

The closest established algorithm is *Efficient Fair Queueing Using Deficit Round-Robin*
by M. Shreedhar and George Varghese, IEEE/ACM Transactions on Networking 4(3), 1996,
[DOI 10.1109/90.502236](https://doi.org/10.1109/90.502236). It schedules indivisible,
variable-size packets without pretending that one packet equals one unit of work.

For each active flow `i`, DRR keeps a FIFO queue, a deficit counter `D_i`, and a positive
quantum `Q_i`. One scheduler round visits each active queue once:

1. Add `Q_i` to `D_i`.
2. While the head item has cost at most `D_i`, serve it and subtract its cost from `D_i`.
3. If the queue empties, reset `D_i` to zero and remove it from the active list.
4. Otherwise retain the unused deficit and move the queue to the active list's tail.

The retained deficit is the essential move. Plain round robin is unfair when item sizes
differ. DRR carries an under-served flow's credit forward until it can afford an indivisible
item. If `Q_i = w_i Q`, the long-run service shares of continuously backlogged queues are
proportional to the weights `w_i`, subject to bounded packetization error. The weights
govern throughput, not priority or a deadline.

Shreedhar and Varghese prove near-perfect throughput fairness without a traffic-distribution
assumption and `O(1)` processing work per packet when each quantum is at least the maximum
packet size. Their basic algorithm does not provide a latency bound. Later papers refine
DRR fairness bounds, so beep-ci-ops should not encode a numeric service-error theorem from
the original paper without choosing and verifying one specific refinement.

The mapping is direct:

| Queueing term | beep-ci-ops term |
| --- | --- |
| flow | agent queue |
| packet | admitted `WorkUnit` |
| packet length | charged grant cost |
| quantum | per-round seat budget |
| deficit counter | carried service credit |
| link capacity | machine CPU, memory, and lock capacity |

One qualification matters. A job's wall time is unknown before it runs, unlike a packet's
byte length. Admission should use a conservative cost estimate, then charge actual service
after completion. Estimate error must become explicit debt or credit. Otherwise agents can
gain service by systematically underestimating jobs.

DRR also accounts in one scalar unit. A `ResourceBudget` is a vector of CPU, memory, lock
occupancy, and time, and vectors have no single subtraction order. Either choose one explicit
scheduling currency and enforce the other resources as admission constraints, or adopt a
multi-resource allocation rule. *Dominant Resource Fairness: Fair Allocation of Multiple
Resource Types* by Ali Ghodsi, Matei Zaharia, Benjamin Hindman, Andy Konwinski, Scott
Shenker, and Ion Stoica generalizes max-min fairness using each user's dominant resource
share
([NSDI 2011 paper](https://www.usenix.org/legacy/events/nsdi11/tech/full_papers/Ghodsi.pdf)).
Calling a vector-valued deficit "DRR" without such a scalarization or allocation rule would
leave its comparison and fairness guarantees undefined.

`MaxGrantCost <= min_i Q_i` supplies the maximum-packet premise for the constant-work form.
A request above that bound must be split into smaller `WorkUnit`s, sent to a separately
governed large-job lane, or rejected. Silently waiting for enough deficit makes eventual
service possible, but it destroys the intended short-turn latency and can produce
head-of-line blocking. Weighted DRR should use policy weights sparingly. A high weight is a
durable throughput entitlement, not a way to declare the current request urgent.

### What beep-ci-ops takes

Use per-agent FIFO queues, carried deficit, and quanta measured in estimated service cost.
Set an admissible maximum item cost, reconcile estimates against actual use, and expose
weights as policy. Claim bounded throughput unfairness and starvation resistance for
continuously eligible queues. Do not claim a deadline or tail-latency guarantee from basic
DRR.

## (b) Admission control and backpressure

Reactive Streams defines demand as the number of elements requested but not yet delivered.
Its `request(n)` is additive, a publisher must not deliver more than outstanding demand,
and cancellation makes later requests no-ops. The specification's stated purpose is to keep
asynchronous boundaries from requiring unbounded buffers. See *Reactive Streams JVM
Specification*, Reactive Streams Special Interest Group,
[version 1.0.4](https://github.com/reactive-streams/reactive-streams-jvm/tree/v1.0.4).

That contract is necessary but too weak for heterogeneous verification work. One lint shard
and one full-repository typecheck are both one element. `SeatGrant` should therefore be a
weighted demand token: permission to admit at most a stated amount of CPU time, memory,
lock occupancy, and TTL, rather than permission to enqueue one arbitrary job.

TCP offers a second useful distinction. In *TCP Congestion Control* by Mark Allman, Vern
Paxson, and Ethan Blanton,
[RFC 5681](https://www.rfc-editor.org/rfc/rfc5681), a sender's outstanding data is bounded
by the smaller of the congestion window `cwnd` and receiver window `rwnd`. The former tracks
the network's inferred capacity; the latter protects receiver buffer capacity. For
beep-ci-ops, the machine-wide concurrency budget resembles `cwnd`, while a worker's current
ability to accept work resembles `rwnd`. A grant must satisfy both.

The analogy stops there. TCP uses ACKs and loss to adapt a byte window. Reactive Streams
uses downstream demand in element counts. Neither standard defines multi-resource job
packing, predicted execution cost, or `MaxGrantCost`. Those are admission-control policy.

*SEDA: An Architecture for Well-Conditioned, Scalable Internet Services* by Matt Welsh,
David Culler, and Eric Brewer connects the pieces more closely. SEDA places explicit queues
between stages and uses resource controllers, batching, and load shedding to keep stages
within an operating region under overload
([paper](https://www.cs.princeton.edu/courses/archive/fall04/cos518/papers/seda.pdf)).
Its lesson is that a bounded queue still needs an overload action. When full, beep-ci-ops
must defer, reject, coalesce, or replace work. "Bounded" without a specified overflow rule
only moves the unbounded wait upstream.

The proposed cost-bounded quantum corresponds to two related but distinct controls:

- `MaxGrantCost` is a maximum packet or job size at admission.
- `SeatGrant.resourceBudget` is a credit window for work already admitted.

The queue bound should cover both request count and estimated resource cost. A count bound
limits metadata growth; a cost bound limits work-in-system. Keep admission separate from
scheduling: admission decides whether a request is eligible now, while DRR chooses among
eligible requests.

### What beep-ci-ops takes

Model a `SeatGrant` as cost-denominated demand with an expiry, not as a mutex or an
unweighted slot. Bound queued count, queued estimated cost, active CPU, active memory, and
lock occupancy. Make overflow behavior explicit. Use separate machine-capacity and
consumer-capacity windows, and let release or completion return credit.

## (c) Speculation, first failure, and stopping

The verification objective is not ordinary makespan. On a red episode, the valuable event
is the first actionable failure. Once an agent acts on that failure, it creates a new tree
and therefore a new cache epoch. Any still-running proof about the old tree cannot establish
certainty about the new one.

For a serial order `pi` of independent checks, let `c_i > 0` be expected cost, `p_i` the
probability of an actionable failure, and `q_i = 1 - p_i`. If a passing episode must
eventually run every required check, expected time to the first failure or all-pass decision
is

```text
E[T(pi)] = sum_k c_pi(k) * product_{j < k} q_pi(j).
```

A pairwise interchange proves that check `i` should precede check `j` exactly when
`p_i / c_i >= p_j / c_j`. This is a model-derived rule, not a claim from DRR or APFD. In
practice, use conditional failure probabilities and remaining-time distributions because
failures are correlated and runtimes are heavy-tailed. Dependency constraints also limit
which checks may move earlier.

Test case prioritization supplies a neighboring objective. *Test Case Prioritization: A
Family of Empirical Studies* by Sebastian Elbaum, Alexey G. Malishevsky, and Gregg
Rothermel, IEEE Transactions on Software Engineering 28(2), 2002,
[DOI 10.1109/32.988497](https://doi.org/10.1109/32.988497), studies orderings that increase
the rate of fault detection. Its APFD metric is

```text
APFD = 1 - sum_f TF_f / (n * m) + 1 / (2 * n),
```

where `TF_f` is the position of the first test exposing fault `f`, `n` is the number of
tests, and `m` is the number of faults. *Incorporating Varying Test Costs and Fault
Severities into Test Case Prioritization* by Sebastian Elbaum, Alexey G. Malishevsky,
Gregg Rothermel, Satya Kanduri, and Bibhuti G. Steece introduced the cost-cognizant
`APFDc` at ICSE 2001
([DOI 10.5555/381473.381508](https://doi.org/10.5555/381473.381508)).

APFD and `APFDc` should inform evaluation, but neither is the beep-ci-ops KPI. APFD rewards
early exposure of every represented fault across a full ordering. Beep-ci-ops usually stops
after the first failure that causes a repair, and its unit is an online verification episode.
Use time-to-first-actionable-failure on red episodes and time-to-all-required-proofs on green
episodes. Report them separately before aggregating fleet P50/P95, or a changing red rate
will make the aggregate hard to interpret.

Parallel fan-out trades shorter detection latency for wasted work. Let `tau` be the first
actionable failure time and `kappa` the time at which cancellation reaches workers. A useful
episode waste measure is

```text
W = service completed after tau on invalidated work
  + service already completed for downstream proofs invalidated by the repair.
```

Track both resource-time waste and wall-clock delay. Cancellation latency belongs in the
first term. Jeffrey Dean and Luiz Andre Barroso's *The Tail at Scale*, Communications of
the ACM 56(2), 2013,
[DOI 10.1145/2408776.2408794](https://doi.org/10.1145/2408776.2408794), shows why delayed
hedging and prompt duplicate cancellation can reduce tail latency at controlled extra load.
It does not justify launching every expensive proof eagerly, especially when 59% of local
attempts are red.

This is only an optimal-stopping problem while evidence remains ambiguous. If a failure is
actionable and the next action changes the tree, continuation has no value for current-epoch
certainty, so stopping dominates. Flaky, environmental, duplicated, or non-actionable
failures require a classification step; the policy may continue a bounded diagnostic lane
before deciding to repair.

### What beep-ci-ops takes

Order serially ready checks by estimated actionable-failure probability per unit cost,
subject to dependencies. Cancel obsolete work as soon as an actionable failure commits the
episode to repair. Measure first-failure latency, green makespan, cancellation latency, and
invalidated resource-time separately. Use delayed, budgeted speculation only when its
measured tail-latency benefit exceeds its added fleet load.

## (d) Build-system incrementality and Turborepo

*Build Systems à la Carte* by Andrey Mokhov, Neil Mitchell, and Simon Peyton Jones,
Proceedings of the ACM on Programming Languages 2, ICFP Article 79, 2018,
[DOI 10.1145/3236774](https://doi.org/10.1145/3236774), separates a build system into two
orthogonal choices:

- A scheduler chooses which keys to build and in what order. The paper models topological,
  restarting, and suspending schedulers.
- A rebuilder decides whether a key is already current. The paper models dirty bits,
  verifying traces, constructive traces, and deep constructive traces.

In the paper's table, Make is topological plus dirty-bit rebuilding; Ninja is topological
plus verifying traces; CloudBuild is topological plus constructive traces; Bazel is
restarting plus constructive traces; Shake is suspending plus verifying traces.

Turborepo is best classified as an engineering approximation of topological scheduling plus
constructive traces. Its configured package/task dependencies form a DAG, and ready tasks
may run in parallel. Its cache maps a fingerprint of declared global and task inputs to
stored logs and declared file outputs. See Vercel's *Package and Task Graphs*
([documentation](https://turborepo.dev/docs/core-concepts/package-and-task-graph)) and
*Caching* ([documentation](https://turborepo.dev/docs/crafting-your-repository/caching)).
This is an analogy to the paper's model, not a claim that Turborepo implements its Haskell
`ctRebuilder` literally.

The important boundary is declaration. Turborepo assumes tasks are deterministic relative
to the inputs it hashes. An undeclared file, environment variable, tool version, network
response, or side effect can make a cache hit unsound. The task graph is also predominantly
static. Calling it a suspending scheduler would falsely imply Shake-style discovery of
dynamic dependencies during task execution.

The beep-ci-ops projection implies a two-level scheduler:

1. Project `ChangeSet × CertaintyTier` into a dependency-closed DAG of required
   `WorkUnit`s.
2. Maintain its topologically ready set, then use resource admission and per-agent DRR to
   choose which ready unit receives a `SeatGrant`.

Its rebuilder should use constructive, content-addressed traces for reusable proofs. A cache
hit returns the prior proof artifact; a miss executes the lane and records its result against
the complete semantic input key. Failure results need a shorter or policy-specific reuse
rule because a repair changes the tree immediately.

This composition preserves the paper's separation. Graph projection and DRR are scheduler
concerns. Hash completeness and proof reuse are rebuilder concerns. `CacheEpoch` is part of
the persistent build information, not a substitute for either component.

### What beep-ci-ops takes

Use a topological ready-set scheduler composed with cost admission and DRR across agents.
Use a constructive-trace rebuilder keyed by all declared semantic inputs. Keep projection,
scheduling, and rebuilding as separate interfaces so fairness policy cannot change cache
correctness and cache policy cannot silently change dependency order.

## (e) Cache epochs, versioned stores, and memoization soundness

Self-adjusting computation gives the strongest correctness target: after inputs change,
incremental reuse should produce the same observable result as recomputation from scratch.
*A Consistent Semantics of Self-Adjusting Computation* by Umut A. Acar, Matthias Blume,
and Jacob Donham formalizes memoizing change propagation and proves consistency with purely
functional evaluation
([paper](https://doi.org/10.1017/S0956796813000099)). *Incremental Computation with Names*
by Matthew A. Hammer, Jana Dunfield, Kyle Headley, Nicholas Labich, Jeffrey S. Foster,
Michael Hicks, and David Van Horn calls the corresponding property "from-scratch
consistency" [DOI 10.1145/2814270.2814305](https://doi.org/10.1145/2814270.2814305).

For beep-ci-ops, the soundness obligation is:

```text
reuse(proof, request) is allowed only if
  proof.semanticInputs == request.semanticInputs
  and proof.result is deterministic over those inputs.
```

The semantic inputs include at least lane definition, scope, tree content, affected base,
dependency closure, relevant configuration and environment, toolchain versions, and the
cache-policy version. `CacheEpoch` can name that policy/version world. `TreeState` names the
source world. Keeping both avoids conflating "the files changed" with "the rules for hashing
or interpreting those files changed."

A versioned store should treat the epoch as a fencing token:

1. A request captures epoch `e` and tree `t` when admitted.
2. Workers read and write only entries keyed by `(e, t, lane, scope, semantic inputs)`.
3. Publishing a proof uses compare-and-set against the current epoch and tree.
4. If either changed while work ran, retain the artifact only under its old key and do not
   advertise it as current certainty.

This closes the stale-writer race. Merely clearing a cache on epoch change does not: an
old worker can finish later and repopulate the cleared namespace unless publication checks
the captured version.

The epoch is a coarse invalidation mechanism. A single global epoch is safe if every change
advances it, but it throws away valid reuse. Dynamic dependence graphs in self-adjusting
computation and input traces in build systems support narrower invalidation. The best design
uses fine-grained content/dependency keys for ordinary changes and advances the coarse epoch
when the interpretation changes, such as hash rules, toolchain semantics, global inputs, or
proof schema.

Memoization also needs an identity policy. *Selective Memoization* by Umut A. Acar, Guy E.
Blelloch, and Robert Harper gives programmers control over equality and precise dependencies
[DOI 10.1145/604131.604133](https://doi.org/10.1145/604131.604133). The beep-ci-ops version
of that choice is explicit `HashSurface` membership. Omitting a semantic input yields a fast
but unsound hit; including irrelevant inputs preserves correctness but increases misses.
TTL alone cannot prove validity because age says nothing about input equality.

### What beep-ci-ops takes

Define proof reuse by from-scratch consistency. Key proofs by `CacheEpoch × TreeState` plus
the complete lane, scope, dependency, configuration, environment, and toolchain inputs. Use
epoch/tree compare-and-set when publishing results. Prefer dependency-directed invalidation
for source changes, reserve epoch bumps for semantic changes, and never treat TTL or cache
presence as evidence of correctness.
