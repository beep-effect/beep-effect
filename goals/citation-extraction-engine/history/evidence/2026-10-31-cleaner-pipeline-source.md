# Cleaner sequence and callback source observations

Date: 2026-10-31. Scope: pinned source behavior before a composed target cleaner.

The new source producer runs eyecite 2.7.6 at the exact goal commit and tree,
with CPython 3.11.15, a zero hash seed, 64-bit SipHash13 and the frozen dependency
versions. It checks that the oracle checkout is clean before and after capture.
The report retains source, producer, license, lockfile and original operation
corpus hashes. The original operation corpus and its twelve cleaning outcomes
are unchanged; each is independently replayed and compared in this producer.

## Captured coverage

The report contains 1,155 cases and 8,703 ordered events. Seven input texts run
all 156 sequences of zero through three steps over the five named cleaners,
including repetitions and ordering differences: 1,092 cases. The inputs include
empty text, whitespace/underscores, HTML, an XML encoding declaration, Unicode,
excluded HTML parents and lone surrogates. Twelve original public-operation
observations and 51 controlled callback/dispatch/iteration scenes complete the
corpus. Three scenes execute two successive runs with retained state, yielding
1,158 total outcomes: 939 successes and 219 failures.

All 109 immutable strings retain complete content and content hashes. They
include the original long public-operation text and complete source exception
messages. Values are never shortened or replaced by digest-only observations.
The portable checker recomputes Python-compatible ASCII JSON string hashes,
checks exact case order/counts, requires all references and rejects unreferenced
strings. It binds the complete report bytes before parsing and verifies producer
and original operation corpus identity. Source pin, license, runtime and scope
metadata are schema constraints. A fresh pinned replay must be byte-identical.

The observer traces the five original builtin function code objects without
replacing them or their registry values. Controlled callbacks record arguments,
returns, exceptions and call counts. Iterators record lazy yields and completion.
Known host objects and lists receive observation-local identity slots using
identity checks; observation does not add key hashes, equality or truth calls.
The registry is restored between scenes. Native diagnostics are captured after
HTML evaluation; a declaration rejection cannot inherit earlier parser errors.

## Requirements exposed by the source

- Named lookup precedes callable dispatch. A callable string key equal to html
  invokes the builtin, and an unhashable callable fails before invocation.
- Membership and value lookup are distinct dictionary operations. A controlled
  step can change its hash between them and select a different builtin, or
  remove the key during its second hash and raise KeyError. Removing a key
  during equality can instead fall through to the callable path. Truth-valued
  equality results and hash/equality failures have ordered observations.
- Steps are consumed lazily. A callback may append a later step or remove a
  future step; a reused generator is exhausted on its second run. Iterator or
  callback failure prevents later steps from being consumed or invoked.
- The cleaner registry is live. A callback can replace, delete or add a named
  entry, install a non-callable value, or register a function object as a key.
  The next dispatch sees the mutation. Reentrant cleaning shares that registry.
- Callback outputs are not checked as strings. None, integers, bytes and host
  objects can be final values or intermediate arguments. A later callback can
  consume the identical host/list value and restore text. Builtins can raise
  when given these values. String subclasses and input identity are observed
  separately from string-content equality. Callback state survives successive
  calls; it must not be recreated silently at each step or operation.

These facts forbid replacing the entire canonical pipeline with an eagerly
resolved array of string-to-string functions. Named schema modes remain data,
and callables remain injected server capabilities, as required by the goal.
The target still needs an explicit runtime host-value/identity contract, lazy
step capability and live registry behavior where those source capabilities are
used. No arbitrary host value belongs in a semantic Citation schema or a
function-valued raw-text request. No string coercion or rejection is adopted as
a substitute for preserving these source outcomes.

## Approved native safety interaction

One controlled scene runs a callback after an HTML depth-resource event. The
source succeeds with truncated empty HTML text and then invokes that callback.
The original events are retained. Under the already approved HTML safety
exception, the target must fail at the HTML stage, publish no partial result and
not run subsequent steps. This follows the existing native-resource exception;
it is not a new normalization law, semantic waiver or permission request.

## Portable gate and retained scope

The new source checker is a fixed eleventh component of citation:parity-check.
It uses Bun/Effect and the committed report; Python and a live oracle clone are
not portable runtime dependencies. The dedicated maintainer verifier also
exercises sixteen altered reports, including missing/duplicate/reordered cases,
trace/outcome deletion, changed license/runtime/source metadata and a rebound
artifact whose references are changed consistently. The whole package command's
corruption suite now includes this eleventh component and sixteen controls.
Audit success continues to state that target proof is incomplete. Default mode
must still reject the unfinished canonical, donor, supplemental, divergence and
regex proof plus the missing final target verifier.

The exact generated report path is excluded from formatting and spelling to
preserve source bytes and legal text. Its dedicated source/hash/schema/reference
checks and corruption controls replace those text-rewriting checks only for
that artifact; authored code and prose remain checked.

## Phase validation

The pinned producer reproduced the complete committed bytes on fresh replay.
All sixteen dedicated corruption controls rejected their altered reports. The
whole package command passed ordinary and relocated audit baselines and all
sixteen rejection controls, including default incomplete proof and each of the
eleven corrupted components. The use-cases package audit and documentation gate
passed (11.9 s and 12.4 s). Both edited TypeScript checkers passed strict type
checking with exact optional keys and unchecked-index checks; authored checker
formatting, Markdown and spelling checks passed. The generated corpus is checked
by its dedicated verifier instead of rewriting tools. Production server source
and tests did not change; the prior worker qualification remains separate.

No composed target cleaner, public port, source map or engine Layer is claimed.
Global admission and shared time/work budgets remain open. Composition must also
distinguish original source limits from permitted intermediate produced text.
No canonical row, normalization law, fidelity question or semantic waiver is
promoted by this source-only phase.
