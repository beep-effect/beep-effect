# Shared physical native process owner

Extract the HTML supervisor's physical ownership into
`makeCitationNativeProcessOwner`, used by the actual HTML worker and exercised
directly with regex reservations. The owner captures Clock, ChildProcessSpawner
and Scope. Operation/native admission and RPC remain separate responsibilities.
HTML keeps its existing operation slots, preparation and queue-inclusive timers.

The shared owner retains the exact child handle and its private scope, force
stop, stopped observation, scope finalization and only then the supplied lease
release. One detached retirement task per owned resource preserves that binding
after caller cancellation and owner Scope closure. The cleanup window produces
the requesting operation's safety error and quarantines the unresolved lease;
explicit reaping retains the prior retry behavior. No stock RPC/pool completion
or caller transaction is treated as exit acknowledgement.
The returned resource exposes only its bound retirement method; live references,
scope and retirement fibers remain private to the owner.

Start registers its resource before spawning and returns the resource alongside
the spawn Exit, including failures. The HTML caller retains that resource in a
masked transfer before inspecting the Exit. This preserves retirement authority
if spawning fails or the operation is interrupted at the handoff. Clock is
provided from the captured owner context during start and retirement.

The HTML/regex failure schemas now share the same closed reason schema. Their
wire tags, reason values, frame formats and error ownership remain unchanged.
The shared owner accepts trusted server process commands and runtime lease
effects; none of those capabilities is a raw-text request field.

Verification:

- Twenty-nine tests across shared ownership, HTML lifecycle/RPC/framing and regex
  requests pass, including the existing busy-WASM cancellation/deadline,
  quarantine, late acknowledgement and owner-closure controls.
- New direct regex-reservation controls prove concurrent retirement observers
  and reaping invoke release exactly once, failed spawns retain their registered
  resource/permit until retirement, and owner closure independently confirms PID
  exit before shared total/regex reservations return to zero.
- The selected actual HTML entrypoint smoke passes for parser failure and text,
  including injected shared native ownership. Full native corpora remain hosted.
- Server test compilation, scoped lint and package laws pass. New-only Fallow
  reports zero dead-code, complexity or clone findings.
- Receipts: `.beep/pr2511-native-owner-types.log`,
  `.beep/pr2511-native-owner-final-tests.log`,
  `.beep/pr2511-native-owner-smoke.log`,
  `.beep/pr2511-native-owner-final-fallow.json`.

The generic owner is now available for the actual regex supervisor. It does not
grant reviewed-pattern authority, execute regexes, approve families or complete
the shared typed regex transport. Those and exhaustive engine parity remain
required work. No source observation, safety threshold or semantic waiver changed.
