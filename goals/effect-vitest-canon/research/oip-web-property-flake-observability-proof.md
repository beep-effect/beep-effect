# OIP web property, clock and diagnostic proof

The SEO helper now requires the LegalService node to exist before interpreting
its optional sameAs field. Original positive, negative-containment and length
assertions remain. Removing the node lets both original negative cases pass but
fails both strengthened cases. Absence of sameAs still resolves to an empty
list; the test does not require an empty property in the produced graph.

The accepted contact case retains its status assertion and inspects the captured
public fetch request body. It checks normalized email and name, unchanged message
content with the provider's existing Message prefix, and the actual batch-upsert
wire envelope. Injecting untrimmed name and uppercase email into the production
wire mapping passes the original oracle and fails the new one. The temporary
source mutation was restored exactly, and only synthetic provider spies ran.

The too-fast case constructs and consumes its payload under one TestClock,
retaining a 1,000 ms age and the production 3,000 ms threshold. It also proves
that the provider is not called. Advancing the controlled clock by 3,000 ms
between construction and submission fails the rejection assertion. Browser
polling, native timers and idle tasks are not frozen.

The 503 provider case captures the public structured Effect logger, checks the
operation, rejected outcome, provider reason and status, and rejects the fixture
personal fields and synthetic credential anywhere in the captured records.
Suppressing the log or injecting the synthetic credential makes the test fail.

Vitest worker env configuration declares all eleven HubSpot/Sanity keys empty
before application modules load. Per-test stubs were insufficient because the
Effect default provider snapshots its environment. The actual POST, Home and
llms entrypoints now retain their original assertions and additionally require
no provider fetch. Synthetic hostile configuration passes with the worker
boundary and fails both selected page/form cases when it is removed.

All private control mutations restore the original source bytes. Failed harness
and hoisting attempts remain diagnostic receipts and are not counted as proofs.
These tests establish jsdom, route and Effect behavior; they do not claim browser
visual or gesture acceptance.

The fixtures provide already-created ConfigProvider and Logger.CurrentLoggers
services directly. No layer acquisition or shared logger collector is needed.
The final service-form controls repeat all five clock, environment and logging
checks successfully. JSON serialization uses fromJsonString(Unknown), supported
by the installed Effect release; DOM hidden checks retain strict true/false
equality even when the DOM type also permits the until-found token.

Two detector exceptions remain intentional: the browser/FormData fixture default
samples the live clock for handlers that own their runtime, while all native
contact tests pass an explicit TestClock timestamp; vi is imported directly from
Vitest because its module-mock hoister rejects the Effect re-export. Test
registrations still use the instrumented runner.

Each native provider test supplies its scoped spy through FetchHttpClient.Fetch.
This prevents Effect's cached default reference from retaining a restored spy
from an earlier test; the full suite and repeated sensitivity controls cover
this ownership boundary.
