# Browser bridge integration discovery

2026-10-09. Read-only repository discovery; no browser/model/service actions.
**NOT FOUND:** a deployable repo-owned driver that enrolls and controls an
existing authenticated local browser conversation for peer request/reply.
This is a scoped source-discovery result, not proof that no external driver
could provide that capability.

## Reusable operational surfaces

| Source anchor | Existing behavior | Reuse boundary |
| --- | --- | --- |
| `packages/drivers/firecrawl/src/Firecrawl.service.ts:173` | Effect service includes browser creation, execution, listing and deletion | Operational SDK wrapper, not QA alone; candidate for a separately qualified Firecrawl-backed browser route |
| `packages/drivers/firecrawl/src/Firecrawl.service.ts:505` | `makeService` wraps `client.browser`, `browserExecute`, `deleteBrowser` and `listBrowsers` with decoded requests/results and typed failures | Reuse SDK/error/codec service patterns; does not enroll a local Chrome conversation |
| `packages/drivers/firecrawl/src/Firecrawl.models.ts:4040` | Browser execution payload has explicit session ID and SDK request | Browser service session ID is distinct from provider conversation identity |
| `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:328` and `:356` | Browser creation/list response shapes include CDP and live-view URLs | Endpoints describe Firecrawl browser sessions; no local authenticated-profile attach demonstrated |
| `packages/drivers/firecrawl/src/Firecrawl.config.ts:128` and `Firecrawl.service.ts:473` | Configurable service API URL and API-key resolution; service client construction | A deployment/authentication boundary remains. No new paid Firecrawl route is authorized or required by this spike |
| `packages/drivers/openclaw/src/OpenclawCli.service.ts:456` | Existing gateway CLI shape supports health, agent turns and Telegram message sending | Useful gateway lifecycle patterns, but no browser-control or web conversation enrollment API in this driver |

Firecrawl is a real operational browser-control surface in repository code.
It must not be described as an already-supported local app attachment route.
A configurable service URL does not establish that an approved local deployment
has equivalent browser capabilities or the user's existing authenticated profile.
No Firecrawl instance, endpoint, credential or subscription was inspected or used.

## QA and exercises

`packages/tooling/tool/cli/src/commands/Qa/Record.ts:286` runs a supplied
Playwright capture scenario with collector/video/session environment. Its QA
session ID identifies evidence capture, not an enrolled provider conversation.
It does not implement a persistent send/reply service.

`goals/lexical-playground-capability-atlas/ops/exercise/runner.ts:745` and
`collab-peers.ts:380` launch Chromium for browser exercises. Historical
`goals/desktop-chat-surface/history/e2e-2026-07-31/qa-capture.mjs` and other
capture scripts also launch isolated QA browsers. These are possible examples
for test infrastructure; they are not existing operational conversation drivers.
`packages/tooling/tool/cli/src/commands/Research/internal/BrowserHistory.ts`
reads browser history and is not a browser action or attachment interface.

## In-session tool versus deployable driver

The successful app proof used the agent runtime's `mcp__cua_repl` browser tools.
Those tools are callable in the current controller session; no corresponding
repository runtime client, local browser-control gateway, persistent enrollment
service or supported unattended attachment boundary was found. Having an
agent tool capable of a visible UI action does not establish that a Beep daemon
can call it after that session ends.

A proposed local bridge therefore still needs a supported control transport,
explicit owner/origin/conversation binding, lifecycle and removal, model/mode
observations, durable send intent and attempt receipts, assistant-only reply
extraction, and timeout reconciliation. Prefer a local enrolled adapter that
preserves the existing authenticated browser under an owned boundary. Do not
assume hosted Firecrawl or credential/profile copying to fill that gap.

## Search evidence and scope

Discovery used Graft before source reads:

- `graft ask "browser control gateway session enrollment reusable runtime driver conversation bridge" --source -n 8`
- `graft grep "playwright|BrowserSession|browserGateway|cua|chrome-devtools" --in packages -i`
- `graft grep "browser|Browser" --in packages/drivers/firecrawl`
- `graft grep "connectOverCDP|launchPersistentContext|enroll|browser-use|BrowserControl|BrowserGateway|mcp__cua|cua\\." -i`
- `graft grep "chromium|cdpUrl|BrowserType|browserExecute" -i`
- `graft grep "browser|gateway|session" --in packages/drivers/openclaw -i`

The full-tree Graft queries searched 5,807 indexed files. A follow-up targeted
source search over `packages`, `scripts` and `apps` for local attach/CUA/gateway
symbols found no matches. File-name inventory and exact source spans identified
the surfaces above. The Firecrawl service, QA record command and Openclaw CLI
service were byte-identical between the discovery checkout and packet lane.
No new dependencies, configuration or production source were changed.

Graft printed savings for six calls: 47,882 + 193,128 + 49,616 + 56,351 +
151,484 + 63,237 = **561,698 estimated tokens saved**, with printed value
$0.07 + $0.28 + $0.07 + $0.08 + $0.22 + $0.09 = **$0.81**. These are
Graft retrieval estimates, not measured token consumption or billing.
