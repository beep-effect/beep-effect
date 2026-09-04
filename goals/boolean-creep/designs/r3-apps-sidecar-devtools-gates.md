# Instance

- id: `r3-apps-sidecar-devtools-gates`
- file:line: `apps/professional-desktop/src/runtime/Observability.ts:63`
- symbol: `ObservabilityConfigLive`
- members: `devtoolsRequested`, `devtoolsAllowed`
- evidence: E4 at `Observability.ts:63-85` — `devtoolsAllowed` is false only
  for a requested non-local URL, so refusal implies a request and the
  requested-false/allowed-false pair cannot occur.

# Current shape

The sidecar reads a DevTools feature flag, separately derives whether its URL is
allowed, warns on the refused combination, and reconstructs the effective
enablement with `requested && allowed`. Three dispositions are encoded by two
correlated booleans.

# Cardinality gap

Four boolean pairs are representable and three dispositions are legal:
`disabled`, `enabled`, and `blocked-non-local`.

# Target schema

Define a private named `SidecarDevtoolsDisposition` LiteralKit. Classify the raw
`DEVTOOLS` value and `DEVTOOLS_URL` once: false is `disabled`, true plus a local
URL is `enabled`, and true plus any non-local or invalid URL is
`blocked-non-local`. Match the literal for warning behavior and project a
single boolean only into `ServerObservabilityConfig.devtoolsEnabled`, which is
the capability adapter's existing contract. Import `LiteralKit` through the
current narrow `@beep/schema/LiteralKit` subpath.

# Migration inventory

- `apps/professional-desktop/src/runtime/Observability.ts` imports — add the
  narrow `@beep/schema/LiteralKit` import and private LiteralKit owner; keep
  the existing `HashSet` URL guard.
- `Observability.ts:41-52` — retain local-host parsing; add one pure disposition
  classifier without adding an alternate URL policy.
- `Observability.ts:54-68` — replace `devtoolsRequested` and
  `devtoolsAllowed` with the literal and warn only for `blocked-non-local`.
- `Observability.ts:71-87` — derive `devtoolsEnabled` from the literal at the
  `ServerObservabilityConfig` boundary; preserve the URL and all OTLP fields.
- `runtime/Layer.ts:357-361` remains a transitive layer consumer and requires no
  decoded API change. Whole-app source search found no other member read.

# Guard-deletion accounting

Delete both correlated booleans, `!devtoolsRequested || isLocalDevToolsUrl`,
`if (!devtoolsAllowed)`, and `devtoolsRequested && devtoolsAllowed`. One
literal match owns warning and enablement projection.

# Encoded-side impact

None. Environment variable names/defaults, local-host allowlist, warning text,
logged URL, service metadata, OTLP configuration, and the shared observability
config shape remain unchanged. No decoded tag crosses the capability boundary.

# Test impact

Add a table for DEVTOOLS false with local/non-local URLs, true with every local
hostname spelling, true with non-local and invalid URLs, exact warning
behavior, and exact projected `devtoolsEnabled`/`devtoolsUrl`. Exercise the
layer through an injected `ConfigProvider` without opening a real websocket.
Run focused Professional Desktop runtime tests and the repository-required app
verification/changeset policy.

# Risk and sequencing

Land in Tier 1D. The security boundary is the principal risk: non-local and
invalid URLs must remain disabled and warned, while a false request must remain
silent regardless of URL. Do not implement the stale prose reference to an
unread `DEVTOOLS_ALLOW_REMOTE` variable as part of this campaign.
