# Lane: agent-interop-protocols

## Inventory table

| skill | one-line what-it-is | maturity (prototype/solid/polished) | steal-score 0-5 |
|---|---|---:|---:|
| `a2a-client` | Executable Python client for Agent Card discovery, OAuth, A2A JSON-RPC task send/get, SSE subscription, and file parts. | solid | 5 |
| `acp-client` | Curl recipe book for OpenLink Adaptive Commerce Platform checkout/cart/order flows; despite the acronym, it is not Agent Client Protocol. | prototype | 2 |
| `fediverse-crud` | ActivityPub discovery/auth/payload workflow with JSON-LD templates, a localhost test harness, and unusually candid QA traces. | prototype | 4 |
| `osdi-inclusion-engine` | Operational deployment skill for RDF-configured WebDAV/XSLT sites, centered on a blocking double-chrome gate and rollback. | polished | 4 |
| `opml-rss-reader` | Prompt-routed OPML/RSS/Atom discovery and Virtuoso SPASQL query templates, without an executable client or validator. | prototype | 2 |
| `rss-feed-generator` | Prose extraction rules, RSS/Atom skeletons, wrapper HTML, and a manual validation checklist for synthetic feeds. | prototype | 3 |

## Per-skill notes

### a2a-client

- What it actually does
  - Normalizes a supplied base URL, full A2A URL, or Agent Card URL; derives `/.well-known/agent.json`; and prefers the card's `url` over the conventional `/chat/api/a2a` path (`ai-agent-skills/a2a-client/scripts/a2a_client.py`).
  - Fetches the Agent Card before every `send`, `subscribe`, or `get`; the prose requires inspection of provider, authentication, capabilities, modalities, and skills (`ai-agent-skills/a2a-client/SKILL.md`, `ai-agent-skills/a2a-client/references/opal-a2a.md`).
  - Implements bearer lookup precedence, OIDC discovery, dynamic client registration, Authorization Code callback capture, client-credentials exchange, optional token export, and Authorization header injection (`ai-agent-skills/a2a-client/scripts/a2a_client.py`).
  - Emits JSON-RPC 2.0 requests for `tasks/send`, `tasks/sendSubscribe`, and `tasks/get`; message parts support text plus base64 file attachments, with optional `contextId` and `sessionId` continuity (`ai-agent-skills/a2a-client/scripts/a2a_client.py`).
  - Streams `tasks/sendSubscribe` through a line-oriented SSE reader and otherwise prints JSON or recursively extracted text (`ai-agent-skills/a2a-client/scripts/a2a_client.py`).
- Notable files worth a human read
  - `ai-agent-skills/a2a-client/scripts/a2a_client.py` — the lane's only substantial general agent-protocol client.
  - `ai-agent-skills/a2a-client/references/opal-a2a.md` — concise handshake, Agent Card, task, and session contract.
  - `ai-agent-skills/a2a-client/SKILL.md` — good elicitation and endpoint-selection policy.
  - `ai-agent-skills/a2a-client/agents/openai.yaml` — minimal skill presentation metadata.
- Standout mechanisms
  - Endpoint elicitation is a real gate: CLI/config values outrank environment values, recommended hosts are a menu rather than silent failover, and the selected issuer must match the selected resource server (`ai-agent-skills/a2a-client/SKILL.md`, `ai-agent-skills/a2a-client/references/opal-a2a.md`).
  - Discovery drives invocation: the card's canonical `url`, advertised auth details, streaming flag, and skills are inspected before choosing a method (`ai-agent-skills/a2a-client/SKILL.md`).
  - Transport preserves protocol correlation and continuity identifiers: generated JSON-RPC request `id`, returned task `id`, `contextId`, `sessionId`, and final state (`ai-agent-skills/a2a-client/references/opal-a2a.md`).
  - Return parsing explicitly tolerates protocol drift between text parts labeled with `type` and `kind` (`ai-agent-skills/a2a-client/references/opal-a2a.md`).
  - The client is dependency-free and its CLI surface is locally runnable; `--help` parsed successfully in this mining pass (`ai-agent-skills/a2a-client/scripts/a2a_client.py`).
- Weaknesses / smells
  - Runtime JSON is typed only as `dict[str, Any]`; Agent Cards, OAuth metadata, JSON-RPC errors, task states, parts, artifacts, and SSE events are never validated (`ai-agent-skills/a2a-client/scripts/a2a_client.py`).
  - Authorization Code lacks PKCE and does not generate or verify OAuth `state`, leaving the localhost callback without CSRF/code-injection binding (`ai-agent-skills/a2a-client/scripts/a2a_client.py`).
  - `--save-token-env` without `--save-token-env-file` prints the complete bearer export to stderr, contradicting the skill's “never log tokens” rule (`ai-agent-skills/a2a-client/SKILL.md`, `ai-agent-skills/a2a-client/scripts/a2a_client.py`).
  - A card-supplied `url` is trusted without same-origin or explicit cross-origin approval; discovery can redirect authenticated task traffic away from the elicited origin (`ai-agent-skills/a2a-client/scripts/a2a_client.py`).
  - SSE handling strips `data:` line prefixes but does not implement event framing, multiline `data`, event IDs, retry, terminal-state detection, or JSON decoding (`ai-agent-skills/a2a-client/scripts/a2a_client.py`).
  - Recursive `extract_text` returns every nested `text` string, not just protocol-defined answer locations, while the reference names precise locations (`ai-agent-skills/a2a-client/scripts/a2a_client.py`, `ai-agent-skills/a2a-client/references/opal-a2a.md`).
  - No tests, fixtures, contract snapshots, cancellation, push-notification, or resubscription implementation exists; four methods are explicitly TBD (`ai-agent-skills/a2a-client/references/opal-a2a.md`).

