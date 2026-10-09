# Existing visible-app enrollment and reply proof

2026-10-09. Authorized after the managed native spike. This is a separate result:
**one controller-mediated idle exchange between an already-open Claude web
conversation and a managed Grok session passed**, including the return reply
and acknowledgement. The web conversation retained its identity and messages
through reload. No native Desktop attachment or autonomous reply tool is claimed.

## What ran

The root opened a disposable Claude web conversation in the authenticated browser.
The visible model button showed Opus 5.5 Medium before and after the exchange;
the tools mode showed Manual. No project, file or connector was added. The model
was instructed to use only synthetic text and no tools, files, browsing, memory
updates or delegation. No new permission prompt appeared. Those observations
are not an inspection of Claude's internal model ID or a CLI sandbox fingerprint.

1. App enrollment produced `APP_ENROLLED` before the managed peer sent anything.
   This makes the target an already-open owned app conversation, not a headless
   worker whose transcript was later displayed.
2. A live isolated Grok ACP session, `grok-4.7` medium, generated a structured
   request with a fresh nonce. The controller read its actual output and submitted
   it through the existing Claude conversation's visible composer.
3. Claude's assistant reply contained the exact nonce and `CLAUDE_ACK`. The root
   read the rendered assistant message body, normalized typographic quote marks
   into JSON punctuation and forwarded the same fields to the waiting Grok peer.
   No reply value or nonce was invented or altered. The accessibility heading
   omitted underscores, so it was not used as the payload source.
4. The same still-live Grok session returned `GROK_ACK_CLAUDE_REPLY`, naming the
   exact received reply. The root returned that actual acknowledgement to the
   same app conversation, which answered `APP_ROUNDTRIP_COMPLETE`.
5. Browser reload retained the same conversation URL and the request, reply,
   acknowledgement and completion marker. Final verification scoped extraction
   to the assistant messages, not a whole-page match that could count user text.

[Managed-peer receipt](app-peer/receipt.json),
[UI receipt](app-peer/ui-receipt.json), and
[peer reproduction](app-peer/README.md) preserve the evidence boundary. Exact
conversation URLs, runtime IDs and nonces remain private. Screenshots of the
baseline and completed app were captured in the tool evidence, not committed
into the public packet. The disposable app conversation remains available for
operator review. The Grok child and its isolated runtime were stopped.

## Busy input finding

A separate bounded app response was generating numbered synthetic lines. The
root entered a new nonce message while streaming was visible. The app displayed
an enabled Send message button, but the browser click timed out after three
seconds. The next observation showed the original response complete, the new
message still in the composer and no follow-up in the transcript. The root did
not retry blindly. It replaced the unsent draft with a closeout message, which
received `APP_PROBE_COMPLETE` while idle.

This is a failed busy-delivery attempt through this browser-control route. It
does not prove that Claude web lacks queueing or steering. No busy message was
forwarded to Grok; the only cross-provider exchange was the successful idle one.
The app made five bounded model turns in total: enrollment, peer reply,
acknowledgement completion, busy stream and closeout. No app latency benchmark
or statistical reliability claim is made.

## Native Desktop discovery

[Read-only Codex Desktop discovery](app-discovery/REPORT.md) found that the live
app uses bundled CLI `0.162.0-alpha.17.2` as its own stdio child. The normal shared
daemon control socket is absent. Therefore the earlier PATH CLI `0.162.0` queue
success does not establish a path into this live app.

Installed source has a process-only shared-daemon opt-in and a separate Electron
user-data-profile option. Eligibility, version and host override gates apply;
these are implementation findings, not a public stable API. A separate profile
plus owned daemon is a candidate future experiment, with auth and UI proof still
unresolved. No live app restart or configuration change was made. Native app
control APIs are unavailable in this tool session, so browser evidence is the
only directly verified visible-app surface here.

## Implementation consequence

Add a distinct **browser-mediated conversation bridge** capability to the design.
It can reach a first-party web conversation through its visible UI and return
its reply without operator copy/paste. Keep native runtime control preferred
when available: it offers richer steering, cancellation and typed permission
state. Browser capability must be scoped to the enrolled origin, conversation,
model label and observed UI version/state; never claim local filesystem policy
from a web mode label.

Before production use, the bridge needs durable send intents, strict identity
checks before every action, assistant-message-only extraction, bounded payload
parsing, timeout reconciliation and a no-blind-retry rule. An ambiguous click
cannot become accepted or trigger duplicate delivery. A response body must be
parsed as bounded data; tool instructions in peer text do not grant authority.
A richer source can provide stable message IDs, but this spike used visible UI
state only and did not inspect private web endpoints or credentials.

Existing-app coverage remains partial: Claude web idle passed via browser;
Claude native Desktop, Claude Code channels, Codex Desktop, ChatGPT web/Work,
Cursor IDE/cloud and Grok TUI/GUI remain unqualified. Full native permission
continuity, autonomous reply tools, busy delivery, persisted broker replay and
all-provider reliability are still required acceptance gates. Do not relabel
this one browser success as universal app attachment.
