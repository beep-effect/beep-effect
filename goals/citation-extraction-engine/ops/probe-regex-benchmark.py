"""Measure synthetic geometric controls in serialized, owned Node/Bun children."""
import argparse
import hashlib
import json
from pathlib import Path
import platform
import statistics
import subprocess


def sha(value):
    return hashlib.sha256(value).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", type=Path, required=True)
    parser.add_argument("--bun", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    plan_file = Path(__file__).with_name("regex-benchmark-plan.json")
    plan = json.loads(plan_file.read_text())
    child_file = Path(__file__).with_name("regex-benchmark-control.child.mjs")
    runs = []
    for runtime, executable in [("node", args.node), ("bun", args.bun)]:
        for control in ["safe-linear", "catastrophic-backtracking"]:
            rows, breaches, previous, decision = [], 0, None, "accepted"
            for size in plan["controlSizes"]:
                child = subprocess.Popen([str(executable), str(child_file), control, str(size)], stdin=subprocess.DEVNULL,
                                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, env={})
                try:
                    stdout, stderr = child.communicate(timeout=plan["controlWatchdogMillis"] / 1000)
                    if child.returncode != 0 or stderr:
                        raise RuntimeError("benchmark child did not complete cleanly")
                    lines = stdout.decode().splitlines()
                    if len(lines) != 2 or lines[0] != "started":
                        raise RuntimeError("benchmark child protocol mismatch")
                    sample = json.loads(lines[1])
                    if sample["control"] != control or sample["size"] != size or sample["matched"] != (control == "safe-linear"):
                        raise RuntimeError("benchmark control did not exercise the expected match")
                    samples = sample["samplesNanos"]
                    if len(samples) != plan["repetitions"] or any(value <= 0 for value in samples):
                        raise RuntimeError("invalid measured samples")
                    median = statistics.median(samples)
                    breaches = breaches + 1 if previous is not None and median / previous > plan["ratioThreshold"] else 0
                    previous = median
                    rows.append({"size": size, "outcome": "measured", "sample": sample, "exitCode": 0, "exitConfirmed": True})
                    if breaches >= plan["consecutiveBreaches"]:
                        decision = "rejected-scaling"
                        break
                except subprocess.TimeoutExpired:
                    child.kill()
                    stdout, stderr = child.communicate(timeout=plan["cleanupMillis"] / 1000)
                    if child.returncode != -9 or not stdout.decode().startswith("started\n"):
                        raise RuntimeError("control did not enter matching or cleanup was not confirmed")
                    rows.append({"size": size, "outcome": "deadline", "exitSignal": "SIGKILL", "exitConfirmed": True})
                    decision = "rejected-deadline"
                    break
                finally:
                    if child.poll() is None:
                        child.kill()
                        child.wait(timeout=plan["cleanupMillis"] / 1000)
            if (control == "safe-linear") != (decision == "accepted"):
                raise RuntimeError("benchmark control decision was unexpected")
            runs.append({"runtimeKind": runtime, "control": control, "decision": decision, "rows": rows})
    cpu_lines = [line.split(":", 1)[1].strip() for line in Path("/proc/cpuinfo").read_text().splitlines() if line.startswith("model name")]
    report = {"schemaVersion":"citation-regex-benchmark-controls/v1", "scope":"Synthetic linear/catastrophic controls only; no oracle family approval.",
              "planSha256":sha(plan_file.read_bytes()), "parentSha256":sha(Path(__file__).read_bytes()), "childSha256":sha(child_file.read_bytes()),
              "python":platform.python_version(), "platform":platform.system(), "architecture":platform.machine(), "cpuModel":cpu_lines[0],
              "watchdogScope":"Child lifetime including startup; regex samples exclude startup.", "runs":runs}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print("Synthetic benchmark controls passed for Node and Bun; every owned child exit confirmed.")


if __name__ == "__main__":
    main()