### acp-client

- What it actually does
  - Maps purchase language to REST mutations over `/checkout_sessions`, `/carts`, and `/orders`, with bearer auth, `API-Version`, `Request-Id`, and mutation idempotency headers (`ai-agent-skills/acp-client/SKILL.md`, `ai-agent-skills/acp-client/references/acp-api-operations.md`).
  - Resolves product names against a manually curated offer-IRI catalog, creates a checkout, extracts a minor-unit total, creates a Stripe test Shared Payment Token, completes or cancels checkout, and detects a subscription-payment link (`ai-agent-skills/acp-client/references/product-catalog.md`, `ai-agent-skills/acp-client/examples/checkout-flow.sh`).
  - Includes an account-balance payment alternative and a post-purchase `On-Behalf-Of` resource-access probe (`ai-agent-skills/acp-client/SKILL.md`, `ai-agent-skills/acp-client/references/acp-api-operations.md`).
  - Auth is not a protocol handshake: the user manually visits an OAuth applications page, copies a bearer token, and exports it (`ai-agent-skills/acp-client/references/oauth-token-setup.md`).
- Notable files worth a human read
  - `ai-agent-skills/acp-client/references/acp-api-operations.md` — endpoint recipes and request shapes.
  - `ai-agent-skills/acp-client/examples/checkout-flow.sh` — executable happy-path state transition.
  - `ai-agent-skills/acp-client/examples/cart-flow.sh` — cart lifecycle variant.
  - `ai-agent-skills/acp-client/references/product-catalog.md` — useful example of human-label-to-stable-IRI resolution and versioned-offer failure notes.
- Standout mechanisms
  - Mutation recipes consistently add idempotency keys, while `Request-Id` provides trace correlation across a purchase flow (`ai-agent-skills/acp-client/references/acp-api-operations.md`).
  - Payment capability is a tagged choice: `handler_id: card_tokenized` with an SPT credential versus `handler_id: balance` with a balance instrument (`ai-agent-skills/acp-client/references/acp-api-operations.md`).
  - The catalog records a concrete semantic/version trap: similarly named `2024-02` offers can price at zero while validated `2024-01` IRIs carry configured prices (`ai-agent-skills/acp-client/references/product-catalog.md`, `ai-agent-skills/acp-client/CHANGELOG.md`).
  - The post-purchase delegation check treats a bare WebID in `On-Behalf-Of` as a contract detail and maps 200/401/403/404 to distinct provisioning outcomes (`ai-agent-skills/acp-client/SKILL.md`).
- Weaknesses / smells
  - This ACP means **Adaptive Commerce Platform**, not Agent Client Protocol; it contributes commerce state-machine ideas but no agent handshake, capability negotiation, session, or message protocol (`ai-agent-skills/acp-client/SKILL.md`).
  - High-impact purchase operations are mapped directly from intent without a mandatory final confirmation gate covering item, quantity, currency, total, payment handler, and target instance (`ai-agent-skills/acp-client/SKILL.md`).
  - `curl -sS` does not fail on HTTP 4xx/5xx, responses are not schema-checked, and fragile `awk` fallbacks can misread nested or escaped JSON (`ai-agent-skills/acp-client/references/acp-api-operations.md`, `ai-agent-skills/acp-client/examples/checkout-flow.sh`).
  - The checkout example logs the full SPT identifier; error guidance asks for raw Stripe responses, both risky for payment credentials (`ai-agent-skills/acp-client/examples/checkout-flow.sh`, `ai-agent-skills/acp-client/SKILL.md`).
  - Production shop is the API default while the token guide calls QA the default; accidental environment mismatch is easy (`ai-agent-skills/acp-client/SKILL.md`, `ai-agent-skills/acp-client/references/oauth-token-setup.md`).
  - Version metadata says `1.1.0`, but the changelog stops at `1.0.2`; the shell recipes also contain inconsistent `tr '[:lower]'` spellings in idempotency-key generation (`ai-agent-skills/acp-client/SKILL.md`, `ai-agent-skills/acp-client/CHANGELOG.md`, `ai-agent-skills/acp-client/references/acp-api-operations.md`).
  - No dry-run, replay journal, compensation policy, order-state validator, or automated test suite protects irreversible mutations (`ai-agent-skills/acp-client/examples/checkout-flow.sh`, `ai-agent-skills/acp-client/examples/cart-flow.sh`).

### fediverse-crud

