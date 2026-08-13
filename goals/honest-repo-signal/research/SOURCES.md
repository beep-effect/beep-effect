# Honest Repo Signal — Sources & Provenance

Direct-authored packet (no exploration). Claims below are from the live
checkout on 2026-08-13, not from an external literature review.

## 1. In-repo capability references

| Brick | Path | Use |
| --- | --- | --- |
| Goal template | `goals/_template/` | Scaffold. Live `beep goals` has no `bootstrap`. |
| Goal index / doctor / set-status | `packages/tooling/tool/cli/src/commands/Goals/` | Register this packet. |
| Architecture constitution | `standards/ARCHITECTURE.md` | Binding topology. |
| Placeholder-package decision | `standards/architecture/DECISIONS.md` (2026-06-21) | Precedent for deleting empty packages and keeping reserved names in doctrine. |
| Driver boundaries | `standards/architecture/03-driver-boundaries.md` | Drivers must be useful technical wrappers. |
| Non-slice families | `standards/architecture/07-non-slice-families.md` | Family/kind grammar. |
| Evolution / retirement | `standards/architecture/11-evolution-and-deprecation.md` | Slice sunset; empty drivers have no consumers so sunset is immediate. |
| Delivery packet | `goals/gov-legal-data-driver-delivery/` | Owns FedReg / DOL / CourtListener resume research; said keep empty scaffolds (superseded). |
| Codegen predecessor | `goals/gov-legal-data-driver-codegen/` | Completed-retained substrate; P2 superseded. |
| Court reporter vocabulary | `goals/court-reporter-vocabulary/` | Related courts-db work; not the CL HTTP driver. |
| KSA | `goals/knowledge-surface-automation/` | Owns `beep goals bootstrap` (specified, not implemented). |
| Harness hygiene | `goals/harness-hygiene-mechanical/` | Prior AGENTS.md shrink; do not undo. |
| CI fleet | `goals/ci-fleet-endgame/` | Out of scope. |

## 2. Live CLI fact (2026-08-13)

```text
beep-cli goals subcommands: doctor, index, set-status
```

`compileMaterializationPlan` / `BootstrapInput` are not in `packages/`.
KSA `research/p1-bootstrap-adopt-plan-design.md` is design-only.

## 3. Stub inventory (this checkout)

| Package | `src` files | Public surface | This packet |
| --- | --- | --- | --- |
| `@beep/courtlistener` | 1 | `VERSION = "0.0.0"` | Delete |
| `@beep/dol` | 1 | `VERSION = "0.0.0"` | Delete |
| `@beep/federal-register` | 1 | `VERSION = "0.0.0"` | Delete |
| `@beep/protobuf` | 1 | `VERSION = "0.0.0"` | Leave — other clone |

## 4. External research sources

None. No URLs invented.

## 5. Cross-links

- Rating session that produced the cut/keep thesis (this conversation).
- `goals/gov-legal-data-driver-delivery/README.md` lines 62–64 (keep-scaffold
  sentence this packet supersedes).
