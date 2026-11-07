#!/usr/bin/env python3
"""Isolated I/O adapter for CacheLocalPilotSummary; never publishes a private receipt."""
import argparse
import hashlib
import json
import os
import re
import resource
import stat
import sys

REPORT_LIMIT = 16 * 1024 * 1024
SUMMARY_LIMIT = 64 * 1024


def require(condition, code):
    if not condition:
        raise ValueError(code)


def read_regular(path, limit):
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb") as handle:
        before = os.fstat(handle.fileno())
        require(stat.S_ISREG(before.st_mode) and 0 < before.st_size <= limit, "input-bound")
        raw = handle.read(before.st_size + 1)
        after = os.fstat(handle.fileno())
        identity = lambda info: (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)
        require(len(raw) == before.st_size and identity(before) == identity(after), "input-changed")
        return raw


def summarize(report_raw, request_raw, revision, channel, computation):
    require(re.fullmatch(r"[a-f0-9]{40}", revision) is not None, "source-identity")
    require(channel in ("stable", "canary"), "channel")
    require(computation in ("@beep/identity#lint", "@beep/types#lint"), "computation")
    report, request = json.loads(report_raw), json.loads(request_raw)
    require(report["schemaVersion"] == "cache-pilot-local/v5", "receipt-version")
    require(report["authority"] == "local-observation-only", "receipt-authority")
    require(report["sourceRevision"] == revision, "receipt-source")
    require(report["channel"] == request["channel"] == channel, "receipt-channel")
    require(report["key"]["computation"] == computation, "receipt-computation")
    require(report["client"] == request["client"], "receipt-client")
    client = report["client"]
    require(re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:-canary\.[0-9]+)?", client["version"]) is not None, "client-version")
    require(re.fullmatch(r"[a-f0-9]{64}", client["sha256"]) is not None, "client-digest")
    require(client["namespace"] == "team_beep_local_observation_v1", "local-namespace")
    require(request["selection"] == report["selection"] == "full", "full-selection")
    checks = report["checks"]
    require(type(checks) is list and 0 < len(checks) <= 1024, "check-bound")
    failed = []
    for check in checks:
        require(type(check["passed"]) is bool, "check-result")
        require(type(check["name"]) is str and 0 < len(check["name"]) <= 1024, "check-label-bound")
        if not check["passed"]:
            # Even a synthetic secret used as a label never reaches public output.
            failed.append(hashlib.sha256(check["name"].encode()).hexdigest())
    counts = {"checks": len(checks), "failedChecks": len(failed)}
    for field in ("runs", "mutations", "nonExecutions"):
        require(type(report[field]) is list and len(report[field]) <= 1024, "observation-bound")
        counts[field] = len(report[field])
    require(bool(failed) or all(counts[field] > 0 for field in ("runs", "mutations", "nonExecutions")), "empty-full-observation")
    return {
        "schemaVersion": "cache-local-observation-summary/v1",
        "authority": "local-observation-only",
        "sourceRevision": revision,
        "channel": channel,
        "computation": computation,
        "client": {"version": client["version"], "sha256": client["sha256"]},
        "privateReceipt": {"bytes": len(report_raw), "sha256": hashlib.sha256(report_raw).hexdigest()},
        "counts": counts,
        "allChecksPassed": not failed,
        "failedLabelSha256": failed[:64],
        "omittedFailedLabels": max(0, len(failed) - 64),
        "qualificationGranted": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("report", "request", "output", "revision", "channel", "computation"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    try:
        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
        report = read_regular(args.report, REPORT_LIMIT)
        request = read_regular(args.request, SUMMARY_LIMIT)
        summary = summarize(report, request, args.revision, args.channel, args.computation)
        encoded = (json.dumps(summary, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode()
        require(len(encoded) <= SUMMARY_LIMIT, "summary-bound")
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as handle:
            handle.write(encoded)
    except (OSError, ValueError, TypeError, KeyError, MemoryError, RecursionError):
        # Do not print paths, field values, payloads or exception representations.
        print("Local observation summary refused invalid or unbounded input.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