- What it actually does
  - Defines the handshake chain `host-meta.json` LRDD discovery → WebFinger JRD → ActivityPub Actor document → endpoints/OIDC metadata → dynamic client registration → Authorization Code token → actor outbox POST (`ai-agent-skills/fediverse-crud/SKILL.md`, `ai-agent-skills/fediverse-crud/references/activitypub-operations.md`).
  - Supplies JSON-LD skeletons for Note, Like, Announce, Follow, Delete, and Undo; callers substitute actor, object, audience, content, and timestamps, then POST to the discovered outbox (`ai-agent-skills/fediverse-crud/assets/templates/`).
  - Reads inbox/outbox collections using ActivityPub content negotiation and follows `first`/`next` OrderedCollection pagination (`ai-agent-skills/fediverse-crud/references/activitypub-operations.md`).
  - Treats the `Location` response header as the canonical created-resource identifier and separately describes target-inbox verification for delivery (`ai-agent-skills/fediverse-crud/SKILL.md`).
  - Carries a substantial set of localhost evidence reports showing discovery, OAuth, DAV ACL failures, successful writes, status-code anomalies, and state reconciliation (`ai-agent-skills/fediverse-crud/references/localhost-*.md`).
- Notable files worth a human read
  - `ai-agent-skills/fediverse-crud/references/activitypub-operations.md` — compact ActivityPub mechanics.
  - `ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh` — ambitious but flawed executable harness.
  - `ai-agent-skills/fediverse-crud/references/localhost-activitypub-note-post-success.md` — strongest proof that endpoint discovery beats guessed paths.
  - `ai-agent-skills/fediverse-crud/references/localhost-ap-follow-kidehen-demo.md` — follow plus following/followers reconciliation.
  - `ai-agent-skills/fediverse-crud/references/localhost-ap-qa-report-2026-07-10.md` — persisted Like despite erroneous HTTP 405.
  - `ai-agent-skills/fediverse-crud/references/localhost-ap-three-actor-state.md` — evidence that actor ACL capability can regress across sessions.
- Standout mechanisms
  - Discovery is layered rather than guessed: the success report explicitly attributes earlier failures to inventing an outbox path instead of reading it from the Actor document (`ai-agent-skills/fediverse-crud/references/localhost-activitypub-note-post-success.md`).
  - The protocol separates acceptance, persistence, and semantic effect: Undo received 201 but did not reverse Follow state, and Like was persisted even when the handler returned 405 (`ai-agent-skills/fediverse-crud/references/localhost-ap-crud-qa.md`, `ai-agent-skills/fediverse-crud/references/localhost-ap-qa-report-2026-07-10.md`).
  - Delivery proof is state-based: inspect the sender outbox and sender/recipient following/followers collections, not merely the POST status (`ai-agent-skills/fediverse-crud/references/localhost-ap-follow-kidehen-demo.md`).
  - QA distinguishes authentication from authorization: valid WebID-bound tokens still fail at the DAV ACL layer, and actor-specific write capability can disappear later (`ai-agent-skills/fediverse-crud/references/localhost-ap-kidehen-403.md`, `ai-agent-skills/fediverse-crud/references/localhost-ap-three-actor-state.md`).
  - The only assigned cross-reference to the previously mined memory skill delegates OAuth mechanics to `agent-rdf-memory/howto/uriburner-oauth-authcode-flow.ttl`; this lane did not re-mine that directory (`ai-agent-skills/fediverse-crud/SKILL.md`, `ai-agent-skills/fediverse-crud/references/activitypub-operations.md`).
- Weaknesses / smells
  - The harness uses `curl -k` throughout, disabling TLS verification even outside an explicitly local/self-signed mode (`ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh`).
  - It generates OAuth `state` but the callback never checks it; it also ignores the discovered token endpoint and hardcodes `${ISSUER}/OAuth2/token` (`ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh`).
  - Tokens, client secrets, and refresh tokens are written to a fixed `/tmp/fediverse_test_token.sh`, permissions are not restricted, the file is not cleaned up, and an old file can survive a failed run; the script also prints a token prefix (`ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh`).
  - Several historical QA documents embed token-looking values in prose, making the repository itself a secret-hygiene cautionary example (`ai-agent-skills/fediverse-crud/references/localhost-oauth-curl-trace.md`, `ai-agent-skills/fediverse-crud/references/localhost-oauth-curl-trace-demo.md`, `ai-agent-skills/fediverse-crud/references/localhost-webacl-qa-report-2026-07-10.md`).
  - `resolve_actor` writes progress text and the actor URI to stdout, but callers capture all stdout into `ACTOR_URI`; the resulting multiline value can corrupt subsequent fetches (`ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh`).
  - `sed` substitution does not JSON-escape note content or IRIs; quotes, backslashes, newlines, `&`, or the delimiter can corrupt payloads or alter replacements (`ai-agent-skills/fediverse-crud/SKILL.md`, `ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh`).
  - `ap_post` ignores HTTP status and declares PASS when any `Location` header exists; it does not parse the created Activity or verify actor/object invariants (`ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh`).
  - The advertised “Remote Delivery Check” only prints instructions to rerun with the second token; it does not perform the target-inbox check required by the skill (`ai-agent-skills/fediverse-crud/SKILL.md`, `ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh`).
  - The fixed templates model only narrow server examples; real JSON-LD context, actor/object embedding, audience cardinality, and Undo representations need tolerant decoders and canonical encoders (`ai-agent-skills/fediverse-crud/assets/templates/`, `ai-agent-skills/fediverse-crud/references/localhost-ap-crud-qa.md`).

