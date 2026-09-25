# r3-apps-sidecar-devtools-gates

P2 refresh at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`,2026-09-22.
Derived internal Tier1 owner remains designed4/3; independent P3 pending.

## Current shape

The sidecar reads `DEVTOOLS` with a false default and `DEVTOOLS_URL` with a
localhost default. It derives whether the request is allowed, warns only for a
requested non-local or invalid URL, and reconstructs effective enablement for
`ServerObservabilityConfig`. The shared capability config then uses that final
boolean to include or omit its DevTools layer (`server/Layer.ts:76-82`). Three
request-policy outcomes are represented by the two correlated local booleans.
The inline `devtoolsEnabled` adapter expression is downstream consumer evidence.

## Cardinality gap

Four Boolean pairs are representable and three are legal. This follows from
the exact derivation, not assumptions about producer coverage or public callers:

| Disposition | requested | allowed |
| --- | --- | --- |
| `disabled` | false | true |
| `enabled` | true | true |
| `blocked-non-local` | true | false |

When the request is false, URL locality is deliberately irrelevant and no
warning is emitted. Invalid URLs follow the non-local path only when requested.

## Target schema

Define a private annotated `SidecarDevtoolsDisposition` LiteralKit with
`disabled`, `enabled`, and `blocked-non-local`. Classify the decoded `DEVTOOLS`
value and `DEVTOOLS_URL` once. Check the request first so a false request stays
disabled without consulting URL locality; otherwise a local URL is enabled and
a non-local or invalid URL is blocked. Match the literal for warning behavior
and project a boolean only into `ServerObservabilityConfig.devtoolsEnabled`,
which remains the capability adapter's existing contract. Import `LiteralKit`
through the narrow `@beep/schema/LiteralKit` subpath. The current module has no
`$I` composer: add `$ProfessionalDesktopId.create("runtime/Observability")`, following
RendererObservabilityConfig.ts13 and its identity import. Do not claim an existing local composer. Preserve
LiteralKit helper statics using the supported annotation helper.

Keep Config decode order exactly as current: endpoint, log level, environment,
launch/session/build/transport, DEVTOOLS Boolean, then DEVTOOLS_URL string. A
small sequential Effect mapping may bind the raw Boolean as a callback parameter
while decoding URL and returning the disposition plus unchanged URL; this input
is not a second stored model. Do not decode URL before DEVTOOLS to avoid a local
variable: that changes which Config failure wins. Still decode DEVTOOLS_URL
when request is false; only URL parsing/locality evaluation short-circuits.
Retain final Effect.orDie semantics and warning before config construction.

## Migration inventory

- `apps/professional-desktop/src/runtime/Observability.ts:22-32` — add the
  narrow `@beep/schema/LiteralKit` import and private LiteralKit owner; keep
  the existing `HashSet` URL guard.
- `Observability.ts:44-52` — retain exact URL parsing and the localhost,
  `127.0.0.1`, `::1`, and `[::1]` allowlist; classify once without adding another URL policy or an unnecessary generic helper.
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

## Guard-deletion accounting

Delete the `devtoolsRequested` and `devtoolsAllowed` local booleans,
`!devtoolsRequested || isLocalDevToolsUrl(devtoolsUrl)`,
`if (!devtoolsAllowed)`, and
`devtoolsRequested && devtoolsAllowed`. One literal classification and its
helpers own warning selection and the capability-boundary boolean projection.
The decoded `DEVTOOLS` boolean exists only as classifier input and must not be
retained as a parallel local or getter.

## Encoded-side impact

None. Environment variable names, decoding, defaults, local-host allowlist,
warning text and logged original URL, service metadata, OTLP configuration, and the
shared observability config shape remain unchanged. A false request remains
silent for every URL, including invalid ones. Locality is based only on the URL
parser hostname, not scheme, port, credentials, path or textual spelling; preserve
accepted HTTP/HTTPS local URLs and parser-normalized host spellings even if the
downstream DevTools layer later rejects a protocol. Do not silently add a ws/wss
restriction or redefine all loopback-looking addresses as accepted. No decoded tag crosses the
capability boundary, so `ServerObservabilityConfig` construction and downstream
layer behavior are unchanged.

## Test impact

Add a table for DEVTOOLS false with local, non-local, and invalid URLs; true
with every local hostname spelling; and true with non-local and invalid URLs.
Assert exact warning count/message/URL and exact projected
`devtoolsEnabled`/`devtoolsUrl`. Exercise the layer through an injected
`ConfigProvider` and a seam that captures construction before the DevTools
layer opens a websocket. Add or retain capability seam coverage for false omitting
the layer and true selecting it; source search found fixtures with false but did
not prove an existing pair of branch-selection tests. Run focused Professional Desktop runtime tests
and the appropriate app verification; if a workspace package is edited run its
required package-verify. No runtime layer, network/websocket or Config execution
is performed by this P2 audit; the finite table is arithmetic only.

## Risk and sequencing

Land in Tier 1D. The security boundary is the principal risk: non-local and
invalid URLs must remain disabled and warned only when requested, while a false
request remains silent regardless of URL. Preserve classification precedence
and do not implement the stale prose reference to an unread
`DEVTOOLS_ALLOW_REMOTE` variable as part of this campaign. Correct the stale
comment when touching the module; it currently claims an override that source
never reads. Keep Tauri safe environment forwarding and runtime layer wiring
unchanged. No independent P3, implementation or dry-round credit is claimed.
