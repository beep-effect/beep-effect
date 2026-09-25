# R33 drivers-n-r seed-scope audit

Bounded audit of all **43 existing seeds** in the fifteen roots assigned to r33-drivers-n-r. Frozen source HEAD `32f111f3707a63168b68ed04516af800ecc3a66c`; frozen main `339da1562a2ed52f73a0a693c176fc52cca9ccb6`. This is not a new 88-file census or a claim of R33 completion.

## Result

**15 complete declarations have fewer than two actual Boolean-valued members:** two qualified historical rows and thirteen D1/D2 rows. Withdraw them from the live census after archiving; do not relabel them D1 merely because they are out of scope. Exact old rows are retained in historical-rows.jsonl. inventory-removals.json lists ids. scope-dispositions.json provides complete field inventories, line spans, and reasons.

The other **27 seeds** belong to complete declarations with at least two Boolean-valued members and are not withdrawn by this bounded full-owner scope check. The remaining **one OBS provisioning seed** has the separate completed audit; do not overwrite or duplicate that correction. all-seed-ledger.json accounts for all43.

Boolean member count counts each Boolean-bearing field once, including optional/Option Boolean fields. Option<boolean> has three value strata but is one field. Required enums, strings, integer counts, arrays and payload-presence predicates do not become extra Boolean members. Nested record values remain separate owners. Inherited field spreads are followed where present (TextStreamOptions spreads TextReadOptions.fields).

## Withdrawn declarations

| Seed id | Complete owner | Sole Boolean-bearing member | Source declaration |
| --- | --- | --- | --- |
| phoenix-prompt-read-exists | PhoenixPromptReadResult | exists (boolean) | packages/drivers/phoenix/src/Phoenix.models.ts:825-837 |
| nlp-mcp-file-info-exists | FileInfoOutput | exists (boolean) | packages/drivers/nlp-mcp/src/StreamingTools.ts:126-153 |
| openclaw-channel-probe-wire | OpenclawChannelProbeWire | ok (Option<boolean>) | packages/drivers/openclaw/src/OpenclawCli.service.ts:121-133 |
| onepassword-cli-account-signed-in | OnePasswordCliAccount | signedIn (boolean) | packages/drivers/onepassword-cli/src/OnePasswordCli.models.ts:194-206 |
| obs-request-status-result | ObsRequestStatus | result (boolean) | packages/drivers/obs/src/ObsProtocol.models.ts:385-407 |
| obs-record-state-changed-data | ObsRecordStateChangedData | outputActive (boolean) | packages/drivers/obs/src/ObsProtocol.models.ts:876-899 |
| obs-record-state-changed-event | ObsRecordStateChangedEvent | outputActive (boolean) | packages/drivers/obs/src/ObsProtocol.models.ts:923-951 |
| r24-drivers-n-r-openclaw-agent-turn-aborted-stop-reason | OpenclawAgentTurn | aborted (Option<boolean>) | packages/drivers/openclaw/src/Openclaw.models.ts:732-759 |
| r24-drivers-n-r-openclaw-agent-meta-wire-aborted-stop-reason | OpenclawAgentMetaWire | aborted (Option<boolean>) | packages/drivers/openclaw/src/OpenclawCli.service.ts:197-212 |
| r25-drivers-n-r-jsonl-output-truncated-errors | JsonlOutput | truncated (boolean) | packages/drivers/nlp-mcp/src/StreamingTools.ts:241-272 |
| r25-drivers-n-r-openclaw-gateway-health-wire-ok-plugins | OpenclawGatewayHealthWire | ok (boolean) | packages/drivers/openclaw/src/OpenclawCli.service.ts:98-113 |
| r25-drivers-n-r-openclaw-secrets-reload-output-ok | OpenclawSecretsReloadOutput | ok (boolean) | packages/drivers/openclaw/src/Openclaw.models.ts:449-461 |
| r25-drivers-n-r-runpod-raw-request-authenticated-body | RunpodRawRequest | authenticated (boolean (default true)) | packages/drivers/runpod/src/Runpod.service.ts:132-144 |
| r26-drivers-n-r-openclaw-gateway-health-ok-plugins | OpenclawGatewayHealth | ok (boolean) | packages/drivers/openclaw/src/Openclaw.models.ts:634-652 |
| r26-drivers-n-r-openclaw-telegram-group-intent | OpenclawTelegramGroupIntent | requireMention (boolean) | packages/drivers/openclaw/src/OpenclawIntent.models.ts:910-922 |

## Qualified design withdrawals need precise explanations

**FileInfoOutput** (`StreamingTools.ts:126-153`) has exists, optional numeric lineCount, optional numeric sizeBytes and nothing else. The identity mapFields/codec wrappers add no flags. `StreamingHandlers.ts:176-190` branches on one filesystem existence result and emits the two familiar shapes; `StreamingTools.ts:1537-1544` makes this the MCP tool success schema. That is real payload correlation, but not two Boolean members. Its prior E1 label refers to a Boolean plus payload writes, not an exclusive write of two flags. The old4/2 coarse table also collapses two independently optional statistics; it cannot establish recall eligibility.