### osdi-inclusion-engine

- What it actually does
  - Models a Virtuoso request path from vhost through `index.vsp`, WebDAV content lookup, Tidy normalization, RDF data-island merge, XSLT skin, cache, rewrite, and response (`ai-agent-skills/osdi-inclusion-engine/references/engine-architecture.md`).
  - Reads and mutates site/global/per-URL configuration through an RDF graph-backed SQL API, with resolution precedence URL → site → global (`ai-agent-skills/osdi-inclusion-engine/references/config-api.md`).
  - Blocks deployment until the live skin is resolved and replacement HTML is classified for self-contained chrome; then elicits passthrough versus chrome stripping (`ai-agent-skills/osdi-inclusion-engine/SKILL.md`).
  - Prescribes backup, scoped override, WebDAV PUT, cache/XSLT invalidation, live-page verification, other-page scope verification, and rollback (`ai-agent-skills/osdi-inclusion-engine/references/homepage-replacement-playbook.md`).
- Notable files worth a human read
  - `ai-agent-skills/osdi-inclusion-engine/SKILL.md` — exemplary operational gate and elicitation list.
  - `ai-agent-skills/osdi-inclusion-engine/references/config-api.md` — small, explicit configuration contract.
  - `ai-agent-skills/osdi-inclusion-engine/references/engine-architecture.md` — request lifecycle and cache semantics.
  - `ai-agent-skills/osdi-inclusion-engine/scripts/check_chrome_conflict.py` — machine-readable exit-code gate.
  - `ai-agent-skills/osdi-inclusion-engine/templates/skin-override.sql` — scoped mutation plus verification/rollback skeleton.
- Standout mechanisms
  - “Read live state before mutation” is enforced for both `webdav_base` and the effective skin, preventing documentation examples from becoming deployment defaults (`ai-agent-skills/osdi-inclusion-engine/SKILL.md`, `ai-agent-skills/osdi-inclusion-engine/references/config-api.md`).
  - The classifier uses exit code 2 as a blocking semantic finding, distinct from parse/fetch failure 1 and safe 0 (`ai-agent-skills/osdi-inclusion-engine/scripts/check_chrome_conflict.py`).
  - Cache invalidation is typed by cause: content mtime self-invalidates, config requires `config_flush_cache()`, and XSLT edits require `staleall()` (`ai-agent-skills/osdi-inclusion-engine/references/engine-architecture.md`).
  - Verification includes a negative-control page to prove a homepage override did not leak to the rest of the site (`ai-agent-skills/osdi-inclusion-engine/SKILL.md`, `ai-agent-skills/osdi-inclusion-engine/references/homepage-replacement-playbook.md`).
- Weaknesses / smells
  - The classifier is regex-based, recognizes only double-quoted classes/assets, treats any semantic `<header>/<nav>/<footer>` as site chrome, and cannot reason about DOM nesting or generated markup (`ai-agent-skills/osdi-inclusion-engine/scripts/check_chrome_conflict.py`).
  - It lists external assets but does not resolve or fetch them, although the workflow language says they “must resolve” (`ai-agent-skills/osdi-inclusion-engine/scripts/check_chrome_conflict.py`, `ai-agent-skills/osdi-inclusion-engine/SKILL.md`).
  - The script always recommends passthrough on conflict even though the skill recommends chrome stripping for the principal scenario; machine output and prose policy have drifted (`ai-agent-skills/osdi-inclusion-engine/scripts/check_chrome_conflict.py`, `ai-agent-skills/osdi-inclusion-engine/references/homepage-replacement-playbook.md`).
  - SQL placeholders have no escaping, transaction, expected-old-value precondition, or generated rollback artifact (`ai-agent-skills/osdi-inclusion-engine/templates/skin-override.sql`).
  - This is operational site deployment rather than agent/syndication interop; its value to this lane is the gate/rollback contract, not its protocol domain (`ai-agent-skills/osdi-inclusion-engine/SKILL.md`).

### opml-rss-reader

- What it actually does
  - Classifies a URL as page versus feed, then discovers syndication through response `Content-Type`, HTML alternate links, HTTP `Link`, and common-path probes (`ai-agent-skills/opml-rss-reader/SKILL.md`, `ai-agent-skills/opml-rss-reader/references/query-templates.md`).
  - Enforces an AD2 checkpoint: discover and report feeds first, choose when multiple, then run cached or forced-refresh SPASQL (`ai-agent-skills/opml-rss-reader/SKILL.md`).
  - Routes execution across direct fetch, URIBurner REST, terminal OAuth, MCP, `chatPromptComplete`, and OPAL, with explicit user protocol preference taking precedence (`ai-agent-skills/opml-rss-reader/references/protocol-routing.md`).
  - Provides four Virtuoso-specific queries for cached/live OPML and cached/live RSS/Atom graphs (`ai-agent-skills/opml-rss-reader/references/query-templates.md`).
- Notable files worth a human read
  - `ai-agent-skills/opml-rss-reader/references/query-templates.md` — discovery and query shapes.
  - `ai-agent-skills/opml-rss-reader/SKILL.md` — two-step elicitation/checkpoint contract.
  - `ai-agent-skills/opml-rss-reader/references/protocol-routing.md` — representative transport fallback prose.
