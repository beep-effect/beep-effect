"""Owned Linux user-unit adapter lifecycle shared by real cache experiments.

Only the caller's fresh unit and process handles are eligible for cleanup.
Credential input crosses an anonymous pipe and is never written into arguments,
unit properties or an environment file. These checks do not grant producer trust.
"""

import hashlib
import http.client
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import time
import uuid

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def user_manager_env(env):
    runtime = os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}")
    return {
        **env,
        "XDG_RUNTIME_DIR": runtime,
        "DBUS_SESSION_BUS_ADDRESS": os.environ.get(
            "DBUS_SESSION_BUS_ADDRESS", f"unix:path={runtime}/bus"
        ),
    }


def stop_owned_adapters(processes, units):
    failures = 0
    for unit in units:
        try:
            stopped = subprocess.run(
                ["systemctl", "--user", "stop", unit],
                env=user_manager_env(os.environ),
                capture_output=True,
                timeout=15,
            )
            if stopped.returncode:
                loaded = subprocess.check_output(
                    ["systemctl", "--user", "show", unit, "-p", "LoadState", "--value"],
                    env=user_manager_env(os.environ),
                    text=True,
                    timeout=10,
                ).strip()
                if loaded != "not-found":
                    raise AssertionError("Owned adapter unit could not be stopped")
            state = subprocess.check_output(
                ["systemctl", "--user", "show", unit, "-p", "ActiveState", "--value"],
                env=user_manager_env(os.environ),
                text=True,
                timeout=10,
            ).strip()
            if state not in ("inactive", "failed"):
                raise AssertionError("Owned adapter unit remained active after cleanup")
            subprocess.run(
                ["systemctl", "--user", "reset-failed", unit],
                env=user_manager_env(os.environ),
                capture_output=True,
                timeout=10,
            )
        except (AssertionError, OSError, subprocess.SubprocessError):
            failures += 1
    for process in processes:
        try:
            if process.poll() is None:
                process.terminate()
        except ProcessLookupError:
            pass
        except OSError:
            failures += 1
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            failures += 1
            try:
                process.kill()
                process.wait(timeout=5)
            except (OSError, subprocess.SubprocessError):
                failures += 1
        except OSError:
            failures += 1
    if failures:
        raise AssertionError(
            f"Owned adapter cleanup failed in {failures} operation(s); every resource was attempted"
        )


def runtime_observation(
    unit, role, phase, expected_digest, expected_keys, port=None, expected_pid=None
):
    def property_value(name):
        return subprocess.check_output(
            ["systemctl", "--user", "show", unit, "-p", name, "--value"],
            env=user_manager_env(os.environ),
            text=True,
            timeout=10,
        ).strip()

    pid = int(property_value("MainPID"))
    cgroup = property_value("ControlGroup")
    if (
        pid <= 0
        or (expected_pid is not None and pid != expected_pid)
        or not cgroup.startswith("/user.slice/")
        or not cgroup.endswith("/" + unit)
    ):
        raise AssertionError("Runtime proof did not identify its owned adapter cgroup")
    process_root = Path("/proc") / str(pid)
    if digest(process_root / "exe") != expected_digest:
        raise AssertionError("The resource unit did not execute the reviewed adapter")
    if port is not None:
        sockets = set()
        for descriptor in (process_root / "fd").iterdir():
            try:
                target = os.readlink(descriptor)
            except FileNotFoundError:
                continue
            if target.startswith("socket:["):
                sockets.add(target[8:-1])
        address = "0100007F:" + format(port, "04X")
        listeners = (
            row.split()
            for row in (process_root / "net/tcp").read_text().splitlines()[1:]
        )
        if not any(
            row[1] == address and row[3] == "0A" and row[9] in sockets
            for row in listeners
        ):
            raise AssertionError("The owned adapter does not hold its loopback listener")
    keys = {
        entry.split(b"=", 1)[0].decode()
        for entry in (process_root / "environ").read_bytes().split(b"\0")
        if entry
    }
    if (
        keys != set(expected_keys)
        or "TURBO_REMOTE_CACHE_SIGNATURE_KEY" in keys
        or any(key.startswith("OP_") for key in keys)
    ):
        raise AssertionError(
            "The backend inherited environment outside its explicit fixture allowlist"
        )
    group = Path("/sys/fs/cgroup") / cgroup.lstrip("/")
    quota, period = (int(value) for value in (group / "cpu.max").read_text().split())
    memory = int((group / "memory.max").read_text())
    tasks = int((group / "pids.max").read_text())
    if memory != 256 * 1024 * 1024 or quota != 2 * period or tasks != 16:
        raise AssertionError(
            "The actual adapter resource envelope differs from the requested caps"
        )
    if (
        property_value("RuntimeMaxUSec") != "10min"
        or property_value("TimeoutStopUSec") != "10s"
        or property_value("KillMode") != "control-group"
    ):
        raise AssertionError("The actual adapter lifetime or stop envelope differs from its requested caps")
    names = [
        (task / "comm").read_text().strip()
        for task in (Path("/proc") / str(pid) / "task").iterdir()
    ]
    actix = sum("actix" in name or "arbiter" in name for name in names)
    tokio = sum("tokio" in name for name in names)
    if actix != 3 or not 2 <= tokio <= 8 or len(names) > 12:
        raise AssertionError("The adapter did not preserve its fixed worker envelope")
    return {
        "role": role,
        "phase": phase,
        "actixThreadsIncludingAcceptor": actix,
        "tokioNamedThreadsIncludingBlocking": tokio,
        "totalThreads": len(names),
        "memoryMaxBytes": memory,
        "cpuQuotaMicros": quota,
        "cpuPeriodMicros": period,
        "tasksMax": tasks,
        "runtimeMaxSeconds": 600,
        "stopTimeoutSeconds": 10,
        "memoryPeakBytes": int((group / "memory.peak").read_text()),
        "reviewedExecutable": True,
        "ownedLoopbackListener": port is not None,
        "sameProcess": expected_pid is not None,
        "explicitEnvironmentOnly": True,
        "passed": True,
    }


