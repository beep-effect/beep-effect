"""etl_policy — extract the deployed scheduler policy into POLICY.yaml.

The extractor reads QualityScheduler.schemas.ts at the pinned checkout commit,
parses the seven S6-ratified AdmissionConfig defaults, four work-kind weights,
and both LiteralKit enumerations, then joins those facts back to the S4 indexes
selected by the S5 fact-class dispositions.  Count drift hard-fails; value or
datatype drift is emitted for the S6 gate and steward.  Deterministic and
idempotent.

Run: uv run --with pyyaml python etl_policy.py
"""

from __future__ import annotations

import re

from _common import REPO, S4, S5, S6, corpus_commit, load_yaml, repo_path, write_generated_yaml

SOURCE = REPO / "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts"
POLICY_SUBJECT = "YeetWeightedAdmissionV1"
PARAM_TYPES = {
    "capacityMaxTokens": "xsd:integer",
    "slotSizeGib": "xsd:decimal",
    "reserveGib": "xsd:decimal",
    "hardFloorGib": "xsd:decimal",
    "heartbeatSeconds": "xsd:integer",
    "publishAgingSeconds": "xsd:integer",
    "reviewFixClassCap": "xsd:integer",
}
S4_WORK_SUBJECT = {
    "full-proof": "FullProofWork",
    "merged-preview": "MergedPreviewWork",
    "review-fix": "ReviewFixWork",
    "publish": "PublishWork",
}


def line_of(text: str, offset: int) -> int:
    """Return the one-based source line containing an offset."""

    return text.count("\n", 0, offset) + 1


def source_at(line: int) -> dict:
    """Build the source pin carried by every extracted fact/member."""

    return {"file": repo_path(SOURCE), "line": line}


def literal_members(text: str, name: str, expected: int) -> tuple[list[str], int]:
    """Extract one named LiteralKit array and its source line."""

    match = re.search(
        rf"export const {re.escape(name)}\s*=\s*LiteralKit\(\[(?P<body>.*?)\]\)",
        text,
        re.DOTALL,
    )
    if not match:
        raise SystemExit(f"cannot find {name} LiteralKit")
    members = re.findall(r'"([^"\\]+)"', match.group("body"))
    if len(members) != expected or len(set(members)) != expected:
        raise SystemExit(f"{name}: expected {expected} unique members, found {members}")
    return members, line_of(text, match.start())


