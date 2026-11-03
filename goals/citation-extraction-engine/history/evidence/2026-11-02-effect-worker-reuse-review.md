# Effect worker reuse review

User requested comparison with the canonical Effect workers and workflow sources.
Reference inspected: Effect revision `7a87ff9b88b1a570995b1b5570559c1b4dd5367b`
at `/home/elpresidank/YeeBois/references/effect/effect`.

Current HTML execution uses Effect ChildProcessSpawner, Stdio, Stream, Schema,
Scope, Clock, Deferred and semaphore primitives, but implements a private framed
transport and parent supervisor rather than WorkerPlatform/WorkerRunnerPlatform.
That is partial upstream reuse, not adoption of Effect's worker abstraction.

Primary-source findings:

- `packages/effect/src/workers/Worker.ts` provides effectful send/run,
  platform readiness, handler ownership and scoped cleanup. `makeUnsafe` accepts
  effectful transport functions; `makePlatform` supports platform setup/listen.
- `packages/effect/src/workers/WorkerRunner.ts` defines the worker-side transport
  service. Worker-backed RPC is implemented in RpcClient/RpcServer.
- `packages/platform/node/src/NodeWorker.ts` explicitly supports IPC child
  processes as well as worker_threads. Process isolation alone does not justify
  avoiding the worker abstraction.
- NodeWorker and BunWorker adapters use a fixed five-second graceful shutdown
  before forcing termination. This does not satisfy the citation contract's
  captured deadline, confirmed retirement and quarantine obligations by itself.
  The goal's 2026-10-28 policy records this limitation, but it is a containment
  specialization, not a justification for replacing all worker orchestration.
- `packages/effect/src/workflow/Workflow.ts` and WorkflowEngine concern durable
  executions, idempotency, activities, suspension and resumption. Those are not
  required by the current single native job and do not replace worker isolation.

Follow-up within the engine goal: evaluate and adopt WorkerPlatform and
WorkerRunnerPlatform (and typed RPC where it preserves bounded accounting) over
an owned process adapter. Retain exact frame preflight, source privacy, total and
regex admission, force-stop deadlines, exit acknowledgement and quarantine.
Prove it with the existing real-process/corpus controls before replacing the
current implementation. The actual regex worker is still unfinished and should
start from this upstream-first design. No migration or fidelity proof is claimed
by this review record.
