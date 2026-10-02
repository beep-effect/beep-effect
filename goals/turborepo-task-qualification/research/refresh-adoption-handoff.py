"""Build the public adoption population from a fresh census and reviewed boundaries.

This joins observations and classifications; it never runs inventoried commands,
approves evidence, changes a ledger, or renews native qualification.
"""
import argparse
import collections
import hashlib
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
RESEARCH = Path(__file__).resolve().parent


def read(path):
    return json.loads(path.read_text())


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def reference(path):
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def write(path, value):
    text = json.dumps(value, indent=2) + "\n"
    assert "/home/" not in text and ".beep/qualification-signed-implementation" not in text
    path.write_text(text)


def validate_sources(rows):
    for row in rows:
        path = ROOT / row["path"]
        assert path.resolve().is_relative_to(ROOT), row["path"]
        assert reference(path)["sha256"] == row["sha256"], f"Source binding changed: {row['path']}"


def site_set(commands):
    return {(site["definition"], site["step"], command["command"])
            for command in commands for site in command["sites"]}


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("census", type=Path, help="Fresh output from beep cache census --output")
parser.add_argument("--output", type=Path, default=RESEARCH / "adoption")
args = parser.parse_args()
output = args.output.resolve()
assert output.is_relative_to(ROOT)
output.mkdir(parents=True, exist_ok=True)
census = read(args.census)
validate_sources(census["sources"])
census_path = output / "census.json"
assert "/home/" not in args.census.read_text()
census_path.write_bytes(args.census.read_bytes())

recipes = [RESEARCH / "refresh-nested-commands.py", RESEARCH / "refresh-command-boundaries.py"]
nested_path = output / "nested-commands.json"
boundary_path = output / "command-boundaries.json"
subprocess.run([sys.executable, str(recipes[0]), str(census_path), str(nested_path)], check=True, cwd=ROOT)
subprocess.run([sys.executable, str(recipes[1]), str(nested_path), str(boundary_path)], check=True, cwd=ROOT)
nested, boundaries = read(nested_path), read(boundary_path)
profiles = read(output / "semantic-boundary-profiles.json")
assert digest(boundaries["commands"]) == profiles["reviewedCommandInventorySha256"], "Command review needs renewal"
assert {row["id"] for row in profiles["profiles"]} == set(boundaries["familyStepCounts"])

shell = read(output / "shell-boundary-review.json")
terminal = read(output / "terminal-boundary-review.json")
dispatch = read(output / "dynamic-dispatch-review.json")
validate_sources(terminal["sources"])
validate_sources(dispatch["sources"])
assert site_set(shell["commands"]) == site_set([row for row in boundaries["commands"] if row["family"] == "shell-expression"])
expected_file_sites = site_set([row for row in boundaries["commands"] if row["family"] == "file-entrypoint"])
assert {(row["definition"], row["step"], row["command"]) for row in terminal["fileEntrypointSites"]} == expected_file_sites
for family, field in [("external-tool", "externalToolCommands"), ("python-tool", "pythonCommands")]:
    assert site_set(terminal[field]) == site_set([row for row in boundaries["commands"] if row["family"] == family])

baseline_path = ROOT / "standards/cache-qualification-baseline.json"
ledger_path = ROOT / "standards/cache-qualification.json"
baseline, ledger = read(baseline_path), read(ledger_path)
profile, epoch, layer = baseline["profile"], baseline["epoch"], "turbo-task-result"
states = {entry["key"]["computation"]: entry["status"] for entry in ledger["entries"]
          if entry["key"]["profile"] == profile and entry["key"]["epoch"] == epoch and entry["key"]["layer"] == layer}
families = {row["computation"]: row["families"] for row in boundaries["roots"]}
configurations, rows = {}, []
for node in census["nodes"]:
    config_id = digest(node["configuration"])
    configurations[config_id] = node["configuration"]
    executable = "command" in node
    row = {"computation": node["id"], "execution": "executable" if executable else "graph-only",
           "configurationId": config_id, "dependencies": node["dependencies"],
           "semanticProfileIds": families.get(node["id"], [])}
    assert bool(row["semanticProfileIds"]) == executable
    if executable:
        row.update(command=node["command"], commandDigest=node["commandDigest"],
                   observedInputCount=node["inputCount"], observedInputsDigest=node["inputsDigest"],
                   qualification=states.get(node["id"], {"state": "unassessed"}))
    rows.append(row)

signed_path = RESEARCH / "current-signed-qualification.json"
signed = read(signed_path)
assert signed["status"] == "qualified" and signed["acceptanceBlockers"] == 0 and signed["auditBlockingFindings"] == 0
counts = {"workspaces": len(census["workspaces"]), "graphNodes": len(rows), "executable": len(families),
          "graphOnly": len(rows) - len(families), "definitions": nested["definitionCount"],
          "nestedSteps": nested["stepCounts"], "semanticFamilies": len(profiles["profiles"]),
          "baseProfileStates": dict(collections.Counter(row["qualification"]["state"] for row in rows if "qualification" in row)),
          "legacyCacheEnabled": sum(node["configuration"]["cache"] for node in census["nodes"] if "command" in node)}
population = {"schemaVersion": "cache-adoption-population/v1", "sourceCheckpoint": census["revision"],
              "authority": "Observed graph and reviewed semantic boundaries; only the separate native receipt establishes pilot qualification.",
              "tupleContext": {"layer": layer, "profile": profile, "epoch": epoch}, "counts": counts,
              "census": reference(census_path), "baseline": reference(baseline_path), "ledger": reference(ledger_path),
              "qualifiedPilot": {"receipt": reference(signed_path), "sourceRevision": signed["sourceRevision"], "key": signed["key"]},
              "configurations": configurations, "semanticProfiles": profiles["profiles"], "rows": rows,
              "adoptionObligations": boundaries["families"],
              "limits": ["Graph-only rows are not executable tuples.",
                         "Unassessed legacy cache settings are not qualification.",
                         "Conditional semantic inputs require cohort-specific closure before reuse.",
                         "The native receipt retains its frozen source; this refresh does not renew runtime evidence."]}
write(output / "population.json", population)

artifact_names = ["census.json", "nested-commands.json", "command-boundaries.json", "population.json",
                  "semantic-boundary-profiles.json", "shell-boundary-review.json", "dynamic-dispatch-review.json",
                  "terminal-boundary-review.json"]
write(output / "manifest.json", {
    "schemaVersion": "cache-adoption-bundle/v1", "sourceCheckpoint": census["revision"], "counts": counts,
    "recipes": [reference(path) for path in [*recipes, Path(__file__).resolve()]],
    "artifacts": [reference(output / name) for name in artifact_names],
    "checked": ["Current census source bindings", "Exact reviewed command inventory", "Complete semantic family coverage",
                "Every shell and special terminal site", "Current dynamic and terminal source bindings",
                "Graph-only separation", "Observed-profile ledger join", "Unmodified native receipt authority"],
})
print(json.dumps(counts, sort_keys=True))
