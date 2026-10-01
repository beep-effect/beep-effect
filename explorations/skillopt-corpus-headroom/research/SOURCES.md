# SkillOpt Corpus Headroom — Sources & Provenance

- **Cluster / origin:** the harness-evidence-ledger P4 rerun close.
- **Provenance:** no external research yet; the packet is parked at capture.

## 3. External research sources

None yet.

## 4. In-repo capability references

- `tools/skillopt/` — the SkillOpt adapter, pre-evaluation screen, baseline
  noise measurement, step export, and ledger recorder. Reuse.
- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/` — the
  sandboxed eval scorer. Reuse.
- `goals/skillopt-training-pilot/corpus/` — the current 8 train / 4
  validation corpus. Extend or replace.

## 5. Cross-links & provenance

- Discovered from
  [`goals/harness-evidence-ledger`](../../../goals/harness-evidence-ledger/README.md).
- Evidence:
  [`history/p4-rerun/FINDINGS.md`](../../../goals/harness-evidence-ledger/history/p4-rerun/FINDINGS.md).
- This packet's [`DECISIONS.md`](../DECISIONS.md).
