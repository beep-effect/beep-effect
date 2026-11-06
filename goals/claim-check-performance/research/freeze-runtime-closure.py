#!/usr/bin/env python3
"""Capture and verify the installed Bun static closure without executing the runner.

Only fresh output directories are accepted. Historical freezes are inputs, never
rewritten. The archive stores exact bytes, including installed dependency inputs.
See --help for the pre-prediction verification and scratch negative proof modes.
"""
import argparse
import hashlib
import json
import os
import pathlib
import subprocess


RUNNER = "packages/law-practice/server/test/evaluation/inspection-tool.main.ts"
XML = "packages/foundation/modeling/schema/src/Xml.ts"
PACKET = "goals/claim-element-antecedent-check/research"
HERE = "goals/claim-check-performance/research/freeze-runtime-closure.py"
LIMITATIONS = [
    "Conservative installed Bun static module closure, not a trace of executed branches.",
    "Bundler and unbundled source-module evaluation may differ; external file imports are recursively expanded.",
    "Computed import/require specifiers are rejected by allowUnresolved:[]; runtime fs/network/native assets are not inferred.",
    "Bun builtins are pinned by Bun version, executable hash and platform; operating-system libraries are not archived.",
    "Dependency source bytes and resolution metadata are archived; lockfile membership alone is not treated as byte proof.",
    "Environment, process flags, operating-system libraries and arbitrary runtime file/network reads are outside this static closure.",
]
# This private build-only helper never imports/executes the evaluation entrypoint.
# Installed Bun 1.4.4 returns an object metafile. Omitting outdir keeps outputs in
# memory; write:false is also passed explicitly (not a declared BuildConfig key).
BUILD = r"""
import { isBuiltin } from 'node:module';
import { dirname, resolve } from 'node:path';
const entries = new Set([process.argv[1]]);
const rounds = [];
let result;
for (let round = 0; round < 32; round++) {
  result = await Bun.build({entrypoints:[...entries].sort(), target:'bun',
    packages:'bundle', metafile:true, allowUnresolved:[], treeShaking:false,
    ignoreDCEAnnotations:true, write:false});
  if (!result.success || !result.metafile || result.logs.length)
    throw new Error('Closure build failed or emitted diagnostics: '+result.logs.map(x=>x.message).join('; '));
  const added = [];
  for (const [file, input] of Object.entries(result.metafile.inputs)) {
    for (const edge of input.imports) {
      if (!edge.external || isBuiltin(edge.path) || edge.path.startsWith('bun:')) continue;
      // Metafiles mark some barrel exports as external even without tree shaking.
      // Resolve and expand them instead of silently treating them as builtins.
      const path = Bun.resolveSync(edge.path, dirname(resolve(file)));
      if (!entries.has(path)) { entries.add(path); added.push(path); }
    }
  }
  rounds.push({inputs:Object.keys(result.metafile.inputs).length, added:added.length});
  if (!added.length) break;
  if (round === 31) throw new Error('Closure expansion did not converge');
}
const externals = [];
for (const [file, input] of Object.entries(result.metafile.inputs)) {
  for (const edge of input.imports) if (edge.external)
    externals.push({importer:file, ...edge,
      classification:isBuiltin(edge.path)||edge.path.startsWith('bun:')?'builtin':'resolved-file'});
}
console.log(JSON.stringify({bunVersion:Bun.version, rounds, metafile:result.metafile,
  externals:externals.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}));
"""


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def run(root, *args):
    return subprocess.run(args, cwd=root, check=True, capture_output=True).stdout


def executing_bun(root):
    # PATH may select a dispatcher (for example vite-plus). Bind the executable
    # actually running Bun, not the launcher's filesystem target.
    return pathlib.Path(run(root, "bun", "--eval", "console.log(process.execPath)").decode().strip()).resolve()


def path_key(root, path):
    absolute = pathlib.Path(path)
    if not absolute.is_absolute():
        absolute = root / absolute
    # Do not resolve symlinks: logical node_modules paths remain reusable across
    # worktrees, while bytes are read from the installed target they select.
    try:
        return absolute.relative_to(root).as_posix()
    except ValueError:
        return str(absolute)


def file_at(root, path):
    return root / path  # pathlib preserves an absolute RHS.


def resolution_metadata(root, paths):
    result = set()
    for name in paths:
        parent = file_at(root, name).parent
        while parent != parent.parent:
            for leaf in ("package.json", "tsconfig.json", "bunfig.toml", "bunfig.json"):
                candidate = parent / leaf
                if candidate.is_file():
                    result.add(path_key(root, candidate))
            if parent == root:
                break
            parent = parent.parent
    # Root compiler overlays and preservation contracts may affect resolution or
    # scoring without being runtime imports. Preserve those explicitly as well.
    result.update(path_key(root, p) for p in root.glob("tsconfig*.json"))
    result.update(("bun.lock", ".bun-version", "package.json", HERE,
                   f"{PACKET}/reference-freeze.json", f"{PACKET}/positive-source-freeze.json"))
    return result


