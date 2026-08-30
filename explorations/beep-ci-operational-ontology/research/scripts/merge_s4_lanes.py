"""S4 lane merge — the orchestrator duties of s4-lane-contract.md §5, as a committed
carrier (prose duties are not an orchestrator; the round-2/3 doctrine).

Reads every `ontology/extraction/s4/*.yaml` lane output (partitions included, merged
outputs excluded) and writes:

- `ontology/extraction/s4/CANDIDATES.yaml` — merge key `(kind, source_domain,
  candidate)` for literal-domain-members, `(kind, candidate)` otherwise. Records with
  identical payloads (definition/domain/range/admission_kind) collapse into one entry
  with unioned `cq_justification`/`supports`/`evidence` and a `source_lanes` list.
  Conflicting payloads are NEVER silently merged: every distinct variant survives
  (each with its lanes) and a synthesized `schema-conflict` LEDGER entry names the
  key and the variants.
- `ontology/extraction/s4/FACTS.yaml` — facts merge on `(subject, predicate)`;
  identical `(value, value_type)` payloads collapse. An IRI-valued predicate with
  many values is a SET (edge predicates like dependsOn), never a conflict; only a
  LITERAL-valued (`xsd:*`) predicate with differing values synthesizes a
  schema-conflict ledger entry (a policy datum has one deployed value).
- `ontology/extraction/s4/LEDGER.yaml` — every lane issue plus the synthesized
  conflicts; dedup key `(kind, normalize(claim))` where normalize = lowercase,
  collapse whitespace, strip trailing punctuation. This file IS the S4→S5 queue.

Canonical ordering: candidates by kind (class, property, individual,
literal-domain-member), then source_domain, then name, ASCII; facts by
(subject, predicate). Run: uv run --with pyyaml python merge_s4_lanes.py
"""
import re
from pathlib import Path

import yaml

PACKET = Path(__file__).resolve().parents[2]
S4 = PACKET / "ontology/extraction/s4"
MERGED = {"CANDIDATES.yaml", "FACTS.yaml", "LEDGER.yaml"}
KIND_ORDER = {"class": 0, "property": 1, "individual": 2, "literal-domain-member": 3}

lanes = sorted(p for p in S4.glob("*.yaml") if p.name not in MERGED)
if not lanes:
    raise SystemExit("no lane outputs found")


def normalize(claim):
    return re.sub(r"[.!?:;,\s]+$", "", re.sub(r"\s+", " ", (claim or "").lower())).strip()


def as_list(v):
    return v if isinstance(v, list) else [v] if v else []


candidates, facts, ledger = {}, {}, {}
conflicts = []

for path in lanes:
    lane = yaml.safe_load(path.read_text()) or {}
    lane_id = (lane.get("telemetry") or {}).get("lane") or path.stem
    for c in lane.get("candidates") or []:
        key = (c.get("kind"), c.get("source_domain") or "", c.get("candidate"))
        if c.get("kind") != "literal-domain-member":
            key = (c.get("kind"), "", c.get("candidate"))
        payload = (c.get("definition"), c.get("domain"), c.get("range"), c.get("admission_kind"))
        bucket = candidates.setdefault(key, [])
        for existing in bucket:
            if existing["_payload"] == payload:
                existing["source_lanes"] = sorted(set(existing["source_lanes"]) | {lane_id})
                for f in ("cq_justification", "supports", "evidence"):
                    merged_vals = list(dict.fromkeys(as_list(existing.get(f)) + as_list(c.get(f))))
                    if merged_vals:
                        existing[f] = merged_vals
                break
        else:
            rec = dict(c)
            rec["_payload"] = payload
            rec["source_lanes"] = [lane_id]
            bucket.append(rec)
    for f in lane.get("facts") or []:
        key = (f.get("subject"), f.get("predicate"))
        payload = (f.get("value"), f.get("value_type"))
        bucket = facts.setdefault(key, [])
        for existing in bucket:
            if existing["_payload"] == payload:
                existing["source_lanes"] = sorted(set(existing["source_lanes"]) | {lane_id})
                break
        else:
            rec = dict(f)
            rec["_payload"] = payload
            rec["source_lanes"] = [lane_id]
            bucket.append(rec)
    for i in lane.get("issues") or []:
        key = (i.get("kind"), normalize(i.get("claim")))
        if key in ledger:
            ledger[key]["source_lanes"] = sorted(set(ledger[key]["source_lanes"]) | {lane_id})
        else:
            rec = dict(i)
            rec["source_lanes"] = [lane_id]
            ledger[key] = rec