- Standout mechanisms
  - Discovery returns a cardinality-sensitive decision: zero feeds is a typed absence, one can continue, and many requires selection (`ai-agent-skills/opml-rss-reader/SKILL.md`).
  - Cached versus live ingestion is explicit in the query contract via `get:soft` and `get:refresh`, useful for provenance/freshness modeling (`ai-agent-skills/opml-rss-reader/references/query-templates.md`).
  - OPML is treated as a feed-of-feeds: ingest the OPML graph, follow `sioc:link`, then query each feed graph (`ai-agent-skills/opml-rss-reader/references/query-templates.md`).
- Weaknesses / smells
  - No executable discovery parser, XML parser, SPARQL client, tests, or output validator exists; all mechanics rely on agent interpretation (`ai-agent-skills/opml-rss-reader/`).
  - `{url}` is inserted directly into SPARQL IRIs and pragmas without parsing or escaping, creating query-injection and malformed-IRI risk (`ai-agent-skills/opml-rss-reader/references/query-templates.md`).
  - The HTML discovery `grep` command contains a single quote inside a single-quoted shell expression and is not a valid robust parser; relative URL resolution is described but not implemented (`ai-agent-skills/opml-rss-reader/references/query-templates.md`).
  - Defaults promise 20 results, but P3/P4 omit `LIMIT 20`; missing dates sort unpredictably (`ai-agent-skills/opml-rss-reader/SKILL.md`, `ai-agent-skills/opml-rss-reader/references/query-templates.md`).
  - One-feed behavior says both “proceed automatically” and “confirm with the user,” weakening the checkpoint contract (`ai-agent-skills/opml-rss-reader/SKILL.md`, `ai-agent-skills/opml-rss-reader/references/query-templates.md`).
  - Treating 500 as an authentication signal and claiming MCP OAuth also covers REST are deployment assumptions, not validated protocol negotiation (`ai-agent-skills/opml-rss-reader/references/protocol-routing.md`).

### rss-feed-generator

- What it actually does
  - Runs a feed-exists check, identifies repeated post blocks, applies title/link/date/summary/author cascades, normalizes links, and renders RSS 2.0 or Atom 1.0 skeletons (`ai-agent-skills/rss-feed-generator/SKILL.md`, `ai-agent-skills/rss-feed-generator/references/extraction-rules.md`).
  - Defines a Harness Mode contract with discovery, extraction, generation, wrapper, validation, and provenance phases (`ai-agent-skills/rss-feed-generator/SKILL.md`).
  - Supplies synthetic-feed XML skeletons, a human landing page with `<link rel="alternate">`, and a manual checklist (`ai-agent-skills/rss-feed-generator/references/feed-templates.md`, `ai-agent-skills/rss-feed-generator/references/html-wrapper-template.md`, `ai-agent-skills/rss-feed-generator/references/validation-checklist.md`).
  - Contains no generator implementation; the worked example uses explicitly illustrative HTML and then self-reports PASS (`ai-agent-skills/rss-feed-generator/examples/vivianvoss-net.md`).
- Notable files worth a human read
  - `ai-agent-skills/rss-feed-generator/references/extraction-rules.md` — prioritized extraction cascade.
  - `ai-agent-skills/rss-feed-generator/references/feed-templates.md` — useful starting contract, not safe final serialization code.
  - `ai-agent-skills/rss-feed-generator/references/validation-checklist.md` — candidate invariants for automation.
  - `ai-agent-skills/rss-feed-generator/references/html-wrapper-template.md` — inbound feed-discovery mechanic.
- Standout mechanisms
  - Candidate blocks need at least two repeats, which turns vague “looks like posts” reasoning into a minimal structural gate (`ai-agent-skills/rss-feed-generator/references/extraction-rules.md`).
  - Link identity is deliberately stable: absolute canonical URL becomes RSS GUID or Atom ID, and deduplication keys on it (`ai-agent-skills/rss-feed-generator/SKILL.md`, `ai-agent-skills/rss-feed-generator/references/validation-checklist.md`).
  - Estimated dates are required to carry an explicit marker, an embryonic field-level provenance mechanism (`ai-agent-skills/rss-feed-generator/references/extraction-rules.md`, `ai-agent-skills/rss-feed-generator/references/validation-checklist.md`).
  - The wrapper closes the syndication loop by advertising the generated feed to feed readers through HTML discovery metadata (`ai-agent-skills/rss-feed-generator/references/html-wrapper-template.md`).
