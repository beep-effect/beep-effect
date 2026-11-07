"""Original eyecite missing-page short-form observations; BSD-2-Clause."""
import argparse
import hashlib
import json
from pathlib import Path
import platform
import subprocess

import eyecite
from eyecite import get_citations

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
root = Path(eyecite.__file__).resolve().parent.parent
assert subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip() == PIN
assert not subprocess.check_output(["git", "-C", str(root), "status", "--porcelain", "--untracked-files=no"], text=True).strip()
assert platform.python_version() == "3.11.15"
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
cases = []
for text in ["576 U.S., at ___", "576 U.S., at ___, 13"]:
    citations = get_citations(text)
    cases.append({"input": text, "citations": [{
        "kind": type(citation).__name__, "groups": citation.groups,
        "metadata": vars(citation.metadata), "span": citation.span(),
        "fullSpan": citation.full_span(), "spanWithPincite": citation.span_with_pincite(),
        "matchedText": citation.matched_text(),
    } for citation in citations]})
result = {
    "schemaVersion": "citation-short-missing-page/v1", "oracleCommit": PIN,
    "license": "BSD-2-Clause", "python": platform.python_version(),
    "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "sourceSha256": {name: hashlib.sha256((root / name).read_bytes()).hexdigest()
                     for name in ["eyecite/models.py", "eyecite/find.py", "eyecite/regexes.py"]},
    "cases": cases,
}
args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