def start_owned_adapter(adapter, expected_digest, env, work, output, processes, units):
    """Start one reviewed adapter in the caller's cleanup scope, then prove readiness.

    The caller must install its exhaustive finalizer before calling this function.
    Handles are registered before each operation that may fail. A missing user
    manager is an error; this route never falls back to an unbounded process.
    """
    adapter = Path(adapter).resolve(strict=True)
    environment = dict(env)
    port = int(environment["PORT"])
    role = environment["BEEP_CACHE_ACCESS_ROLE"]
    allowed = {
        "PATH", "HOME", "LANG", "HOST", "PORT", "TOKIO_WORKER_THREADS",
        "S3_ENDPOINT", "S3_REGION", "S3_BUCKET_NAME", "S3_USE_PATH_STYLE",
        "S3_ACCESS_KEY", "S3_SECRET_KEY", "TURBO_TOKEN", "BEEP_CACHE_POLICY",
        "BEEP_CACHE_NAMESPACE", "BEEP_CACHE_ACCESS_ROLE", "OTEL_SDK_DISABLED",
        "OTEL_EXPORTER_OTLP_ENDPOINT", "RUST_LOG", "SSL_CERT_FILE", "SSL_CERT_DIR",
        "RUNNER_TRACKING_ID",
    }
    if (
        not adapter.is_file()
        or not os.access(adapter, os.X_OK)
        or digest(adapter) != expected_digest
        or environment["HOST"] != "127.0.0.1"
        or not 1024 <= port <= 65535
        or environment["BEEP_CACHE_POLICY"] != "signed-v1"
        or role not in ("reader", "writer")
        or not set(environment) <= allowed
        or Path(environment["HOME"]).resolve() != Path(work).resolve()
    ):
        raise AssertionError("Owned adapter input differs from its bounded signed profile")
    configuration = json.dumps({"adapter": str(adapter), "env": environment}).encode()
    if len(configuration) > 32768:
        raise AssertionError("Owned adapter startup input exceeds its bound")
    unit = f"beep-cache-owned-{uuid.uuid4().hex[:12]}-{role}.service"
    manager = user_manager_env({"PATH": "/usr/bin", "HOME": str(work)})
    loaded = subprocess.check_output(
        ["systemctl", "--user", "show", unit, "-p", "LoadState", "--value"],
        env=manager,
        text=True,
        timeout=10,
    ).strip()
    if loaded != "not-found":
        raise AssertionError("Owned adapter unit already exists")
    # Python isolated mode and execve prevent user-manager environment/preload
    # inheritance. The bounded pipe carries credentials, never argv or a file.
    launcher = (
        "import json, os, sys\n"
        "payload = sys.stdin.buffer.read(32769)\n"
        "if len(payload) > 32768: raise SystemExit(78)\n"
        "config = json.loads(payload)\n"
        "os.execve(config['adapter'], [config['adapter']], config['env'])\n"
    )
    units.append(unit)
    process = subprocess.Popen(
        [
            "systemd-run",
            "--user",
            "--quiet",
            "--wait",
            "--pipe",
            f"--unit={unit}",
            "--service-type=exec",
            f"--working-directory={work}",
            "--property=MemoryMax=256M",
            "--property=CPUQuota=200%",
            "--property=TasksMax=16",
            "--property=RuntimeMaxSec=600",
            "--property=TimeoutStopSec=10",
            "--property=KillMode=control-group",
            sys.executable,
            "-I",
            "-c",
            launcher,
        ],
        cwd=work,
        env=manager,
        stdin=subprocess.PIPE,
        stdout=output,
        stderr=subprocess.STDOUT,
    )
    processes.append(process)
    try:
        process.stdin.write(configuration)
        process.stdin.close()
    except (BrokenPipeError, OSError):
        raise AssertionError("Owned adapter refused its private startup input") from None
    for _ in range(100):
        if process.poll() is not None:
            raise AssertionError("Owned adapter exited before readiness")
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=1)
        try:
            connection.request("GET", "/management/health")
            ready = connection.getresponse().status == 200
        except (OSError, http.client.HTTPException):
            ready = False
        finally:
            connection.close()
        if ready:
            pid = int(
                subprocess.check_output(
                    ["systemctl", "--user", "show", unit, "-p", "MainPID", "--value"],
                    env=manager,
                    text=True,
                    timeout=10,
                ).strip()
            )
            observation = runtime_observation(
                unit, role, "ready", expected_digest, set(environment), port, pid
            )
            return unit, pid, observation
        time.sleep(0.05)
    raise AssertionError("Owned adapter did not become ready")