- Weaknesses / smells
  - Validation is a “mental well-formedness check,” not XML parsing, XSD/Schematron, a feed-validator invocation, or property tests (`ai-agent-skills/rss-feed-generator/references/validation-checklist.md`).
  - Raw template substitution is unsafe for XML and CDATA (`]]>` is unhandled); optional author/full-content placeholders remain in skeletons unless an agent remembers to remove them (`ai-agent-skills/rss-feed-generator/references/feed-templates.md`).
  - The Atom template can omit author at both feed and entry levels, violating the intended Atom contract for feeds whose entries also lack authors (`ai-agent-skills/rss-feed-generator/references/feed-templates.md`, `ai-agent-skills/rss-feed-generator/references/extraction-rules.md`).
  - Replacing unknown publication time with scrape time corrupts chronology and can make every refresh appear to republish items; comments are too weak for downstream consumers (`ai-agent-skills/rss-feed-generator/SKILL.md`, `ai-agent-skills/rss-feed-generator/references/extraction-rules.md`).
  - The wrapper is hardcoded to RSS labels/MIME even when Atom is requested, and unescaped scraped text/URLs can become HTML injection (`ai-agent-skills/rss-feed-generator/references/html-wrapper-template.md`).
  - Discovery mechanics drift: Harness Mode requires HTML, HTTP Link, and common paths, while Order of Operations names only HTML links (`ai-agent-skills/rss-feed-generator/SKILL.md`).
  - Runtime-specific `/mnt/user-data/outputs` and `present_files` instructions are not portable skill contracts (`ai-agent-skills/rss-feed-generator/SKILL.md`).

## Cross-cutting patterns in this lane

- **Discovery before invocation** is the recurring good idea: Agent Card before A2A tasks, host-meta/WebFinger/Actor before ActivityPub writes, alternate links before feed synthesis, and live config before OSDI mutation (`ai-agent-skills/a2a-client/SKILL.md`, `ai-agent-skills/fediverse-crud/SKILL.md`, `ai-agent-skills/rss-feed-generator/SKILL.md`, `ai-agent-skills/osdi-inclusion-engine/SKILL.md`).
- **Endpoint provenance is part of correctness**: guessed ActivityPub paths failed, card URLs can override conventional A2A paths, and OSDI examples must not substitute for live graph values (`ai-agent-skills/fediverse-crud/references/localhost-activitypub-note-post-success.md`, `ai-agent-skills/a2a-client/scripts/a2a_client.py`, `ai-agent-skills/osdi-inclusion-engine/references/config-api.md`).
- **Acceptance is not semantic success**: A2A needs terminal task state/artifacts, ActivityPub needs collection reconciliation, commerce needs order/access state, and deployment needs rendered-page verification (`ai-agent-skills/a2a-client/references/opal-a2a.md`, `ai-agent-skills/fediverse-crud/references/localhost-ap-crud-qa.md`, `ai-agent-skills/acp-client/SKILL.md`, `ai-agent-skills/osdi-inclusion-engine/SKILL.md`).
- **Auth discovery is repeatedly under-modeled**: several skills describe OIDC metadata and dynamic registration, but only A2A and Fediverse ship code, both omit PKCE/state verification, and Fediverse delegates part of the policy to the skipped memory skill (`ai-agent-skills/a2a-client/scripts/a2a_client.py`, `ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh`, `ai-agent-skills/fediverse-crud/SKILL.md`).
- **Raw string templating is the common failure mode** across JSON-LD, SPARQL, XML, HTML, shell, and SQL (`ai-agent-skills/fediverse-crud/assets/templates/`, `ai-agent-skills/opml-rss-reader/references/query-templates.md`, `ai-agent-skills/rss-feed-generator/references/feed-templates.md`, `ai-agent-skills/osdi-inclusion-engine/templates/skin-override.sql`).
- **Manual checklists are valuable specifications but weak gates** until compiled into parsers and executable assertions (`ai-agent-skills/rss-feed-generator/references/validation-checklist.md`, `ai-agent-skills/osdi-inclusion-engine/scripts/check_chrome_conflict.py`).
- **Protocol routing lists are not negotiation**: naming curl/REST/MCP/SSE/OPAL fallbacks does not inspect capabilities, version compatibility, authentication schemes, or error contracts (`ai-agent-skills/opml-rss-reader/references/protocol-routing.md`, `ai-agent-skills/rss-feed-generator/references/protocol-routing.md`).

## Steal-worthy for beep-effect (ranked, concrete — name the mechanism and the port)

1. **Schema-first discovery-to-invocation state machine.** Port A2A's `target → card → auth → task → terminal result` and ActivityPub's `host-meta → JRD → Actor → OAuth → outbox → reconciliation` as Effect workflows whose constructors make undiscovered/unauthenticated states uncallable (`ai-agent-skills/a2a-client/SKILL.md`, `ai-agent-skills/fediverse-crud/SKILL.md`).
   - Define branded `HttpsUrl`, `AbsoluteIri`, `AgentCardUrl`, `ActorIri`, `TaskId`, `ContextId`, and `SessionId` Schemas; decode at every network boundary rather than carrying strings (`ai-agent-skills/a2a-client/scripts/a2a_client.py`, `ai-agent-skills/fediverse-crud/references/activitypub-operations.md`).
   - Model phases as tagged domain values such as `TargetSelected`, `Discovered`, `Authorized`, `Submitted`, `Observed`, and `Reconciled`; expose transition functions through `Context.Service` dependencies (`ai-agent-skills/a2a-client/SKILL.md`, `ai-agent-skills/fediverse-crud/references/localhost-ap-follow-kidehen-demo.md`).
