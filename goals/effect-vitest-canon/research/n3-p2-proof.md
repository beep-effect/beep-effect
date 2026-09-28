# N3 canonical test closeout

Source commit: `88003af1b4e3ce99df9aa79fa9e2e409da7f691b`.

The seven saved detector findings are resolved, alongside one new spy-ownership
finding reproduced during local review. Five per-test provisions and their
custom wrapper become a public native layer. All 15 assertions and six
registrations remain. No production source, property domain, seed or deadline
changes. Only the globally mutating writer-spy case is nonconcurrent.

Full audit passes in 6.7 seconds and docgen in 2.9 seconds. Oxlint, Sherif,
attributed Fallow health/audit, cache policy and range changeset checks pass.
Runner integration adds seven owned dependency edges across twelve reviewed
cache nodes, without qualification promotion.

Both runtimes execute all six tests before and after, without skips. Node takes
3.919 seconds before and 3.870 after; Bun takes 2.017 before and 1.316 after.
Source hashes remain stable. Timing contexts record runtime versions, process
limits, workstation load and pressure. Both phases overlap an early publisher
or its termination; these are observations, not a causal performance claim.

The valid cleanup control uses an afterAll restoration witness outside an
expected-failure test: the original suite exits 1 with the prototype still
replaced, and the repaired suite exits 0. The earlier insensitive afterEach
probe is excluded. Exact source bytes are restored after controls.

The one current detector exception concerns layer startup timeout inference:
N3TurtleCodecLive is a synchronous, stateless Layer.succeed with no container,
server or asynchronous resource acquisition. Native test deadlines still apply.
Strict schemas validate 5,774 root findings and 14,579 historical ledger rows,
plus census and timings. Reconciliation preserves 683 unrelated ledger hashes
and every unrelated root/census object byte-for-byte. Thirty packages and 1,238
saved actions remain; whole-goal final proof is outstanding.
