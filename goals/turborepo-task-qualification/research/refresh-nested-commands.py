"""Resolve bounded local script aliases from a retained census, without execution."""
import argparse
import hashlib
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("census", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
census = json.loads(args.census.read_text())
workspaces = {workspace["name"]: workspace["scripts"] for workspace in census["workspaces"]}
definitions = {}


def resolve(workspace, script):
    identifier = workspace + "#" + script
    if identifier in definitions:
        return identifier
    command = workspaces[workspace][script]
    definition = {"id": identifier, "command": command, "steps": []}
    definitions[identifier] = definition
    # This is deliberately not a shell interpreter. Quoting, substitution,
    # redirection, directory changes and other operators need separate review.
    segments = command.split(" && ")
    if any(not re.fullmatch(r"[A-Za-z0-9_./:@=*,+ -]+", segment)
           or segment.startswith("cd ") for segment in segments):
        definition["steps"].append({"kind": "uninterpreted-shell", "command": command})
        return identifier
    for segment in segments:
        match = re.fullmatch(r"bun run (?:(--if-present) )?([A-Za-z0-9_:-]+)", segment)
        if not match:
            definition["steps"].append({"kind": "terminal-command", "command": segment})
            continue
        optional, target = match.groups()
        if target not in workspaces[workspace]:
            definition["steps"].append({"kind": "absent-optional-script" if optional else "unresolved-script-or-binary",
                                        "command": segment, "name": target})
            continue
        definition["steps"].append({"kind": "local-script", "command": segment,
                                    "target": resolve(workspace, target), "optional": bool(optional)})
    return identifier


roots = []
for node in census["nodes"]:
    if "command" not in node:
        continue
    assert workspaces[node["workspace"]][node["task"]] == node["command"]
    roots.append({"computation": node["id"], "definition": resolve(node["workspace"], node["task"])})
assert len({root["computation"] for root in roots}) == len(roots)
cycles = set()


def visit(identifier, ancestors):
    if identifier in ancestors:
        cycles.add(tuple(ancestors[ancestors.index(identifier):] + [identifier]))
        return
    for step in definitions[identifier]["steps"]:
        if step["kind"] == "local-script":
            visit(step["target"], ancestors + [identifier])


for root in roots:
    visit(root["definition"], [])
counts = {}
for definition in definitions.values():
    for step in definition["steps"]:
        counts[step["kind"]] = counts.get(step["kind"], 0) + 1
report = {
    "schemaVersion": "cache-nested-script-review/v1",
    "authority": "Static local manifest references only. No shell execution, runtime semantic closure, or qualification.",
    "censusSha256": hashlib.sha256(args.census.read_bytes()).hexdigest(),
    "recipeSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "rootCount": len(roots),
    "definitionCount": len(definitions),
    "stepCounts": counts,
    "roots": roots,
    "definitions": sorted(definitions.values(), key=lambda definition: definition["id"]),
    "cycles": sorted(cycles),
    "limits": ["AND-chain steps are static possibilities, not evidence that every step executes.",
               "Only argument-free local bun run aliases are expanded; forwarded arguments and binaries remain terminal commands.",
               "Environment, shell expansion, tool behavior and fresh external verdicts need their own semantic review."],
}
args.output.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({key: report[key] for key in ["rootCount", "definitionCount", "stepCounts", "cycles"]}))
