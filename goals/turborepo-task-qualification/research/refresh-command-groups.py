"""Group exact census command strings; does not execute or qualify any command."""
import argparse
import collections
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("census", type=Path)
parser.add_argument("--output", type=Path, default=Path(__file__).with_name("command-groups.json"))
args = parser.parse_args()
census = json.loads(args.census.read_text())


def groups(rows):
    grouped = collections.defaultdict(list)
    for computation, command in rows:
        grouped[command].append(computation)
    return [
        {"command": command, "count": len(ids), "computations": sorted(ids)}
        for command, ids in sorted(grouped.items())
    ]


report = {
    "schemaVersion": "cache-command-groups/v1",
    "authority": "Exact manifest strings; semantic review and runtime observation remain separate obligations. No qualification granted.",
    "censusSha256": hashlib.sha256(args.census.read_bytes()).hexdigest(),
    "executions": groups((node["id"], node["command"]) for node in census["nodes"] if "command" in node),
    "wrapperDefinitions": groups(
        (workspace["name"] + "#" + key, command)
        for workspace in census["workspaces"]
        for key, command in workspace["scripts"].items()
        if key.startswith("beep:")
    ),
    "rootScripts": census["rootScripts"],
}
args.output.write_text(
    json.dumps(report, separators=(",", ":"), sort_keys=True) + "\n"
)