LEXICAL_ASSETS = "packages/law-practice/server/src/ClaimInspection/lexical-assets.json"


def pinned_lexical_assets(root):
    """Bind fixed installed POS/lemma assets that a JS static closure cannot infer."""
    manifest_bytes = (root / LEXICAL_ASSETS).read_bytes()
    manifest = json.loads(manifest_bytes)
    paths = {LEXICAL_ASSETS}
    inventory = []
    for package, binding in sorted(manifest.items()):
        package_file = pathlib.Path(run(root, "bun", "--eval",
            "console.log(require.resolve(process.argv[1]+'/package.json'))", package).decode().strip())
        package_root = package_file.parent
        metadata = json.loads(package_file.read_bytes())
        if metadata["version"] != binding["version"]:
            raise ValueError(f"Pinned lexical package version differs: {package}")
        for asset in sorted(binding["runtimeFiles"], key=lambda item: item["path"]):
            relative, expected = asset["path"], asset["sha256"]
            path = package_root / relative
            if sha(path.read_bytes()) != expected:
                raise ValueError(f"Pinned lexical asset hash mismatch: {package}/{relative}")
            key = path_key(root, path)
            paths.add(key)
            inventory.append({"package": package, "path": key, "relativePath": relative, "sha256": expected})
    return paths, {"manifest": LEXICAL_ASSETS, "manifestSha256": sha(manifest_bytes), "files": inventory}


def immutable_binding(path):
    return (path in ("bun.lock", ".bun-version") or path.endswith("/Structural.ts")
            or path.startswith(f"{PACKET}/") and path.endswith("freeze.json")
            or path.startswith("goals/claim-check-performance/research/")
            and any(word in pathlib.Path(path).name for word in
                    ("preservation", "usefulness", "evaluate-gates")))


def verify(root, freeze, archive=None):
    document = json.loads(freeze.read_bytes())
    expected = document["implementationDigest"]
    body = {k: v for k, v in document.items() if k != "implementationDigest"}
    if sha(canonical(body)) != expected:
        raise ValueError("Implementation manifest digest mismatch")
    runtime = document["runtimeClosure"]
    bun_path = executing_bun(root)
    if (run(root, "bun", "--version").decode().strip() != runtime["bunVersion"]
            or str(bun_path) != runtime["bunExecutablePath"]
            or sha(bun_path.read_bytes()) != runtime["bunExecutableSha256"]):
        raise ValueError("Installed Bun identity differs from the captured runtime")
    if "lexicalAssets" in runtime:
        _, actual_assets = pinned_lexical_assets(root)
        if actual_assets != runtime["lexicalAssets"]:
            raise ValueError("Pinned lexical asset inventory differs from captured activation")
    for row in document["files"]:
        data = file_at(root, row["path"]).read_bytes()
        if sha(data) != row["sha256"]:
            raise ValueError(f"Frozen file hash mismatch: {row['path']}")
        if archive is not None and (archive / "blobs" / row["sha256"]).read_bytes() != data:
            raise ValueError(f"Archived bytes mismatch: {row['path']}")
    return document


