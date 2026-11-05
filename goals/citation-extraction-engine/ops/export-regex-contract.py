"""Generate exact-size synthetic inputs and the complete regex obligation sets."""
import argparse
import hashlib
import json
from pathlib import Path


def sha(value):
    return hashlib.sha256(value).hexdigest()


def utf16(value):
    return len(value.encode("utf-16-le")) // 2


def build(size, seed, suffix):
    remaining = size - utf16(suffix)
    if remaining < 0 or not seed:
        raise RuntimeError("invalid adversarial recipe")
    body, index = [], 0
    while remaining:
        point = seed[index % len(seed)]
        units = utf16(point)
        if units > remaining:
            point, units = "a", 1
        body.append(point)
        remaining -= units
        index += 1
    return "".join(body) + suffix


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    plan_file = Path(__file__).with_name("regex-benchmark-plan.json")
    plan = json.loads(plan_file.read_text())
    if plan["sizes"] != [8 * 2 ** index for index in range(10)] or len(plan["recipes"]) != 12:
        raise RuntimeError("unexpected corpus geometry")
    regex_file = root / "packages/law-practice/use-cases/test/fixtures/eyecite/regex-inventory.json"
    regex = json.loads(regex_file.read_text())
    controls = root / "goals/citation-extraction-engine/history/evidence/regex-benchmark-controls.json"
    cases = []
    for recipe in plan["recipes"]:
        for size in plan["sizes"]:
            text = build(size, recipe["seed"], recipe["suffix"])
            if utf16(text) != size:
                raise RuntimeError("adversarial input size mismatch")
            cases.append({"id": f"{recipe['id']}@{size}", "recipeId": recipe["id"], "size":size,
                          "text":text, "inputSha256":sha(text.encode())})
    projection = json.dumps({"families":[{"id":row["id"], "form":row["form"]} for row in regex["families"]],
        "extractorInstances":[{key:row[key] for key in ["id", "artifactSha256", "index", "patternSha256", "flags", "constructor"]} for row in regex["extractorInstances"]]}, sort_keys=True, separators=(",", ":"))
    output = {"schemaVersion":"citation-regex-benchmark-contract/v1", "scope":plan["scope"],
              "commit":regex["source"]["commit"], "tree":regex["source"]["tree"],
              "oracleLicense":regex["source"]["license"],
              "syntheticLicense":{"id":"Apache-2.0", "path":"LICENSE", "sha256":sha((root / "LICENSE").read_bytes())},
              "generatorSha256":sha(Path(__file__).read_bytes()), "planSha256":sha(plan_file.read_bytes()),
              "sourceProjection":projection, "sourceProjectionSha256":sha(projection.encode()), "controlsSha256":sha(controls.read_bytes()),
              "cases":cases}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"Regex contract: {len(cases)} exact UTF-16 inputs, {len(regex['families'])} families, {len(regex['extractorInstances'])} instances; no family approval.")


if __name__ == "__main__":
    main()
