# Folder resolution P2 audit

Source/main0be1f13d62fa00cb65e34ff69ec99043380f8d81.

## Findings

Complete4/3 private state retained. Resolved root special case; nonroot requires single matching folder plus exactly one adoption. Public optional additionalAdoptions participates in same authorization list. General BoxPlanAction precondition provider is optional despite private Noop producer supplying Some; retain Option mapping instead of assertion. No narrowing public input contract or wire model needed.

All direct resolution uses in one private module. Dependent candidates use resolved ids, blocked policy precedes capability policy, nonblocked pending remains distinct. Full canonical payloads, digests, order, counters and foreign tracking preserved. Schema annotations moved before tagged-union helper derivation.

## Scope

Source and fixtures inspected; no planner execution, package tests, Box/credential/network calls or canonical/source edits. No independent review credit.

## Inputs

- `packages/drivers/box-provisioning/src/BoxProvisioningPlanner.ts`: `6ea608b04bbbfd9ba7cb8b7aba7bf8d898cce9c816c1dcf2b138b9c951a50a96`
- `packages/drivers/box-provisioning/src/index.ts`: `4350d14ef66249542a0fc915ef68f27ef25b431daf78093a70d4e4fea91d1372`
- `packages/drivers/box-provisioning/src/BoxProvisioningPlan.ts`: `45fb1f7f992f4b248a744fe8553d1438ce22bc03afe33f2ec073966b87a24494`
- `packages/drivers/box-provisioning/src/BoxProvisioningIntent.ts`: `9cc23fb4aab2d742deea0a953da0a2951922ecd908233fd97361afc70ccb57d2`
- `packages/drivers/box-provisioning/src/BoxProvisioningObserved.ts`: `e7ff169f2616e36665ab6363a798c1b460a30377eb71edfeeedabde502289fe3`
- `packages/drivers/box-provisioning/src/internal/canonical.ts`: `1e8fa47407400e53d65c2c15f09388184d90b1c071d38d4de65360729da1191c`
- `packages/drivers/box-provisioning/test/BoxProvisioningPlanner.test.ts`: `0474ff3089f55841b61c53dc804c609110840bd3a4dcdfff60157ee8668a0259`
- `packages/drivers/box-provisioning/test/BoxProvisioning.test.ts`: `41dcaceadcf96f2a0301b8acd03f02bb38ad4882a1a084ec2291b36c9bd4e97a`
- `packages/drivers/box-provisioning/test/BoxProvisioningApplier.test.ts`: `13521546ab7e726daf258e225438905d74d988986b2a2611e0318247c4323007`
- `inventory.before.jsonl`: `5ab42622406dec216b20f7153faaf3c06c0ce5424c3f44d2a9603fe071969785`
- `design.before.md`: `04906695148a635ff4cc347dc5048aba4a9a1bc72342ac7bb2aec426700fce42`

## Outputs

- `proposed-design.md`: `4df5e3e9f8c81b2837f061bd111f9c0785117292d6b3ab6fafa1217ee36159dd`
- `proposed-row.json`: `50c8b8abad95383b120c179e542fd7b9e3089377c78f4ae8a0616dac07bdccca`

Graft savings24671 tokens,2calls.