This withdrawal does not rescind the explicitly recorded false-with-stale-statistics compatibility ruling in DECISIONS.md. It means the current boolean-creep corpus lacks the required multi-Boolean owner here. Leave live schemas, accepted/encoded values, handlers, MCP output and tests untouched; any future payload-model task must preserve the applicable compatibility rule. Archive the old design rather than pretending its qualified/reviewed status satisfies the net.

**PhoenixPromptReadResult** (`Phoenix.models.ts:825-837`) has exactly exists:Boolean and promptVersionId:NullOr(String). `Phoenix.service.ts:519-529` genuinely derives both from one nullable SDK result. E3 is evidence of that relationship; it does not waive the two-Boolean recall gate. The historical design's statement that an existing E3 record is retained solely because the writer ties both members to one Option is insufficient.

The exported SDK/service interfaces at Phoenix.service.ts:83-94,112-129 and forwarding method623-630 add no sibling Boolean to this result. Known tests construct/read it at Phoenix.service.test.ts:156,269-276, with schema round-trip inventory at70. The ai-metrics fake at packages/tooling/library/ai-metrics/test/agent-effectiveness.test.ts:478-484 is another constructor of the same two-field class, not an enlarged owner. Preserve the public result, raw nullable String id domain and all these consumers; no new restriction or migration is proposed.

Both designs are copied byte-for-byte into private design-archives/. design-archive-list.json gives their original paths and SHA256 bindings. The remaining thirteen withdrawn rows are census-only and require no implementation design.

## Why the other payload-pair seeds are not blindly withdrawn

Three short seed member lists need an explicit full-declaration check:

- `r24-drivers-n-r-openclaw-channel-account-probe-ok-error` belongs to OpenclawChannelAccountStatus (`Openclaw.models.ts:675-710`), with configured, connected, enabled, probeOk and running. Connected/probeOk preserve absent/false/true. The nested OpenclawChannelProbeWire is a DIFFERENT owner with only optional ok, and IS withdrawn. Its enclosing account class is not withdrawn wholesale.
- `r25-drivers-n-r-openai-compat-chat-completion-stream-options` belongs to OpenAiCompatChatCompletionRequest (`OpenAiCompat.models.ts:833-885`), which has both parallel_tool_calls and stream as optional Booleans. The full request is not a one-Boolean owner.
- `r25-drivers-n-r-stream-state-finished-finish-reason` belongs to StreamState (`OpenAiCompatLanguageModel.service.ts:221-248`), which has finished, textEnded and textStarted. Preserve the separately qualified text-span owner. A short finished/finishReason pair list alone does not prove the full declaration fails recall.

This audit records only that these complete declarations have enough members; it does not promote their payload pairs, manufacture a relation using an independent field, or supply independent P3 review. Their existing D classifications and the separately qualified StreamState model are outside the fifteen full-owner withdrawal decisions.

Other checked controls include EngineProfile (four fields), MigrationJournalShapeRow (two), PageInfo (two Option<Boolean> fields), OpenclawChannelHealth (three Option<Boolean> fields), EnsureQaSceneResult/ObsRecordStatus (two each), the NLP options classes (two direct/defaulted/optional fields, including inherited TextStreamOptions), OpenAiCompatLanguageModelConfig (OptionalBoolean plus defaulted Boolean), detectEngineProfile's two locals, and telegramChannelDocument's two emitted flags. Full source spans and counts are in all-seed-ledger.json. Their semantic classifications were not re-reviewed by this count audit.

## Boundary and preservation observations

- Openclaw gateway channels are nested maps of channel owners. Do not borrow their flags to keep gateway ok/plugin summaries in the net. projectGatewayHealth preserves ok while independently mapping plugin counts/arrays at OpenclawCli.service.ts339-355.
- Openclaw agent wire/domain aborted values remain Option<Boolean>; projectAgentTurn357-373 copies absent/false/true and optional stopReason separately. Do not derive Boolean state from status text.
- OnePasswordCliAccount has only signedIn plus optional account text. Although whoami writes true on success, the schema test explicitly constructs signedIn:false with no account (`OnePasswordCli.service.test.ts75-83`). No 1Password command or secret operation was performed. The prior successful-producer claim is not justification to narrow construction.
- ObsRequestStatus includes integer code and optional comment but only one result bit. RecordStateChanged data/event each carry one outputActive bit, an output-state literal, and optional path; wrapping adds a tag, not another Boolean. Protocol copying and readers remain unchanged.
- JsonlOutput has one truncated bit plus count/records/errors; optional error presence does not supply a second Boolean. RunpodRawRequest has one authenticated bit plus HTTP payload/configuration fields; body and credential-selection paths stay independent. OpenclawSecretsReloadOutput warningCount stays numeric. TelegramGroupIntent groupPolicy stays an optional literal override.

## Evidence and limits

Graft preceded source reads; exact complete declarations and targeted writer/reader checks support each withdrawal. Source hashes and head/main equality are bound in audit.json. The output includes historical rows and design copies, not canonical edits. No inventory status outside the existing schema was invented. No source, runtime service, test, git ref, fetch, independent P3 or round-completion operation occurred. R33's lane footer is the lead for this audit, not the evidence replacing source verification.