for key, bucket in sorted(candidates.items()):
    if len(bucket) > 1:
        conflicts.append({
            "id": f"merge-conflict-candidate-{key[2]}",
            "kind": "schema-conflict",
            "claim": f"candidate {key[2]!r} ({key[0]}) has {len(bucket)} conflicting definitions across lanes "
                     f"{sorted(set(sl for b in bucket for sl in b['source_lanes']))} — never silently merged; S5 rules",
            "evidence": "ontology/extraction/s4/CANDIDATES.yaml — the variants sit adjacent under one merge key",
            "suggested_disposition": "S5 picks or reconciles one definition",
            "status": "open",
        })
for key, bucket in sorted(facts.items()):
    # An IRI-valued predicate with many values is a SET (dependsOn edges etc.), not a
    # conflict; only a LITERAL-valued (xsd:*) predicate with differing values is one —
    # a policy datum has one deployed value.
    literal_variants = [b for b in bucket if str(b.get("value_type", "")).startswith("xsd")]
    if len(bucket) > 1 and len(literal_variants) == len(bucket):
        conflicts.append({
            "id": f"merge-conflict-fact-{key[0]}-{key[1]}",
            "kind": "schema-conflict",
            "claim": f"literal fact ({key[0]}, {key[1]}) has {len(bucket)} conflicting values across lanes "
                     f"{sorted(set(sl for b in bucket for sl in b['source_lanes']))}",
            "evidence": "ontology/extraction/s4/FACTS.yaml — the variants sit adjacent under one merge key",
            "suggested_disposition": "S5 picks the deployed value with evidence",
            "status": "open",
        })
for c in conflicts:
    key = (c["kind"], normalize(c["claim"]))
    ledger.setdefault(key, c)


def strip_private(rec):
    return {k: v for k, v in rec.items() if not k.startswith("_")}


cand_out = [strip_private(r)
            for key in sorted(candidates, key=lambda k: (KIND_ORDER.get(k[0], 9), k[1], str(k[2])))
            for r in candidates[key]]
fact_out = [strip_private(r) for key in sorted(facts, key=lambda k: (str(k[0]), str(k[1]))) for r in facts[key]]
ledger_out = sorted(ledger.values(), key=lambda r: (r.get("kind") or "", normalize(r.get("claim"))))

header = ("# GENERATED by merge_s4_lanes.py from the lane outputs beside this file — do not\n"
          "# hand-edit. Contract: s4-lane-contract.md §5. Statuses transition only through\n"
          "# S5 ratification.\n")
(S4 / "CANDIDATES.yaml").write_text(header + yaml.safe_dump(cand_out, sort_keys=False, allow_unicode=True, width=100))
(S4 / "FACTS.yaml").write_text(header + yaml.safe_dump(fact_out, sort_keys=False, allow_unicode=True, width=100))
(S4 / "LEDGER.yaml").write_text(header + yaml.safe_dump(ledger_out, sort_keys=False, allow_unicode=True, width=100))

print(f"lanes={len(lanes)} candidates={len(cand_out)} (from {sum(len(b) for b in candidates.values())} slots, "
      f"{len([1 for b in candidates.values() if len(b) > 1])} conflicted keys) "
      f"facts={len(fact_out)} ({len([1 for b in facts.values() if len(b) > 1])} conflicted) "
      f"ledger={len(ledger_out)} ({len(conflicts)} synthesized conflicts)")
