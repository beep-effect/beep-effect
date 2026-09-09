# M365 and runtime payload design refresh

Reviewed against source `7440cb8c4302ce64b87860069a464bafbf65f576` and corpus main `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

## M365 tool error retryability

`M365ToolError` is a repo-owned MCP failure contract exported by `@beep/m365-mcp` and installed in eleven tools. It is therefore wire-facing Tier 2 rather than D2. The existing `M365ErrorReason` owns eight literals. The handler writes all eight possible present reasons and derives retryability as true exactly for `transport` and `throttled`; the documented/tested no-reason fixture is false. This gives 18 representable and 9 supported tuples for `[reason,retryable]`.

The design in `goals/boolean-creep/designs/m365-tool-error-retryability.md` classifies the record as stored, wire, Tier 2 with E4 evidence and target shape `option-literal`. It keeps `Option<M365ErrorReason>` as the semantic variable, removes decoded retryability, and uses an exact legacy codec to preserve the required `retryable` wire key and optional `reason` key. The generic schema-derived arbitrary test proves old codec invertibility, not support for the nine incoherent tuples; target arbitrary generation covers the nine semantic values and explicit decode tests reject the inverse projections.

## Runtime activity payload kind

The complete cluster is `[activityType,artifactId,spanIds]`, not the raw two-option projection. `RuntimeActivityType` has two literals, so the flat shape represents eight presence tuples. The two fixture writers, two public JSDoc examples, two versioned expected context packets, and exact SDK proposal gate support exactly two: `artifact_ingested` with artifact only and `candidate_work_proposed` with spans only.

No legitimate both-present case was found. Validation otherwise reads only `principalId`, SDK reads return generated fixtures, and `ProfessionalRuntime.fixture-service.ts:328-329` rejects any proposal whose complete plain JSON differs from the deterministic fixture. Option defaults and schema-derived arbitrary values do not override that business contract.

The design in `goals/boolean-creep/designs/runtime-activity-payload-kind.md` classifies the record as stored, wire, Tier 2 with E1/E2 evidence, cardinality 8/2, and target shape `tagged-union`. Two variants reuse `activityType` as the encoded discriminator and carry the real artifact or ordered span payload directly. The two supported wire shapes remain exact; six unsupported permissive-schema projections are rejected without a compatibility transform.

## Parent reconciliation recommendation

Admit both canonical ids with the metadata above. For M365, use `storage: stored`, `exposure: wire`, `targetShape: option-literal`, Tier 2, 18/9; the runtime-generated boolean is nevertheless stored in the current class and encoded contract. For runtime activity, use `storage: stored`, `exposure: wire`, `targetShape: tagged-union`, Tier 2, 8/2. The raw runtime record's internal exposure and 4/3 count omit the discriminator, treat defaults as business evidence, and lose both payloads under an option-literal target.

## Verification

Independent P3 review remains pending. `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` passed with `design coverage OK: 154 qualified ids`; scoped `git diff --check` passed for both designs and this handoff.