2. **Typed A2A contract package.** Replace `dict[str, Any]` with Effect Schemas for `AgentCard`, `Authentication`, `Capability`, `Skill`, JSON-RPC request/result/error, task status, artifact, and parts (`ai-agent-skills/a2a-client/references/opal-a2a.md`).
   - Encode request methods as a discriminated union keyed by `method`: `tasks/send`, `tasks/sendSubscribe`, and `tasks/get`, each paired with its own params schema (`ai-agent-skills/a2a-client/scripts/a2a_client.py`).
   - Decode both `{type:"text"}` and `{kind:"text"}` into one canonical `TextPart`; preserve unknown extensions in an explicit extension map instead of permissive `Any` (`ai-agent-skills/a2a-client/references/opal-a2a.md`).
   - Implement SSE with an event parser, JSON Schema decode per event, stream interruption errors, resumable event IDs, and terminal-state folding (`ai-agent-skills/a2a-client/scripts/a2a_client.py`).
3. **ActivityPub contract codecs plus semantic reconciliation.** Define a tagged `Activity` union for Note/Like/Announce/Follow/Delete/Undo and separate permissive inbound codecs from canonical outbound encoders (`ai-agent-skills/fediverse-crud/assets/templates/`, `ai-agent-skills/fediverse-crud/references/activitypub-operations.md`).
   - Add Schemas for host-meta LRDD, JRD links, Actor endpoints, OIDC metadata, ActivityStreams Collection/Page, and `Location` headers (`ai-agent-skills/fediverse-crud/SKILL.md`).
   - Make the result algebra distinguish `Accepted`, `Persisted`, `Delivered`, and `SemanticallyApplied`; the archived 201-without-Undo and 405-with-persistence cases are perfect fixtures (`ai-agent-skills/fediverse-crud/references/localhost-ap-crud-qa.md`, `ai-agent-skills/fediverse-crud/references/localhost-ap-qa-report-2026-07-10.md`).
4. **Shared OAuth service with protected secrets.** Extract A2A/Fediverse commonality into `OAuthDiscovery`, `DynamicRegistration`, `AuthorizationSession`, and `TokenExchange` Schemas plus `OAuthClient` and `SecretStore` services (`ai-agent-skills/a2a-client/scripts/a2a_client.py`, `ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh`).
   - Require PKCE, state/nonce binding, callback-path validation, discovered-endpoint pinning, issuer/audience checks, redacted token values, 0600-or-secret-manager persistence, and cleanup (`ai-agent-skills/a2a-client/SKILL.md`, `ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh`).
   - Keep the existing `agent-rdf-memory` OAuth how-to only as a documented cross-reference; executable policy should live in one tested service (`ai-agent-skills/fediverse-crud/SKILL.md`).
5. **Evidence ladder for protocol operations.** Generalize the Fediverse QA lesson into a reusable proof type: HTTP response → canonical resource identifier → decoded persisted representation → downstream state reconciliation (`ai-agent-skills/fediverse-crud/references/localhost-ap-follow-kidehen-demo.md`, `ai-agent-skills/fediverse-crud/references/localhost-ap-qa-report-2026-07-10.md`).
   - Store request ID, endpoint chosen from discovery, status, Location/task ID, response hash, observed state, and timestamps as provenance records suitable for PROV-O projection (`ai-agent-skills/a2a-client/references/opal-a2a.md`, `ai-agent-skills/fediverse-crud/SKILL.md`).
6. **Gate algebra with rollback and negative controls.** Port OSDI's blocking chrome check, explicit remediation choice, backup, scoped mutation, invalidation, target verification, control-page verification, and rollback into a generic Effect `ChangePlan` (`ai-agent-skills/osdi-inclusion-engine/SKILL.md`).
   - Schema fields should include `preconditions`, `blockingFindings`, `userDecision`, `expectedOldState`, `mutations`, `rollback`, `proofs`, and `terminalStatus`; execution fails while a blocking finding is unresolved (`ai-agent-skills/osdi-inclusion-engine/references/homepage-replacement-playbook.md`).
7. **Typed syndication ingress/egress.** Turn the feed-reader cardinality checkpoint and generator invariants into `DiscoveredFeed`, `DiscoveryResult = None | One | Many`, `FeedItem`, `RssFeed`, and `AtomFeed` Schemas (`ai-agent-skills/opml-rss-reader/SKILL.md`, `ai-agent-skills/rss-feed-generator/references/validation-checklist.md`).
   - Preserve `publishedAt: Option<Instant>` rather than inventing it; attach `ExtractedField<T>` provenance containing selector/source, confidence, observed time, and estimated flag (`ai-agent-skills/rss-feed-generator/references/extraction-rules.md`).
   - Serialize XML with an XML library, parse the emitted bytes back, run invariant checks, and keep RSS/Atom-specific wrapper MIME metadata aligned (`ai-agent-skills/rss-feed-generator/references/feed-templates.md`, `ai-agent-skills/rss-feed-generator/references/html-wrapper-template.md`).
8. **Commerce command state machine, isolated from “ACP protocol” work.** If beep-effect needs purchasing, model `CheckoutDraft → Priced → PaymentAuthorized → Completed | Cancelled`, branded minor-unit money, idempotency keys, and an explicit human confirmation command (`ai-agent-skills/acp-client/references/acp-api-operations.md`).
   - Use typed errors such as `Unauthorized`, `NotFound`, `Conflict`, `ValidationFailed`, `PaymentFailed`, and `ProvisioningPending`; never infer success from parseable JSON alone (`ai-agent-skills/acp-client/SKILL.md`).

