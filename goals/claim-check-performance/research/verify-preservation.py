#!/usr/bin/env python3
"""Verify immutable legacy evidence and, optionally, paired exact-match retention."""
import argparse
import hashlib
import json
import pathlib
import sys


# Independent trust anchor for the accepted location exception. Updating an
# active runner and its self-reported hash must not revise the accepted bytes.
ACCEPTED_LOCATION_ADDENDUM_SHA256 = "e2d34b95219944018752ead10fc4b474fad7cf0ebfbd68fca754ba51219dae13"
ACCEPTED_METADATA_ADDENDUM_SHA256 = "33fc639ccf32784a26f9e6c5f100fcbd4bb4cfa0225d09d3f59c95505762dab2"
METADATA_ORIGINAL = "goals/claim-element-antecedent-check/ops/manifest.json"
METADATA_ARCHIVE = "goals/claim-check-performance/research/legacy-protocol/claim-element-antecedent-manifest.json.txt"


def generated_metadata(root, manifest):
    """Admit one exact historical archive and one exact generated active version."""
    if METADATA_ORIGINAL not in manifest:
        return {}
    raw = (root / "goals/claim-check-performance/research/preservation-generated-metadata-addendum.json").read_bytes()
    if hashlib.sha256(raw).hexdigest() != ACCEPTED_METADATA_ADDENDUM_SHA256:
        raise ValueError("Generated metadata addendum differs from independently accepted digest")
    rows = json.loads(raw)["mappings"]
    if len(rows) != 1:
        raise ValueError("Only the named generated manifest may be archived")
    row = rows[0]
    if (row["originalPath"] != METADATA_ORIGINAL or row["archivePath"] != METADATA_ARCHIVE
            or row["historicalSha256"] != manifest[METADATA_ORIGINAL]
            or row["onlyGeneratedField"] != "researchReports"):
        raise ValueError("Generated metadata mapping differs from original manifest")
    original = (root / METADATA_ARCHIVE).read_bytes()
    active = (root / METADATA_ORIGINAL).read_bytes()
    if (hashlib.sha256(original).hexdigest() != row["historicalSha256"]
            or hashlib.sha256(active).hexdigest() != row["activeSha256"]):
        raise ValueError("Historical or active generated metadata digest mismatch")
    before, after = json.loads(original), json.loads(active)
    if {k: v for k, v in before.items() if k != "researchReports"} != {
            k: v for k, v in after.items() if k != "researchReports"}:
        raise ValueError("Active manifest changed a non-generated field")
    research = root / "goals/claim-element-antecedent-check/research"
    projection = sorted("research/" + p.name for p in research.iterdir()
                        if p.is_file() and not p.name.startswith("."))
    if after.get("researchReports") != projection:
        raise ValueError("Active manifest differs from native research directory projection")
    return {METADATA_ORIGINAL: METADATA_ARCHIVE}


def verify(root, freeze, result=None):
    # Only these historical runner locations may be remapped. The original
    # manifest remains unchanged; references, scorer and results cannot move.
    names = ("allowed", "iprally-smoke", "positive")
    expected = {
        f"packages/law-practice/server/test/evaluation/{name}.main.ts":
        f"goals/claim-check-performance/research/legacy-protocol/{name}.main.ts.txt"
        for name in names
    }
    addendum_bytes = (root / "goals/claim-check-performance/research/preservation-location-addendum.json").read_bytes()
    if hashlib.sha256(addendum_bytes).hexdigest() != ACCEPTED_LOCATION_ADDENDUM_SHA256:
        raise ValueError("Preservation location addendum differs from the independently accepted digest")
    addendum = json.loads(addendum_bytes)
    mappings = addendum["mappings"]
    mapped = {row["originalPath"]: row for row in mappings}
    if len(mapped) != len(mappings) or set(mapped) != set(expected):
        raise ValueError("Only the three named historical runners may be relocated")
    manifest = {row["path"]: row["sha256"] for row in freeze["files"]}
    metadata = generated_metadata(root, manifest)
    for original, archive in expected.items():
        row = mapped[original]
        if row["archivePath"] != archive or row["historicalSha256"] != manifest[original]:
            raise ValueError("Historical runner mapping differs from original manifest")
    changed = []
    active_runners = []
    for row in freeze["files"]:
        path = row["path"]
        artifact = root / (metadata[path] if path in metadata else expected[path] if path in expected else path)
        if not artifact.is_file() or hashlib.sha256(artifact.read_bytes()).hexdigest() != row["sha256"]:
            changed.append(path)
        if path in mapped:
            active = root / path
            digest = hashlib.sha256(active.read_bytes()).hexdigest() if active.is_file() else None
            active_runners.append({"path": path, "sha256": digest})
            if digest != mapped[path]["activeSha256"]:
                changed.append(f"active-runner:{path}")
    gates = root / "goals/claim-check-performance/research/usefulness-gates.json"
    canonical = json.dumps(json.loads(gates.read_text()), sort_keys=True, separators=(",", ":")).encode()
    if hashlib.sha256(canonical).hexdigest() != freeze["usefulnessGatesCanonicalSha256"]:
        changed.append("goals/claim-check-performance/research/usefulness-gates.json")
    lost = []
    matches = None
    if result is not None:
        rows = [(family["familyId"], claim) for family in result["families"] for claim in family["claims"]]
        identities = [(family, claim["claimNumber"]) for family, claim in rows]
        if len(rows) != 538 or len(set(identities)) != 538:
            raise ValueError("Evaluation must account for all 538 unique selected claims")
        baseline = json.loads((root / freeze["legacyResult"]).read_text())
        selected = {(family["familyId"], claim["claimNumber"])
                    for family in baseline["families"] for claim in family["claims"]}
        if set(identities) != selected:
            raise ValueError("Selected family/claim identities differ from the frozen legacy cohort")
        passed = {(family, claim["claimNumber"]) for family, claim in rows if claim["strict"] is True}
        expected = {(row["familyId"], row["claimNumber"]) for row in freeze["passingClaims"]}
        lost = [f"{family}:{claim}" for family, claim in sorted(expected - passed)]
        matches = len(passed)
    return {"filesChecked": len(freeze["files"]), "originalPathFilesChecked": len(freeze["files"]) - 3 - len(metadata),
            "historicalRunnerArtifactsChecked": 3, "historicalGeneratedMetadataArtifactsChecked": len(metadata),
            "activeRunners": active_runners, "changed": changed,
            "passingClaimsProtected": len(freeze["passingClaims"]), "lost": lost,
            "strictMatches": matches, "retentionEvaluated": result is not None,
            "preserved": not changed and not lost}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--result", type=pathlib.Path)
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parents[3]
    freeze = json.loads(pathlib.Path(__file__).with_name("preservation-freeze.json").read_text())
    result = json.loads(args.result.read_text()) if args.result else None
    report = verify(root, freeze, result)
    print(json.dumps(report, indent=2))
    return 0 if report["preserved"] else 1


if __name__ == "__main__":
    sys.exit(main())