def run_owned_host():
    """Serve one fixed ready/verify/stop exchange over the owning parent's pipes."""
    processes, units = [], []
    completed = False

    def emit(status, observation=None):
        value = {"status": status}
        if observation is not None:
            value["observation"] = observation
        print(json.dumps(value), flush=True)

    def interrupted(*_):
        raise InterruptedError("Owning parent interrupted the adapter host")

    for name in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(name, interrupted)
    try:
        payload = sys.stdin.buffer.readline(32770)
        if not payload.endswith(b"\n") or len(payload) > 32769:
            raise AssertionError("Owned host input exceeds its frame bound")
        config = json.loads(payload)
        if set(config) != {"adapter", "sha256", "env"}:
            raise AssertionError("Owned host configuration differs from its fixed fields")
        environment = config["env"]
        unit, pid, observation = start_owned_adapter(
            config["adapter"], config["sha256"], environment, Path.cwd(),
            subprocess.DEVNULL, processes, units,
        )
        emit("ready", observation)
        # Commands are tiny fixed words. They carry no report or attestation
        # supplied by the task, and cannot extend the adapter's 600-second cap.
        deadline = time.monotonic() + 600
        for expected in (b"verify\n", b"stop\n"):
            while True:
                if time.monotonic() >= deadline or processes[0].poll() is not None:
                    raise AssertionError("Owned backend stopped before the parent completed")
                readable, _, _ = select.select([sys.stdin.buffer], [], [], 0.1)
                if readable:
                    command = sys.stdin.buffer.readline(8)
                    break
            if command != expected:
                raise AssertionError("Owned host command differs from its fixed sequence")
            if expected == b"verify\n":
                emit("after-load", runtime_observation(
                    unit, environment["BEEP_CACHE_ACCESS_ROLE"], "after-load",
                    config["sha256"], set(environment), int(environment["PORT"]), pid,
                ))
        completed = True
    finally:
        stop_owned_adapters(processes, units)
    if completed:
        emit("cleaned")


if __name__ == "__main__":
    try:
        if sys.argv[1:] != ["owned-host"]:
            raise AssertionError("Expected the owned-host operation")
        run_owned_host()
    except BaseException as error:
        # Neither configuration nor raw subprocess output belongs in diagnostics.
        print(f"Owned adapter host failed ({type(error).__name__}).", file=sys.stderr)
        raise SystemExit(78) from None