## Exploration-packet leads (open questions worth a deeper research phase)

- Which A2A protocol/version does the OPAL card actually implement, and how do its `tasks/*` methods map to current A2A task/message naming and streaming semantics (`ai-agent-skills/a2a-client/references/opal-a2a.md`)?
- Can Agent Card URLs legally cross origin, and what policy should bind discovered auth/token endpoints and task endpoints to an approved trust set (`ai-agent-skills/a2a-client/scripts/a2a_client.py`)?
- What exact OPAL task-state literals, artifact shapes, extension fields, and SSE event envelopes occur in recorded traffic; fixtures are absent (`ai-agent-skills/a2a-client/references/opal-a2a.md`)?
- Which ActivityPub JSON-LD shapes appear across Mastodon-compatible, GoToSocial, and Virtuoso deployments, especially embedded versus referenced Undo objects (`ai-agent-skills/fediverse-crud/assets/templates/undo.jsonld`, `ai-agent-skills/fediverse-crud/references/localhost-ap-crud-qa.md`)?
- Why did Virtuoso persist Like while returning 405, and which proof should clients privilege when HTTP and graph state disagree (`ai-agent-skills/fediverse-crud/references/localhost-ap-qa-report-2026-07-10.md`)?
- Which DAV ACL configuration made one actor writable temporarily, and can capability preflight replace trial mutations (`ai-agent-skills/fediverse-crud/references/localhost-ap-three-actor-state.md`)?
- How should ActivityPub HTTP Signatures, inbox delivery retries, sharedInbox batching, and delivery receipts fit beside bearer-authenticated client-to-server writes (`ai-agent-skills/fediverse-crud/references/activitypub-operations.md`)?
- Can the OSDI deployment gate become a reusable policy engine whose check evidence and waivers serialize into the operator's KG/provenance stack (`ai-agent-skills/osdi-inclusion-engine/SKILL.md`)?
- Which parser stack best normalizes malformed RSS/Atom/OPML while retaining source spans and extraction provenance; current skills provide only query/templates (`ai-agent-skills/opml-rss-reader/references/query-templates.md`, `ai-agent-skills/rss-feed-generator/references/extraction-rules.md`)?
- Should synthetic feeds use content hashes or canonical URLs for identity when source URLs change, and how should missing publication dates affect ordering (`ai-agent-skills/rss-feed-generator/references/feed-templates.md`)?
- What real protocol does the commerce API claim, if any, and is its `API-Version: 2026-01-30` contract backed by an OpenAPI document not present in the assigned directory (`ai-agent-skills/acp-client/references/acp-api-operations.md`)?

## Dead ends (what to NOT spend time on, and why)

- Do not treat `acp-client` as Agent Client Protocol research: its own metadata expands ACP as Adaptive Commerce Platform and all operations are commerce REST (`ai-agent-skills/acp-client/SKILL.md`).
- Do not port the Fediverse shell harness verbatim: TLS bypass, unverified OAuth state, fixed secret files, stdout capture corruption, string-templated JSON, and incomplete delivery proof outweigh its convenience (`ai-agent-skills/fediverse-crud/scripts/test-fediverse.sh`).
- Do not treat `Location` or 201 alone as completion: the repository's own Undo and Like evidence disproves that shortcut (`ai-agent-skills/fediverse-crud/references/localhost-ap-crud-qa.md`, `ai-agent-skills/fediverse-crud/references/localhost-ap-qa-report-2026-07-10.md`).
- Do not copy token examples or historical QA traces into an exploration packet; several files contain token-like material and should be sanitized at source (`ai-agent-skills/fediverse-crud/references/localhost-oauth-curl-trace.md`, `ai-agent-skills/fediverse-crud/references/localhost-webacl-qa-report-2026-07-10.md`).
- Do not port raw `sed`/placeholder assembly for JSON-LD, SPARQL, XML, HTML, or SQL; use Schema decoding and format-aware serializers (`ai-agent-skills/fediverse-crud/SKILL.md`, `ai-agent-skills/opml-rss-reader/references/query-templates.md`, `ai-agent-skills/rss-feed-generator/references/feed-templates.md`, `ai-agent-skills/osdi-inclusion-engine/templates/skin-override.sql`).
- Do not spend a deep phase on the OPML/RSS protocol-routing prose; it is a generic fallback list without executable negotiation, capability discovery, or test evidence (`ai-agent-skills/opml-rss-reader/references/protocol-routing.md`, `ai-agent-skills/rss-feed-generator/references/protocol-routing.md`).
- Do not accept the RSS worked example as validation evidence: its DOM is labeled illustrative and the PASS is a manual checklist, not a parser or live artifact proof (`ai-agent-skills/rss-feed-generator/examples/vivianvoss-net.md`).
- Do not use scrape time as a publication-date substitute in a KG or feed pipeline; retain absence and provenance instead (`ai-agent-skills/rss-feed-generator/references/extraction-rules.md`).
- Do not over-invest in the OSDI regex classifier itself; steal the blocking-gate/rollback workflow and replace the detector with DOM-aware checks (`ai-agent-skills/osdi-inclusion-engine/scripts/check_chrome_conflict.py`, `ai-agent-skills/osdi-inclusion-engine/SKILL.md`).
