"""chain_digest — deterministic digest helper for adversary review bindings
(beep-ci-ops §4b normalization).

Computes, for one proposal file: target_sha256 (the proposal file's bytes) and
chain_sha256 (the FRAMED closure digest the gate recomputes: OTP + its
IdentityCard + FoundationalAnalysis + DenotationHypothesis files plus every
SO/PO record the hypothesis cites, sorted by FILENAME, each member hashed as
"<filename>\n<byte-length>\n" + bytes, plus the trailing virtual member
"cq:<cq_suite sha256_12>\n" from the run manifest).

This is orchestration tooling, not judgment: the adversary seat authors the
review VERDICTS; this script only fills the two binding digests.

Usage: python chain_digest.py <otp-file.yaml> [more otp files...]
Prints one line per proposal: <otp-id> <target_sha256> <chain_sha256>
"""

import hashlib
import sys
from pathlib import Path

import yaml

ONT = Path(__file__).resolve().parent.parent
WORK = ONT / "work"


def load(p: Path) -> dict:
    return yaml.safe_load(p.read_text())


def main() -> None:
    manifest = load(WORK / "run-manifest.yaml")
    cq12 = manifest["cq_suite"]["sha256_12"]

    ic_paths = {}
    fa_by_icr = {}
    for f in (WORK / "foundational").glob("ic-*.yaml"):
        ic_paths[load(f)["id"]] = f
    for f in (WORK / "foundational").glob("fa-*.yaml"):
        fa_by_icr[load(f)["identity_card_ref"]] = f
    dh_paths = {}
    for f in (WORK / "hypotheses").glob("dh-*.yaml"):
        dh_paths[load(f)["id"]] = f
    obs_paths = {}
    for sub in ("observations", "prose-observations"):
        for f in (WORK / sub).glob("*.yaml"):
            obs_paths[load(f)["id"]] = f

    for arg in sys.argv[1:]:
        p = Path(arg)
        d = load(p)
        target = hashlib.sha256(p.read_bytes()).hexdigest()
        chain_files = [p]
        icr, hyp = d.get("identity_card_ref"), d.get("hypothesis_ref")
        for x in (ic_paths.get(icr), dh_paths.get(hyp), fa_by_icr.get(icr)):
            if x:
                chain_files.append(x)
        dh = load(dh_paths[hyp]) if hyp in dh_paths else {}
        for ref in dh.get("observation_refs") or []:
            op = obs_paths.get(ref)
            if op:
                chain_files.append(op)
        h = hashlib.sha256()
        for cf in sorted(chain_files, key=lambda x: Path(x).name):
            data = Path(cf).read_bytes()
            h.update(f"{Path(cf).name}\n{len(data)}\n".encode())
            h.update(data)
        h.update(f"cq:{cq12}\n".encode())
        print(f"{d.get('id')} {target} {h.hexdigest()}")


if __name__ == "__main__":
    main()