def capture(root, baseline_path, output):
    baseline_bytes = baseline_path.read_bytes()
    baseline = json.loads(baseline_bytes)
    output.mkdir(parents=True, exist_ok=False)
    first = json.loads(run(root, "bun", "--eval", BUILD, RUNNER))
    inputs = {path_key(root, p) for p in first["metafile"]["inputs"]}
    if XML not in inputs or RUNNER not in inputs:
        raise ValueError("Runtime closure omitted its entrypoint or XML decoder")
    inherited = {row["path"]: row["sha256"] for row in baseline["files"]}
    asset_paths, lexical_assets = pinned_lexical_assets(root)
    paths = inputs | set(inherited) | resolution_metadata(root, inputs) | asset_paths
    captured = {p: file_at(root, p).read_bytes() for p in sorted(paths)}
    for path, expected in inherited.items():
        if immutable_binding(path) and sha(captured[path]) != expected:
            raise ValueError(f"Original lock/version/scorer/reference binding changed: {path}")
    actual_version = run(root, "bun", "--version").decode().strip()
    if actual_version != (root / ".bun-version").read_text().strip():
        raise ValueError("Installed Bun does not match original .bun-version")
    preservation = json.loads(run(root, "python", "goals/claim-check-performance/research/verify-preservation.py"))
    if not preservation["preserved"]:
        raise ValueError("Original reference/scorer/legacy preservation check failed")
    second = json.loads(run(root, "bun", "--eval", BUILD, RUNNER))
    if canonical(first) != canonical(second):
        raise ValueError("Build closure changed during capture")
    for path, data in captured.items():
        if file_at(root, path).read_bytes() != data:
            raise ValueError(f"File changed during capture: {path}")
    bun_path = executing_bun(root)
    rows = [{"path": p, "sha256": sha(data)} for p, data in captured.items()]
    bindings = {k: v for k, v in baseline.items() if k not in ("files", "implementationDigest")}
    body = {
        "schemaVersion": "claim-performance-runtime-closure-freeze/v1",
        "purpose": "Installed Bun static runtime closure captured before prediction; historical freezes retained",
        "baselineFreezeSha256": sha(baseline_bytes),
        "baselineImplementationDigest": baseline["implementationDigest"],
        "inheritedMetadata": bindings,
        "originalPreservation": preservation,
        "runtimeClosure": {
            "lexicalAssets": lexical_assets,
            "entrypoint": RUNNER, "bunVersion": actual_version,
            "bunExecutablePath": str(bun_path),
            "bunExecutableSha256": sha(bun_path.read_bytes()),
            "platform": run(root, "bun", "--eval", "console.log(process.platform+' '+process.arch)").decode().strip(),
            "build": {"target": "bun", "packages": "bundle", "metafile": True,
                      "allowUnresolved": [], "treeShaking": False, "ignoreDCEAnnotations": True,
                      "write": False, "outdir": None},
            "inputs": sorted(inputs), "rounds": first["rounds"],
            "externals": first["externals"], "limitations": LIMITATIONS,
            "metafileSha256": sha(canonical(first["metafile"])),
        },
        "files": rows,
    }
    document = {**body, "implementationDigest": sha(canonical(body))}
    (output / "blobs").mkdir()
    for data in captured.values():
        blob = output / "blobs" / sha(data)
        if not blob.exists():
            blob.write_bytes(data)
    (output / "baseline-freeze.json").write_bytes(baseline_bytes)
    (output / "build-metafile.json").write_bytes(canonical(first["metafile"]) + b"\n")
    (output / "implementation-freeze.json").write_bytes(json.dumps(document, indent=2).encode() + b"\n")
    verify(root, output / "implementation-freeze.json", output)
    print(json.dumps({"implementationDigest": document["implementationDigest"],
                      "files": len(rows), "runtimeInputs": len(inputs), "xmlIncluded": True,
                      "archive": str(output)}, indent=2))


def negative_test(root, freeze, output):
    document = verify(root, freeze)
    output.mkdir(parents=True, exist_ok=False)
    original = next(row for row in document["files"] if row["path"] == XML)
    changed = output / "Xml.ts"
    changed.write_bytes(file_at(root, XML).read_bytes() + b"\n// scratch-only integrity mutation\n")
    binary = output / "binary-input.bin"
    binary.write_bytes(b"\x00\xff\xfe\x80runtime-closure\x00")
    # This altered path retains the captured decoder hash. The real runner must
    # reject it before any family prediction or evaluation-output creation.
    rows = [{"path": str(binary), "sha256": sha(binary.read_bytes())}]
    rows.extend({**row, "path": str(changed)} if row["path"] == XML else row for row in document["files"])
    altered = {**document, "files": rows}
    negative = output / "negative-freeze.json"
    negative.write_bytes(canonical(altered))
    env = dict(os.environ, CLAIM_IMPLEMENTATION_FREEZE=str(negative),
               CLAIM_EVALUATION_OUTPUT=str(output / "must-not-exist"))
    result = subprocess.run(["bun", RUNNER], cwd=root, env=env, capture_output=True)
    (output / "runner.log").write_bytes(result.stdout + result.stderr)
    accepted = (result.returncode != 0
                and f"Frozen file hash mismatch: {changed}".encode() in result.stderr + result.stdout)
    if not accepted or (output / "must-not-exist").exists():
        raise ValueError("Runner did not reject changed scratch decoder before predictions")
    if sha(file_at(root, XML).read_bytes()) != original["sha256"]:
        raise ValueError("Real decoder changed during negative proof")
    print(json.dumps({"rejected": True, "runnerExit": result.returncode,
                      "predictionOutputCreated": False, "actualDecoderUnchanged": True,
                      "binaryInputVerifiedBeforeDecoderRejection": True}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[3])
    parser.add_argument("--baseline", type=pathlib.Path, help="Historical implementation freeze; never modified")
    parser.add_argument("--out", type=pathlib.Path, help="Fresh exclusive archive/proof directory")
    parser.add_argument("--verify", type=pathlib.Path, help="Verify canonical digest and all current input bytes")
    parser.add_argument("--negative-test", type=pathlib.Path, help="Freeze to test via a scratch-only decoder mutation")
    args = parser.parse_args()
    root = args.root.resolve()
    if args.verify:
        document = verify(root, args.verify, args.verify.parent)
        print(json.dumps({"verified": True, "implementationDigest": document["implementationDigest"]}))
    elif args.negative_test and args.out:
        negative_test(root, args.negative_test, args.out)
    elif args.baseline and args.out:
        capture(root, args.baseline.resolve(), args.out.resolve())
    else:
        parser.error("Use --baseline/--out, --verify, or --negative-test/--out")


if __name__ == "__main__":
    main()
