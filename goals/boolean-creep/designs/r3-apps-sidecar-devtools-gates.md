# Instance

- id: `r3-apps-sidecar-devtools-gates`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus: `origin/main@9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `apps/professional-desktop/src/runtime/Observability.ts:63`
- symbol: `ObservabilityConfigLive`
- members: `devtoolsRequested`, `devtoolsAllowed`
- evidence: E4 at `Observability.ts:63-65` — `devtoolsAllowed` is
  `!devtoolsRequested || isLocalDevToolsUrl(devtoolsUrl)`. Therefore a refusal
  implies a request and only three of four pairs are legal. The inline
  `devtoolsEnabled` property at line 85 is a projection into the separate
  `ServerObservabilityConfig` carrier, not a third member of this owner.

# Current shape

The sidecar reads `DEVTOOLS` with a false default and `DEVTOOLS_URL` with a
localhost default. It derives whether the request is allowed, warns only for a
requested non-local or invalid URL, and reconstructs effective enablement for
`ServerObservabilityConfig`. The shared capability config then uses that final
boolean to include or omit its DevTools layer (`server/Layer.ts:76-82`). Three
request-policy outcomes are represented by the two correlated local booleans.
The inline `devtoolsEnabled` adapter expression is downstream consumer evidence.

# Cardinality gap

Four boolean pairs are representable and three are legal:

| Disposition | requested | allowed |
| --- | --- | --- |
| `disabled` | false | true |
| `enabled` | true | true |
| `blocked-non-local` | true | false |

When the request is false, URL locality is deliberately irrelevant and no
warning is emitted. Invalid URLs follow the non-local path only when requested.

# Target schema

Define a private annotated `SidecarDevtoolsDisposition` LiteralKit with
`disabled`, `enabled`, and `blocked-non-local`. Classify the decoded `DEVTOOLS`
value and `DEVTOOLS_URL` once. Check the request first so a false request stays
disabled without consulting URL locality; otherwise a local URL is enabled and
a non-local or invalid URL is blocked. Match the literal for warning behavior
and project a boolean only into `ServerObservabilityConfig.devtoolsEnabled`,
which remains the capability adapter's existing contract. Import `LiteralKit`
through the narrow `@beep/schema/LiteralKit` subpath and reuse the existing
`$I` composer.

# Migration inventory

- `apps/professional-desktop/src/runtime/Observability.ts:22-32` — add the
  narrow `@beep/schema/LiteralKit` import and private LiteralKit owner; keep
  the existing `HashSet` URL guard.
- `Observability.ts:44-52` — retain exact URL parsing and the localhost,
  `127.0.0.1`, `::1`, and `[::1]` allowlist; add one pure disposition
  classifier without adding another policy.
- `Observability.ts:54-69` — classify the decoded request and URL directly,
  eliminating the two named boolean locals, and warn only for
  `blocked-non-local`.
- `Observability.ts:71-88` — project `devtoolsEnabled` from the literal at the
  `ServerObservabilityConfig` boundary; preserve the URL and all OTLP fields.
- `Observability.ts:90-122` and `apps/professional-desktop/src/runtime/Layer.ts`
  remain layer consumers and require no decoded API change.
- `packages/foundation/capability/observability/src/server/Config.ts:48-65`
  retains the exported `devtoolsEnabled: S.Boolean` adapter field.
- `packages/foundation/capability/observability/src/server/Layer.ts:76-82`
  retains its existing final enable/disable branch. The private disposition
  must not cross into this capability package.

# Guard-deletion accounting

Delete the `devtoolsRequested` and `devtoolsAllowed` local booleans,
`!devtoolsRequested || isLocalDevToolsUrl(devtoolsUrl)`,
`if (!devtoolsAllowed)`, and
`devtoolsRequested && devtoolsAllowed`. One literal classification and its
helpers own warning selection and the capability-boundary boolean projection.
The decoded `DEVTOOLS` boolean exists only as classifier input and must not be
retained as a parallel local or getter.

# Encoded-side impact

None. Environment variable names, decoding, defaults, local-host allowlist,
warning text and logged URL, service metadata, OTLP configuration, and the
shared observability config shape remain unchanged. A false request remains
silent for every URL, including invalid ones. No decoded tag crosses the
capability boundary, so `ServerObservabilityConfig` construction and downstream
layer behavior are unchanged.

# Test impact

Add a table for DEVTOOLS false with local, non-local, and invalid URLs; true
with every local hostname spelling; and true with non-local and invalid URLs.
Assert exact warning count/message/URL and exact projected
`devtoolsEnabled`/`devtoolsUrl`. Exercise the layer through an injected
`ConfigProvider` and a seam that captures construction before the DevTools
layer opens a websocket. Retain shared capability tests proving false omits
the layer and true selects it. Run focused Professional Desktop runtime tests
and full package verification.

# Risk and sequencing

Land in Tier 1D. The security boundary is the principal risk: non-local and
invalid URLs must remain disabled and warned only when requested, while a false
request remains silent regardless of URL. Preserve classification precedence
and do not implement the stale prose reference to an unread
`DEVTOOLS_ALLOW_REMOTE` variable as part of this campaign.