def main() -> None:
    text = SOURCE.read_text()
    source_file = repo_path(SOURCE)

    work_kinds, work_line = literal_members(text, "AdmissionWorkKind", 4)
    priorities, priority_line = literal_members(text, "AdmissionPriority", 2)

    weight_match = re.search(
        r"AdmissionWorkKind\.\$match\(kind,\s*\{(?P<body>.*?)\n\s*\}\);",
        text,
        re.DOTALL,
    )
    if not weight_match:
        raise SystemExit("cannot find admissionTokenWeight match body")
    weight_re = re.compile(
        r'(?m)^\s*(?:"(?P<quoted>[^"]+)"|(?P<bare>[A-Za-z][A-Za-z0-9-]*)):\s*\(\)\s*=>\s*(?P<value>\d+),?'
    )
    weight_rows = []
    for match in weight_re.finditer(weight_match.group("body")):
        kind = match.group("quoted") or match.group("bare")
        kind_offset = match.start("quoted") if match.group("quoted") else match.start("bare")
        weight_rows.append(
            {
                "subject": kind,
                "predicate": "admissionTokenWeight",
                "value": int(match.group("value")),
                "value_type": "xsd:integer",
                "source": source_at(line_of(text, weight_match.start("body") + kind_offset)),
            }
        )
    if len(weight_rows) != 4 or {row["subject"] for row in weight_rows} != set(work_kinds):
        raise SystemExit(
            f"admissionTokenWeight: expected four arms matching {work_kinds}, found {weight_rows}"
        )

    parameter_rows = []
    for name, value_type in PARAM_TYPES.items():
        pattern = re.compile(
            rf"(?m)^\s*{re.escape(name)}:\s*S\.Finite\.pipe\("
            rf"S\.withConstructorDefault\(Effect\.succeed\((?P<value>-?\d+(?:\.\d+)?)\)\)\),?"
        )
        matches = list(pattern.finditer(text))
        if len(matches) != 1:
            raise SystemExit(f"{name}: expected one withConstructorDefault, found {len(matches)}")
        match = matches[0]
        lexical = match.group("value")
        value = float(lexical) if "." in lexical else int(lexical)
        parameter_rows.append(
            {
                "subject": POLICY_SUBJECT,
                "predicate": name,
                "value": value,
                "value_type": value_type,
                "source": source_at(line_of(text, match.start())),
            }
        )
    if len(parameter_rows) != 7:
        raise SystemExit(f"expected 7 S6 policy parameters, found {len(parameter_rows)}")

    dispositions = load_yaml(S5 / "DISPOSITIONS.yaml")
    s4_facts = load_yaml(S4 / "FACTS.yaml")
    selected_indexes = []
    selected_predicates = set(PARAM_TYPES) | {"admissionTokenWeight"}
    for fact_class in dispositions["fact_classes"]:
        if fact_class.get("predicate") not in selected_predicates:
            continue
        if fact_class.get("ruling") not in {"deferred-s6", "accepted-via"}:
            raise SystemExit(
                f"{fact_class.get('predicate')}: unexpected S5 ruling {fact_class.get('ruling')}"
            )
        selected_indexes.extend(fact_class.get("covers") or [])
    if len(selected_indexes) != 11 or len(set(selected_indexes)) != 11:
        raise SystemExit(f"expected 11 unique S4 comparison facts, found {selected_indexes}")

    expected_by_key = {}
    for index in sorted(selected_indexes):
        fact = s4_facts[index]
        key = (fact["subject"], fact["predicate"])
        if key in expected_by_key:
            raise SystemExit(f"duplicate S4 policy fact key {key}")
        expected_by_key[key] = (index, fact)

    drift = []
    facts = parameter_rows + weight_rows
    matched_indexes = set()
    for fact in facts:
        expected_subject = S4_WORK_SUBJECT.get(fact["subject"], fact["subject"])
        key = (expected_subject, fact["predicate"])
        expected_pair = expected_by_key.get(key)
        fact["s4_fact"] = expected_pair[0] if expected_pair else None
        fact["drift"] = False
        if expected_pair is None:
            fact["drift"] = True
            drift.append(
                {
                    "subject": fact["subject"],
                    "predicate": fact["predicate"],
                    "s4_fact": None,
                    "expected": None,
                    "actual": {"value": fact["value"], "value_type": fact["value_type"]},
                    "ruling_ref": None,
                }
            )
            continue
        index, expected = expected_pair
        matched_indexes.add(index)
        expected_value = expected.get("value")
        expected_type = expected.get("value_type")
        if expected_value != fact["value"] or expected_type != fact["value_type"]:
            fact["drift"] = True
            drift.append(
                {
                    "subject": fact["subject"],
                    "predicate": fact["predicate"],
                    "s4_fact": index,
                    "expected": {"value": expected_value, "value_type": expected_type},
                    "actual": {"value": fact["value"], "value_type": fact["value_type"]},
                    "ruling_ref": None,
                }
            )
    for index in sorted(set(selected_indexes) - matched_indexes):
        expected = s4_facts[index]
        drift.append(
            {
                "subject": expected.get("subject"),
                "predicate": expected.get("predicate"),
                "s4_fact": index,
                "expected": {
                    "value": expected.get("value"),
                    "value_type": expected.get("value_type"),
                },
                "actual": None,
                "ruling_ref": None,
            }
        )

    out = {
        "generated_by": "scripts/etl_policy.py",
        "corpus_commit": corpus_commit(),
        "source_file": source_file,
        "counts": {
            "parameters": len(parameter_rows),
            "weights": len(weight_rows),
            "priorities": len(priorities),
            "work_kinds": len(work_kinds),
            "s4_comparison_facts": len(selected_indexes),
            "drift": len(drift),
        },
        "enumerations": [
            {
                "domain": "AdmissionWorkKind",
                "members": [
                    {"value": member, "source": source_at(work_line)} for member in work_kinds
                ],
            },
            {
                "domain": "AdmissionPriority",
                "members": [
                    {"value": member, "source": source_at(priority_line)} for member in priorities
                ],
            },
        ],
        "facts": facts,
        "drift": drift,
    }
    write_generated_yaml(
        S6 / "POLICY.yaml",
        out,
        "etl_policy.py",
        "Source-pinned extraction from QualityScheduler.schemas.ts at corpus_commit.",
        "Any S4/live divergence remains in drift until a steward ruling supplies ruling_ref.",
    )
    print(
        f"policy: 7 parameters / 4 weights / 2 priorities / 4 work kinds; drift: {len(drift)}"
    )


if __name__ == "__main__":
    main()
