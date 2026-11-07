/** Public bounded Linux peer observer, executed only by the owned Effect process boundary. */
export const coworkPeerSource = String.raw`"""Pinned, isolated Linux metadata reader owning one private Unix listener.

The callback body is read and projected transiently, never retained.
No argv, foreign environment, auth, transcript or process memory is read.
The caller-side fixed hook checks only its own public local-agent selector.
This receiver independently requires its enrolled app generation and engine ancestry.
The parent supplies public enrollment policy on stdin; stdout is transient
projected lifecycle and kernel metadata, never a caller verification flag.
"""
import hashlib
import json
import os
from pathlib import Path
import signal
import socket
import stat
import struct
import sys
import time


def reject():
    raise ValueError("kernel-binding")


def bounded_json():
    raw = sys.stdin.buffer.readline(16385)
    if len(raw) > 16384:
        reject()
    return json.loads(raw)


def identity(value):
    return (value.st_dev, value.st_ino, value.st_uid, value.st_gid, value.st_mode,
            value.st_size, value.st_mtime_ns, value.st_ctime_ns)


def public_digest(filename, maximum):
    if os.path.realpath(filename) != filename:
        reject()
    fd = os.open(filename, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_mode & 0o022 or before.st_size > maximum:
            reject()
        result = hashlib.sha256()
        remaining = maximum + 1
        while remaining:
            body = os.read(fd, min(65536, remaining))
            if not body:
                break
            result.update(body)
            remaining -= len(body)
        if remaining == 0 or identity(os.fstat(fd)) != identity(before):
            reject()
        return result.hexdigest(), identity(before)
    finally:
        os.close(fd)


def process(pid, expected_uid):
    root = Path("/proc") / str(pid)
    with (root / "stat").open("r") as handle:
        raw = handle.read(4097)
    if len(raw) > 4096:
        reject()
    fields = raw[raw.rfind(")") + 2:].split()
    with (root / "status").open("r") as handle:
        status = handle.read(16385)
    if len(status) > 16384:
        reject()
    uid_line = next(line for line in status.splitlines() if line.startswith("Uid:"))
    if any(int(value) != expected_uid for value in uid_line.split()[1:]):
        reject()
    return {"pid": pid, "parentPid": int(fields[1]), "startTicks": fields[19],
            "executable": os.readlink(root / "exe"), "cwd": os.readlink(root / "cwd")}


def observe(connection, policy):
    pid, uid, _ = struct.unpack("3i", connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
    if uid != os.getuid() or pid <= 1:
        reject()
    peer = process(pid, uid)
    current = peer
    ancestry = [peer]
    runtime = None
    for _ in range(8):
        if runtime is None and current["cwd"] == policy["workspace"] and current["executable"] == policy["runtimeExecutable"]:
            runtime = current
        if runtime is not None and current["pid"] == policy["appPid"] and current["startTicks"] == policy["appStartTicks"] and current["executable"] == policy["appExecutable"]:
            if any(process(entry["pid"], uid) != entry for entry in ancestry):
                reject()
            return {"peerPid": peer["pid"], "peerStartTicks": peer["startTicks"],
                    "runtimePid": runtime["pid"], "runtimeStartTicks": runtime["startTicks"],
                    "runtimeSha256": policy["runtimeSha256"], "cwd": policy["workspace"],
                    "appPid": current["pid"], "appStartTicks": current["startTicks"], "uid": uid}
        if current["parentPid"] <= 1:
            reject()
        current = process(current["parentPid"], uid)
        ancestry.append(current)
    reject()


active_socket = None


def terminate(_signal, _frame):
    # A controlled parent failure unwinds the exact-owned socket finalizer.
    raise SystemExit(2)


signal.signal(signal.SIGTERM, terminate)


def serve():
    global active_socket
    policy = bounded_json()
    pinned = {}
    for pin in policy["sourcePins"] + [
            {"path": policy["runtimeExecutable"], "sha256": policy["runtimeSha256"]},
            {"path": policy["appExecutable"], "sha256": policy["appSha256"]}]:
        digest, verified_identity = public_digest(pin["path"], 536870912)
        if (digest != pin["sha256"] or os.path.realpath(pin["path"]) != pin["path"] or
                identity(os.stat(pin["path"], follow_symlinks=False)) != verified_identity):
            reject()
        pinned[pin["path"]] = verified_identity
    if os.path.realpath(policy["workspace"]) != policy["workspace"]:
        reject()
    path = sys.argv[1]
    parent = os.path.dirname(path)
    info = os.lstat(parent)
    if (os.path.realpath(parent) != parent or not stat.S_ISDIR(info.st_mode) or
            info.st_uid != os.getuid() or info.st_mode & 0o077 or
            len(os.fsencode(path)) > 107 or os.path.lexists(path)):
        reject()
    with socket.socket(socket.AF_UNIX) as server:
        server.settimeout(policy["listenMillis"] / 1000)
        server.bind(path)
        os.chmod(path, 0o600)
        active_socket = (path, identity(os.lstat(path)))
        server.listen(1)
        print('{"ready":true}', flush=True)
        with server.accept()[0] as connection:
            deadline = time.monotonic() + 1.2
            connection.settimeout(1.2)
            peer = observe(connection, policy)
            raw = bytearray()
            while len(raw) <= 8192:
                chunk = connection.recv(min(1024, 8193 - len(raw)))
                if not chunk:
                    break
                raw.extend(chunk)
            if len(raw) > 8192:
                reject()
            body = json.loads(raw)
            native = body.get("callback", {})
            projected = {"occurrenceId": body.get("occurrenceId"), "selector": body.get("selector"),
                         "callback": {key: native[key] for key in ("hook_event_name", "session_id", "source", "reason") if key in native}}
            if any(identity(os.stat(path, follow_symlinks=False)) != value for path, value in pinned.items()):
                reject()
            if time.monotonic() >= deadline:
                reject()
            connection.settimeout(max(0.001, deadline - time.monotonic()))
            print(json.dumps({"peer": peer, "callback": projected}, separators=(",", ":")), flush=True)
            acknowledgement = sys.stdin.buffer.readline(1025)
            if not acknowledgement.endswith(b"\n") or len(acknowledgement) > 1024:
                reject()
            connection.sendall(acknowledgement)


try:
    serve()
except Exception:
    # No exception messages, callback bodies, or native process values are logged.
    sys.exit(2)
finally:
    if active_socket is not None:
        try:
            path, expected = active_socket
            current = os.lstat(path)
            if stat.S_ISSOCK(current.st_mode) and current.st_uid == os.getuid() and identity(current) == expected:
                os.unlink(path)
        except OSError:
            pass
`;
