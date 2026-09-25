# R34 drivers-a-f complete-owner recall audit

All thirteen footer-proposed historical seed owners fall outside the >=2 Boolean recall net. One was qualified (`cosmos-backend-selection-webgl2`); twelve were D1/D2 census records. Remove those thirteen live rows without adding replacement D1/D2 records, and archive the one historical qualified design. This private audit makes no canonical edits and does not implement any historical design.

The thirteen IDs, declaration spans, Boolean-bearing members and reasons
are published in [the scope dispositions](./r34-drivers-a-f-scope-dispositions.json).
The [parent integration receipt](../r34-partial-integration-2026-09-25.json)
records the removals. The [withdrawn rows](../../history/inventory/2026-09-25-r34-withdrawn-rows.jsonl)
and [archived Cosmos design](../../history/designs/2026-09-25-r34-partial-reconciliation/cosmos-backend-selection-webgl2.md)
preserve the historical input. The full original inventory is retained in
[the pre-reconciliation snapshot](../../history/inventory/2026-09-25-pre-r34-partial-reconciliation.jsonl).
The five audited source files matched the frozen HEAD and main, and their
saved bindings were revalidated before parent integration.

## Scope and source authority

This audit starts with the terminal R34 drivers-a-f execution footer, including its complete thirteen-owner withdrawal list, not a guessed symbol subset. The lane JSONL legitimately contains zero records; its execution receipt records exit0, endTurnEvent, zero proposed new or changed in-net clusters and the withdrawal names. SPEC.md:33-38 separates actual Boolean recall from evidence classification. SPEC.md:58-60 allows a minimal correlated cluster inside an independently eligible larger owner. Optional numeric/string/enum presence is not a second actual Boolean. Even conservatively counting optional Boolean and Option<Boolean> slots as Boolean-bearing members, these thirteen owners each have only one.

## Complete-owner and alias checks

Cosmos.backend.ts:105-114 defines three fields: backend, webGl2, reason. CosmosBackend at33 is a string LiteralKit cosmos/sigma. The capability-probe input and its webGl2 observation are separate owners. selectCosmosBackend170-175 projects the same observation to enum and Boolean, which does not create a second sibling Boolean. This recall withdrawal does not independently authorize the historical public TypeScript migration or assert that producer pairs exhaust public schema legality.

BoxProvisioningIntent.ts:391-402 has one Boolean. BoxEntitlementAvailability291 and BoxPlanName319 are string LiteralKits, and annual allowance is Option<Natural>. Metadata/retention availability does not become actual Boolean merely because its domain has two string values.

Firecrawl.models.ts:59-69 is a complete inline type with no inherited or spread fields. strictConstrainToURLs is its sole optional Boolean. The child FirecrawlSdkAgentWaitRequest71-74 intersects this owner with numeric pollInterval/timeout only; it adds no Boolean and is not silently merged into the seed. Nested schema records and webhook objects are payload, not direct siblings.

Firecrawl.responses.ts defines each seven named schema owner directly through S.Class, without spreads, inherited custom fields or intersections. BrowserListShape's sessions array holds BrowserSessionShape; nested streamWebView does not coexist as a direct Boolean member of the list envelope. QueueStatusShape.mostRecentSuccess is nullable string, not Boolean. Status enums and unknown data in AgentStatusShape do not count as actual Boolean members.

Firecrawl.errors.ts:26 resolves optionalBoolean to OptionFromOptionalKey(S.Boolean) with None default. The complete Options266-279, Input281-294 and Error311-398 carriers have only retryable as a Boolean-bearing slot. retryAfterSeconds/status are numeric; cause and sdk/method are strings or unknown. failure is a nested FirecrawlApiFailure payload228-239, whose success:false literal is not flattened into these owners. Error's static constructor helpers and local input variable are not extra instance members. The local Effect reference Schema.ts:15044-15079 confirms TaggedError adds a string _tag via TaggedStruct; it does not spread a second Boolean data member. No custom domain superclass is inherited. The normalization constructor346-357 preserves the separate optional diagnostics and requires no change.

## Independently eligible larger owner preserved

BrowserExecuteShape, Firecrawl.responses.ts:337-349, has killed via optionalBoolean and required success. Thus its complete owner reaches two Boolean-bearing members. Preserve all three historical rows: firecrawl-browser-execute-shape, r24-drivers-a-f-firecrawl-browser-execute-success-error and r25-drivers-a-f-firecrawl-browser-execute-killed-error. The latter payload subclusters need not contain two Booleans individually because their real complete owner already qualifies for recall. The three rows remain in the current inventory and in the pre-reconciliation snapshot linked above; none appears in the parent removal list. This contrasts with the thirteen actual one-slot owners without inventing restrictions or reapproving their semantics.

Other lane seed families named unchanged by the footer were not expanded into this bounded audit. No blanket withdrawal is inferred from status/error correlation or from class names. No runtime/product tests, independent P3 proof or dry-round credit is claimed.
