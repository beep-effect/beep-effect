/** Public bounded Linux peer observer, executed only by the owned Effect process boundary. */
export const cursorPeerSource = String.raw`"""Pinned, isolated Linux metadata reader owning one private Unix listener.

The callback body is read and projected transiently, never retained.
No argv, environment, auth, transcript or process memory is read.
The parent supplies public enrollment policy on stdin; stdout is transient
projected lifecycle and kernel metadata, never a caller verification flag.
"""
import hashlib
import json
import os
from pathlib import Path
import socket
import stat
import struct
import sys


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
        return result.hexdigest()
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
    workspace = policy["workspace"]
    if os.path.realpath(workspace) != workspace:
        reject()
    for pin in policy["sourcePins"]:
        if public_digest(pin["path"], 8388608) != pin["sha256"]:
            reject()
    peer = process(pid, uid)
    current = peer
    ancestry = [peer]
    for _ in range(4):
        if current["cwd"] == workspace and current["executable"] == policy["runtimeExecutable"]:
            if public_digest(current["executable"], 268435456) != policy["runtimeSha256"]:
                reject()
            if any(process(entry["pid"], uid) != entry for entry in ancestry):
                reject()
            return {"peerPid": peer["pid"], "peerStartTicks": peer["startTicks"],
                    "runtimePid": current["pid"], "runtimeStartTicks": current["startTicks"],
                    "runtimeSha256": policy["runtimeSha256"], "cwd": workspace,
                    "uid": uid}
        if current["parentPid"] <= 1:
            reject()
        current = process(current["parentPid"], uid)
        ancestry.append(current)
    reject()


def serve():
    policy = bounded_json()
    path = sys.argv[1]
    parent = os.path.dirname(path)
    info = os.lstat(parent)
    if (os.path.realpath(parent) != parent or not stat.S_ISDIR(info.st_mode) or
            info.st_uid != os.getuid() or info.st_mode & 0o077 or
            len(os.fsencode(path)) > 107 or os.path.lexists(path)):
        reject()
    with socket.socket(socket.AF_UNIX) as server:
        server.settimeout(5)
        server.bind(path)
        os.chmod(path, 0o600)
        server.listen(1)
        print('{"ready":true}', flush=True)
        with server.accept()[0] as connection:
            connection.settimeout(5)
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
            keys = ("hook_event_name", "cursor_version", "session_id", "conversation_id",
                    "generation_id", "is_background_agent", "reason", "final_status", "duration_ms",
                    "model", "model_id")
            projected = {key: body[key] for key in keys if key in body}
            if isinstance(body.get("model_params"), list):
                projected["model_params"] = [{key: item[key] for key in ("id", "value") if key in item}
                    for item in body["model_params"][:16] if isinstance(item, dict)]
            print(json.dumps({"peer": peer, "callback": projected}, separators=(",", ":")), flush=True)
            acknowledgement = sys.stdin.buffer.readline(1025)
            if not acknowledgement.endswith(b"\n") or len(acknowledgement) > 1024:
                reject()
            connection.sendall(acknowledgement)
    os.unlink(path)


try:
    serve()
except Exception:
    # No exception messages, callback bodies, or native process values are logged.
    sys.exit(2)
`;
