# Instance

- id: `codex-findings-ingest-force-refresh`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Codex/Findings.schemas.ts:381`
- symbol: `CodexFindingsIngestOptions`
- members: `refresh`, `force`
- evidence: E2 at `Findings.refresh.ts:243-252` — both true is rejected;
  neither, refresh, and force are the three existing-packet modes.

# Current shape

`CodexFindingsIngestOptions` currently stores independently defaulted
`refresh` and `force` booleans beside unrelated ingest options.

# Cardinality gap

The pair represents four combinations; `none`, `refresh`, and `force` are the
three legal states.

# Target schema

Own the single `CodexFindingsExistingPacketMode` LiteralKit here and share it
with the command-options migration. Keep a private encoded options schema with
the current `refresh` and `force` keys, false decoding/constructor defaults,
all neighboring keys, optional-key encodings, and property order. Expose a
decoded options schema with one defaulted `existingPacketMode: none | refresh |
force`, connected by `S.decodeTo` and a named transformation.

Decode false/false to none, true/false to refresh, and false/true to force;
reject true/true as the same incoherent mode conflict. Encode the inverse
mapping. The exported `decodeCodexFindingsIngestOptions` continues accepting
unknown encoded objects with the legacy keys and returns the honest decoded
mode. The exported TypeScript construction shape changes atomically from
sibling flags to `existingPacketMode`; update its JSDoc example and every known
repository consumer in the same change. The execution rider permits that
decoded shape migration, while the encoded decoder contract remains
compatible.

# Migration inventory

- `Findings.schemas.ts:15-18,341-414` — add `LiteralKit` and
  `SchemaTransformation`, define the shared annotated mode, split the exact
  legacy encoded shape from decoded options, and keep the exported decoder.
- Preserve `from`, `slug`, `date`, `branch`, and `expectedCount` optional-key
  behavior plus `dryRun` and `json` false defaults exactly.
- `Findings.command.ts:102-112,195-213,255-279,406-460` — migrate the named
  command carrier and every reader/writer through the sibling design.
- `codex-findings-normalize.test.ts:286-310` — retain invalid slug/date cases,
  prove omitted legacy keys default to decoded `none`, and add canonical
  compatibility rows.
- `codex-findings-refresh.test.ts:373-445` — migrate runtime fixtures and keep
  exact destructive-mode behavior/error precedence.

# Guard-deletion accounting

Delete the parallel fields only from decoded state. Retain them in the private
encoded schema. Delete application conflict validation after the raw CLI
boundary resolves the mode; preserve the exact typed error before capture I/O.

# Encoded-side impact

Compatibility codec required for the exported unknown-input decoder. For each
of the three legitimate legacy pairs, compare new canonical
`encode(decode(payload))` with the old schema's canonical result, including
key names, false defaults, optional-key omission, and property order. Packet,
ledger, and capture encodings remain unchanged. The old permissive schema also
accepted combined true, but the application immediately rejected it and no
fixture or documented input gives it a mode; new decode rejection is explicit
incoherent-input policy, not a compatibility row.

# Test impact

Prove old/new canonical equality for none, refresh, and force; default `none`;
combined-true decode rejection; and raw CLI conflict with its exact typed
reason/message. Retain destructive force/refresh provenance, dry-run behavior,
optional input normalization, and ledger identity tests.

# Risk and sequencing

Land as a Tier 2 singleton after the Tier 1 command-options migration. That
earlier change introduces the shared mode schema and uses it only in the named
command carrier; it leaves this legacy encoded schema and unknown-input decoder
unchanged. This later change reuses that mode to migrate the public decoded
schema behind the compatibility codec. The source search at the frozen revision
finds no application call from the command to this decoder, so the two steps do
not require a mixed-tier atomic landing.

The original validator record is out of census scope because it is function
parameters only. Do not broaden into `writePacket`'s distinct low-level force
parameter. The public encoded decoder requires the compatibility transform even
though packet files do not encode these options.
