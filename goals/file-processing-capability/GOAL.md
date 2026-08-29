# GOAL: Complete the file-processing capability

Repo root: the current working directory - the `beep-effect` checkout you are
running in. Do not assume an absolute path. All paths below are repo-relative.

Outcome: complete the next pending P2-P5 phase so products can consume
deterministic `@beep/file-processing` artifacts without driver/tooling imports.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/file-processing-capability/README.md`
- `goals/file-processing-capability/SPEC.md`
- `goals/file-processing-capability/PLAN.md`
- `goals/file-processing-capability/ops/manifest.json`

Read those first, then `AGENTS.md` and the named architecture standards, which
outrank packet prose. Confirm all targets against live source before editing.

Scope:

- P2: broaden `packages/drivers/tika` across non-PST V1 formats.
- P3: deepen `packages/drivers/libpff` PST-to-EML/JSONL export.
- P4: finish `packages/tooling/tool/cli/src/commands/Files` manifest output and
  corpus calibration.
- P5: record verification and consumer handoff evidence.
- Preserve: runtime-neutral contracts, deterministic strategy selection,
  bounded materialization, schema manifests, public fixtures, and typed errors.
- Out: OCR implementation, Box sync, product workflows, knowledge-graph
  assembly, legal entity resolution, conversion, or production retention.

Workflow:

1. Select the first needed pending phase and verify its package, command,
   exports, and tests at live HEAD.
2. Search source and barrels for reusable schemas and helpers before adding
   contracts. Keep format engines outside the foundation capability.
3. Implement only its exit criteria with deterministic fixtures.
4. Keep failures translated at the driver adapter; external engine/process
   errors must not escape the operation contract.
5. Verify the package and manifest/corpus surfaces named by the phase.
6. Preserve unrelated changes; update evidence only when exit criteria pass.
7. Use the repo's Yeet workflow for repair, verification, publishing, and
   monitoring when shipping is authorized.

Consumer contract: P2-P5 remain aligned with
`goals/legal-document-intake` P4. Tika and the CLI provide extraction over
filed documents; libpff provides PST/email child artifacts for the same
extraction and knowledge-graph pipeline.

Acceptance:

- [ ] The selected phase's PLAN exit criteria are satisfied.
- [ ] Capability code has no concrete driver, tooling, Box, or product imports.
- [ ] Public fixtures cover the behavior without private data.
- [ ] Required checks pass, or unrelated baseline failures are reproduced and
      recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/file-processing-capability/GOAL.md)" -le 4000
jq . goals/file-processing-capability/ops/manifest.json
git diff --check -- goals/file-processing-capability
```

Stop and report before widening the V1 cutline, adding dependencies, changing
public API outside the selected phase, using private corpus data, changing
auth/infra, editing generated files, or performing destructive operations.

Done only when acceptance and verification complete, or when a blocker is
reported with file and command evidence.
