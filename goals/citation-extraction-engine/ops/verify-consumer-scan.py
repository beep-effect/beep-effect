"""Prove the migration scanner detects eight import/export use forms."""
import argparse
import json
from pathlib import Path
import subprocess
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--typescript-module", type=Path, required=True)
    parser.add_argument("--scratch-root", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    scanner = root / "goals/citation-extraction-engine/ops/scan-citation-consumers.mjs"
    target = root / f"packages/law-practice/use-cases/src/internal/citation-consumer-control-{uuid.uuid4().hex}.ts"
    text = '''import { CitationBase as ImportedBase, ReviewItem } from "@beep/law-practice-domain";
import * as Domain from "@beep/law-practice-domain";
import DefaultDomain from "@beep/law-practice-domain";
export * from "@beep/law-practice-domain";
type Reference = import("@beep/law-practice-domain").Citation;
const selected = Domain.FullCaseCitation;
const escaped = Domain;
const dynamic = require("@beep/law-practice-domain");
const moduleName = "@beep/law-practice-domain";
'''
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    result_file = args.scratch_root / "p1-consumer-control.json"
    try:
        with target.open("x") as file:
            file.write(text)
        run = subprocess.run(["bun", "run", str(scanner), str(args.typescript_module), str(result_file)], cwd=root,
                             capture_output=True, text=True, timeout=180)
        if run.returncode:
            raise SystemExit("consumer control scan failed")
        report = json.loads(result_file.read_text())
        rows = [row for row in report["findings"] if row["path"] == str(target.relative_to(root))]
        required = {"named-import", "default-import-review", "wildcard-export-review", "namespace-member", "namespace-escape-review", "dynamic-module-review", "import-type-review", "module-string-review"}
        if not required.issubset({row["kind"] for row in rows}) or any(not row["production"] for row in rows):
            raise SystemExit("consumer use form escaped detection")
        if any(row["symbol"] == "ReviewItem" for row in rows):
            raise SystemExit("unrelated import incorrectly classified")
        print("eight positive use-form controls and unrelated-import rejection passed")
    finally:
        if target.exists() and target.read_text() == text:
            target.unlink()
    clean = subprocess.run(["bun", "run", str(scanner), str(args.typescript_module), str(args.scratch_root / "p1-consumer-scan.json")],
                           cwd=root, capture_output=True, text=True, timeout=180)
    if clean.returncode:
        raise SystemExit("clean consumer scan failed")
    print(clean.stdout.strip())


if __name__ == "__main__":
    main()
