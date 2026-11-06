#!/usr/bin/env python3
"""Observe package-level differences without changing the approved tree digest.

This credential-free research observer consumes the same canonical GNU tar
stream as Cache.dependencies.ts. It never extracts or publishes file payloads.
Two sequential reads must match each other and the selected source report.
The result is diagnostic evidence only, never producer approval.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import resource
import selectors
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time


ARTIFACT_LIMIT = 4 * 1024 * 1024
STREAM_LIMIT = 6 * 1024 * 1024 * 1024
ENTRY_LIMIT = 600_000
GROUP_LIMIT = 4096
HEADER_LIMIT = 64 * 1024
DEADLINE_SECONDS = 300
HEX64 = re.compile(r"[a-f0-9]{64}")
SAFE_LABEL = re.compile(r"[A-Za-z0-9@._+~%/=-]{1,180}")
TAR_ARGS = [
    "/usr/bin/tar", "--sort=name", "--format=posix", "--mtime=@0",
    "--owner=0", "--group=0", "--numeric-owner", "--hard-dereference",
    "--pax-option=exthdr.name=%d/PaxHeaders/%f,delete=atime,delete=ctime",
    "-C", ".", "-cf", "-", "--", "node_modules",
]


class Refusal(Exception):
    """Carry only a fixed, non-sensitive diagnostic code."""


def require(condition, code):
    if not condition:
        raise Refusal(code)


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def read_source(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as handle:
        info = os.fstat(handle.fileno())
        require(stat.S_ISREG(info.st_mode), "source-not-regular")
        require(0 < info.st_size < ARTIFACT_LIMIT, "source-size-bound")
        data = handle.read(ARTIFACT_LIMIT)
        require(len(data) == info.st_size, "source-read-drift")
    return data


def memory_location(trace):
    """Retain a fixed module family and line, never paths, messages or locals."""
    while trace.tb_next is not None:
        trace = trace.tb_next
    module = trace.tb_frame.f_globals.get("__name__")
    components = {
        "__main__": "observer",
        "dependency_diagnostics": "observer",
        "tarfile": "tarfile",
        "pathlib": "pathlib",
        "json": "json",
        "json.decoder": "json",
        "json.encoder": "json",
    }
    component = components.get(module, "unknown") if isinstance(module, str) else "unknown"
    return {"component": component, "line": trace.tb_lineno} if component != "unknown" else {"component": "unknown"}


class LimitedTarInfo(tarfile.TarInfo):
    def _proc_pax(self, archive):
        require(self.size <= HEADER_LIMIT, "archive-header-bound")
        return super()._proc_pax(archive)

    def _proc_gnulong(self, archive):
        require(self.size <= HEADER_LIMIT, "archive-header-bound")
        return super()._proc_gnulong(archive)


class Stream:
    """Hash raw archive bytes, including padding, with bounded timed reads."""

    def __init__(self, pipe, deadline):
        self.pipe = pipe
        self.deadline = deadline
        self.digest = hashlib.sha256()
        self.bytes = 0
        self.selector = selectors.DefaultSelector()
        self.selector.register(pipe, selectors.EVENT_READ)

    def read(self, size):
        remaining = self.deadline - time.monotonic()
        require(remaining > 0, "deadline")
        require(bool(self.selector.select(remaining)), "deadline")
        data = os.read(self.pipe.fileno(), min(size, 512 * 1024))
        self.bytes += len(data)
        require(self.bytes <= STREAM_LIMIT, "archive-stream-bound")
        self.digest.update(data)
        return data

    def close(self):
        self.selector.close()


def package_group(name):
    parts = PurePosixPath(name).parts
    require(parts and parts[0] == "node_modules" and ".." not in parts, "archive-path")
    require(len(name.encode()) <= HEADER_LIMIT, "archive-path-bound")
    relative = parts[1:]
    if not relative:
        return "."
    count = 2 if relative[0] == ".bun" or relative[0].startswith("@") else 1
    return "/".join(relative[:count])


def new_group(label):
    # Unexpected names are represented by a digest, never copied into logs.
    return {
        "label": label if SAFE_LABEL.fullmatch(label) else "opaque:" + hashlib.sha256(label.encode()).hexdigest(),
        "entries": 0, "files": 0, "bytes": 0,
        "content": hashlib.sha256(), "mode": hashlib.sha256(),
        "links": hashlib.sha256(), "headers": hashlib.sha256(),
    }


def child_limits():
    resource.setrlimit(resource.RLIMIT_FSIZE, (HEADER_LIMIT, HEADER_LIMIT))


def snapshot(deadline):
    require(stat.S_ISDIR(os.lstat("node_modules").st_mode), "dependency-root-not-physical")
    groups = {}
    entries = 0
    # stderr is never printed. Its file is bounded even on pathological input.
    with tempfile.TemporaryFile() as errors:
        child = subprocess.Popen(
            TAR_ARGS, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=errors,
            env={"PATH": "/usr/bin", "HOME": "/nonexistent", "LANG": "C", "LC_ALL": "C"},
            start_new_session=True, preexec_fn=child_limits,
        )
        stream = Stream(child.stdout, deadline)
        try:
            with tarfile.open(fileobj=stream, mode="r|", tarinfo=LimitedTarInfo) as archive:
                for member in archive:
                    entries += 1
                    require(entries <= ENTRY_LIMIT, "entry-bound")
                    require(member.isdir() or member.isfile() or member.issym(), "archive-entry-type")
                    require(member.size <= STREAM_LIMIT and not member.sparse, "archive-entry-bound")
                    label = package_group(member.name)
                    if label not in groups:
                        require(len(groups) < GROUP_LIMIT, "group-bound")
                        groups[label] = new_group(label)
                    group = groups[label]
                    group["entries"] += 1
                    require(len(encoded(member.pax_headers)) <= HEADER_LIMIT, "archive-header-bound")
                    identity = encoded([member.name, member.type.decode("ascii")]) + b"\n"
                    group["mode"].update(identity + encoded(member.mode) + b"\n")
                    group["headers"].update(encoded([
                        member.name, member.type.decode("ascii"), member.size, member.mode,
                        member.uid, member.gid, member.uname, member.gname, member.mtime,
                        member.linkname, member.pax_headers,
                    ]) + b"\n")
                    if member.isfile():
                        payload = hashlib.sha256()
                        consumed = 0
                        with archive.extractfile(member) as source:
                            while chunk := source.read(512 * 1024):
                                consumed += len(chunk)
                                payload.update(chunk)
                        require(consumed == member.size, "archive-payload-truncated")
                        group["files"] += 1
                        group["bytes"] += consumed
                        group["content"].update(identity + payload.digest())
                    else:
                        group["content"].update(identity)
                    if member.issym():
                        require(len(member.linkname.encode()) <= HEADER_LIMIT, "archive-link-bound")
                        # Link text is hashed but never traversed or emitted.
                        group["links"].update(identity + encoded(member.linkname) + b"\n")
                    archive.members.clear()
            while stream.read(512 * 1024):
                pass
            remaining = deadline - time.monotonic()
            require(remaining > 0, "deadline")
            require(child.wait(timeout=remaining) == 0, "archive-command-failed")
            rows = []
            for label in sorted(groups):
                group = groups[label]
                rows.append([group["label"], group["entries"], group["files"], group["bytes"]] + [
                    group[key].hexdigest() for key in ["content", "mode", "links", "headers"]
                ])
            return {"sha256": stream.digest.hexdigest(), "archiveBytes": stream.bytes, "groups": rows}
        finally:
            stream.close()
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGKILL)
            child.wait()
            child.stdout.close()


def observe(source_path, revision):
    started = time.monotonic()
    deadline = started + DEADLINE_SECONDS
    source_bytes = read_source(source_path)
    source = json.loads(source_bytes)
    require(source["schemaVersion"] == "cache-producer-workflow/v2", "source-version")
    require(bool(re.fullmatch(r"[a-f0-9]{40}", source["revision"])), "source-revision")
    require(source["revision"] == revision, "source-revision-mismatch")
    declared = source["toolchain"]["installedDependencies"]
    require(declared["format"] == "canonical-gnu-tar/v1", "dependency-format")
    require(bool(HEX64.fullmatch(declared["sha256"])), "dependency-digest")
    first = snapshot(deadline)
    second = snapshot(deadline)
    before = {row[0]: row for row in first["groups"]}
    after = {row[0]: row for row in second["groups"]}
    changed = sorted(key for key in before.keys() | after.keys() if before.get(key) != after.get(key))
    stable = first == second
    matched = first["sha256"] == declared["sha256"]
    unchanged = source_bytes == read_source(source_path)
    report = {
        "schemaVersion": "cache-dependency-diagnostics/v1",
        "authority": "Observation only; no producer approval, qualification or digest normalization.",
        "revision": source["revision"], "sourceReportSha256": hashlib.sha256(source_bytes).hexdigest(),
        "declaredSha256": declared["sha256"],
        "status": "stable-match" if stable and matched and unchanged else "refused-drift",
        "sourceUnchanged": unchanged, "declaredDigestMatches": matched, "snapshotsEqual": stable,
        "columns": ["package", "entries", "files", "bytes", "contentSha256", "modeSha256", "linksSha256", "headersSha256"],
        "first": first,
        "second": {"sha256": second["sha256"], "archiveBytes": second["archiveBytes"],
                   "changedGroups": [[key, after.get(key)] for key in changed[:64]],
                   "changedCount": len(changed), "omittedChanges": max(0, len(changed) - 64)},
        "bounds": {"aggregateArtifactBytes": ARTIFACT_LIMIT, "archiveBytesPerPass": STREAM_LIMIT,
                   "passes": 2, "entriesPerPass": ENTRY_LIMIT, "groupsPerPass": GROUP_LIMIT,
                   "seconds": DEADLINE_SECONDS, "retentionDays": 1},
        "elapsedSeconds": round(time.monotonic() - started, 3),
    }
    result = encoded(report) + b"\n"
    require(len(source_bytes) + len(result) <= ARTIFACT_LIMIT, "aggregate-artifact-bound")
    return result, 0 if report["status"] == "stable-match" else 1


def publication_plan(source_path, diagnostic_path):
    """Select only readable regular reports whose retained bytes fit the cap."""
    sizes = []
    for path in [source_path, diagnostic_path]:
        try:
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            with os.fdopen(fd, "rb") as handle:
                info = os.fstat(handle.fileno())
                sizes.append(info.st_size if stat.S_ISREG(info.st_mode) and info.st_size > 0 else None)
        except OSError:
            sizes.append(None)
    source_size, diagnostic_size = sizes
    diagnostic = diagnostic_size is not None and diagnostic_size <= ARTIFACT_LIMIT
    source = source_size is not None and source_size <= ARTIFACT_LIMIT and (
        not diagnostic or source_size + diagnostic_size <= ARTIFACT_LIMIT
    )
    return {"source": source, "diagnostic": diagnostic}


def main():
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-report", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--publication-only", action="store_true")
    args = parser.parse_args()
    if args.publication_only:
        plan = publication_plan(args.source_report, args.output)
        for key, enabled in plan.items():
            print(f"{key}={'true' if enabled else 'false'}")
        return 0 if all(plan.values()) else 1
    # Refuse an existing output before any expensive read. Never replace evidence.
    try:
        output_fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    except OSError:
        print("Refusing existing or unavailable diagnostic output.")
        return 1
    with os.fdopen(output_fd, "wb") as output:
        code = None
        memory_context = None
        try:
            data, exit_code = observe(Path(args.source_report), args.revision)
        except Refusal as error:
            code = error.args[0]
        except MemoryError:
            code = "memory-limit"
            try:
                memory_context = {
                    "memoryLocation": memory_location(sys.exc_info()[2]),
                    "pythonVersion": list(sys.version_info[:3]),
                }
            except MemoryError:
                # A diagnostic allocation must not replace the bounded refusal.
                memory_context = None
        except subprocess.TimeoutExpired:
            code = "subprocess-deadline"
        except subprocess.SubprocessError:
            code = "subprocess-failed"
        except tarfile.TarError:
            code = "archive-read-failed"
        except OSError:
            code = "filesystem-or-process-failed"
        except (ValueError, KeyError, TypeError):
            code = "invalid-value-or-shape"
        if code is not None:
            refusal = {"schemaVersion": "cache-dependency-diagnostics/v1", "status": "refused", "code": code}
            if memory_context is not None:
                refusal.update(memory_context)
            data, exit_code = encoded(refusal) + b"\n", 1
        output.write(data)
    print("Dependency diagnostic saved." if exit_code == 0 else "Dependency diagnostic refused; no approval granted.")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
