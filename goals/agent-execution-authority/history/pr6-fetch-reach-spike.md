# PR 6 blocking check — does a policy `Fetch` reach a dispatched MCP tool handler?

**Date:** 2026-07-27
**Verdict:** **PASSED.** The stop condition in `SPEC.md` is discharged.
**Method:** a throwaway spike mounting a one-tool toolkit through the real
`sanitizedToolkit` + `McpServer.layerHttp` stack, driven by a real MCP client
over `HttpRouter.toWebHandler`, with the tool handler issuing an outbound POST.
Five placements, each with a recording `fetch`. The spike file was deleted after
the findings were recorded here; the shipping proof is the PR 6 test.

## Results

| # | Where `Fetch` is provided | Handler ctx has `Fetch` | Which fetch ran |
| --- | --- | --- | --- |
| A | into `FetchHttpClient.layer`'s own graph | **no** | **policy** |
| B | onto the outer composite layer | yes | policy |
| C | per-request, via HTTP middleware | yes | policy |
| D | nowhere (control) | no | `globalThis.fetch` |
| E | policy at root **and** contender per-request | yes | **contender** |

D is the falsification control: with no override anywhere the request lands on
the stubbed global, so the harness can distinguish the cases. Without it, A–C
passing would have proven nothing. (The first run of this spike had only A–C,
all three passed, and the result was worthless.)

## What the packet predicted, and why it was wrong

`README.md` predicted the policy `Fetch` would reach handlers **iff** provided
into the toolkit's layer graph, and would be discarded if provided per-request,
"because `provideContext` *replaces* the fiber context rather than merging."

Both halves are false.

1. **`Effect.provideContext` merges.** `internal/effect.ts:2160` is
   `updateContext(self, Context.merge(context))` — the provided context wins on
   key collisions, but everything already in the fiber context survives. Nothing
   is discarded. This is why C works.
2. **A works for a different reason than predicted.** In A the handler's context
   does **not** contain `Fetch` (measured), yet the policy fetch still ran. The
   override rides with the `HttpClient` layer itself:
   `HttpClient.layerMergedContext` (`HttpClient.ts:1924-1935`) captures its own
   build context and, at execute time, runs
   `Effect.updateContext((input) => Context.merge(context, input))`. So the
   `Fetch` reference is resolved from *(HttpClient layer build context)* merged
   with *(request-time context)*.

The practical consequence is the opposite of the prediction: the override is
**harder** to lose than feared, not easier.

## The finding that actually matters — E

`Context.merge(context, input)` gives **`input`** — the request-time context —
precedence. So a `Fetch` placed into the fiber context per-request **displaces**
the composition-root policy fetch. In E the contender ran and the policy fetch
recorded nothing.

This is a real property of the egress control and it is not defended by the type
system:

> **Invariant:** no layer or middleware in the MCP transport graph may provide
> `FetchHttpClient.Fetch` per-request. Anything that does silently replaces the
> egress boundary for every tool dispatched behind it.

Today nothing in the transport does this, and no attacker-controlled code runs
in that position — the graph is composition-root code only. It is recorded
because the failure is silent: the tool still works, the ledger still gets the
tool's own decision rows, and only the egress refusal disappears.

## Correction owed to PR 5

`SanitizedSpan.ts` carries a comment claiming `provideContext` "replaces the
context with the layer-build services: `HttpServerRequest` is in the request
fiber here and gone inside the handler." Measured: `HttpServerRequest` is
present inside the handler in all five placements. The **code** is fine —
reading the session header at the request boundary is correct and does not
depend on the false claim — but the justification is wrong and is corrected in
PR 6 rather than left to mislead the next reader.

## Incidental finding

`Context.getReferenceUnsafe` memoizes a `Reference`'s default **on the reference
object, process-wide** (`Context.ts:1526-1531`). `FetchHttpClient.Fetch`'s
default therefore captures whatever `globalThis.fetch` was at first resolution
and keeps it forever. Irrelevant to production; it matters to any test that
stubs the global, which must clear the memo first.
