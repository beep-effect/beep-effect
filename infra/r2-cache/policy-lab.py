#!/usr/bin/env python3
"""Exercise a reviewed adapter binary against disposable loopback Moto storage.

Requires moto[server]==5.1.15 and boto3 in the invoking Python environment.
This is component evidence, never R2 grant or deployment qualification.
"""

import argparse
import hashlib
import http.client
import json
import logging
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from urllib.parse import urlsplit

import boto3
from moto.server import DomainDispatcherApplication, create_backend_app
from werkzeug.serving import WSGIRequestHandler, make_server


class QuietHandler(WSGIRequestHandler):
    def log(self, *args, **kwargs):
        pass


class StorageFixture:
    """Count storage calls without retaining requests, headers, or payloads."""

    def __init__(self):
        self.calls = 0
        self.fail = None
        self.application = DomainDispatcherApplication(create_backend_app)
        self.server = make_server(
            "127.0.0.1", 0, self, threaded=True, request_handler=QuietHandler
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __call__(self, environ, start_response):
        self.calls += 1
        if self.fail and (
            self.fail != "metadata" or environ["REQUEST_METHOD"] == "HEAD"
        ):
            status = (
                "429 Too Many Requests"
                if self.fail == "throttle"
                else "503 Service Unavailable"
            )
            start_response(status, [("Content-Length", "0")])
            return [b""]
        return self.application(environ, start_response)

    @property
    def url(self):
        return f"http://127.0.0.1:{self.server.server_port}"

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)


def request(url, method="GET", body=None, headers=None):
    address = urlsplit(url)
    connection = http.client.HTTPConnection(address.hostname, address.port, timeout=5)
    try:
        connection.request(
            method,
            address.path + ("?" + address.query if address.query else ""),
            body=body,
            headers=headers or {},
        )
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read()
    finally:
        connection.close()


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


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
    for unit in units:
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
    for process in processes:
        if process.poll() is None:
            process.terminate()
        process.wait(timeout=10)


def runtime_observation(unit, role, phase, expected_digest, expected_keys):
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
        or not cgroup.startswith("/user.slice/")
        or not cgroup.endswith("/" + unit)
    ):
        raise AssertionError("Runtime proof did not identify its owned adapter cgroup")
    process_root = Path("/proc") / str(pid)
    if digest(process_root / "exe") != expected_digest:
        raise AssertionError("The resource unit did not execute the reviewed adapter")
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
        "memoryPeakBytes": int((group / "memory.peak").read_text()),
        "reviewedExecutable": True,
        "explicitEnvironmentOnly": True,
        "passed": True,
    }


def verify_pending_unit_cleanup():
    unit = f"beep-cache-runtime-cleanup-{uuid.uuid4().hex[:12]}.service"
    env = user_manager_env(os.environ)
    loaded = subprocess.check_output(
        ["systemctl", "--user", "show", unit, "-p", "LoadState", "--value"],
        env=env,
        text=True,
        timeout=10,
    ).strip()
    assert loaded == "not-found", "Cleanup fixture unit already exists"
    try:
        subprocess.run(
            [
                "systemd-run",
                "--user",
                "--quiet",
                "--no-block",
                f"--unit={unit}",
                "--service-type=oneshot",
                "--property=TimeoutStartSec=30",
                "/usr/bin/sleep",
                "30",
            ],
            env=env,
            capture_output=True,
            check=True,
            timeout=10,
        )
        state = subprocess.check_output(
            ["systemctl", "--user", "show", unit, "-p", "ActiveState", "--value"],
            env=env,
            text=True,
            timeout=10,
        ).strip()
        assert state == "activating", "Cleanup fixture did not enter its pending state"
    finally:
        stop_owned_adapters([], [unit])


def run(options):
    if options.runtime_envelope:
        verify_pending_unit_cleanup()
    root = Path(__file__).resolve().parents[2]
    adapter = Path(options.adapter).resolve(strict=True)
    if digest(adapter) != options.adapter_sha256:
        raise ValueError("Adapter executable does not match the reviewed digest")
    pins = json.loads(
        (
            root / "goals/turborepo-cache-conformance/research/pins-2026-10-23.json"
        ).read_text()
    )
    fixture = StorageFixture()
    fixture.thread.start()
    client = boto3.client(
        "s3",
        endpoint_url=fixture.url,
        region_name="us-east-1",
        aws_access_key_id="synthetic-storage-id",
        aws_secret_access_key="synthetic-storage-secret",
    )
    client.create_bucket(Bucket="signed-policy-lab")
    processes = []
    units = []
    runtime_rows = []
    runtime_units = {}
    runtime_keys = {}
    logs = []
    rows = []
    native_rows = []
    cache = Path.home() / ".cache/beep/turbo-r2-policy-lab/runs"
    cache.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(dir=cache) as temporary:
            work = Path(temporary)
            # An upstream dotenv reload would replace the deliberately missing
            # application configuration and emit OTEL or log files.
            trap = "SYNTHETIC_PRIVATE_DOTENV_SENTINEL"
            (work / ".env").write_text(
                f"APPLICATION_SECRET={trap}\nRUST_LOG=trace\nS3_SERVER_SIDE_ENCRYPTION={trap}\n"
            )
            launch = work / "launch"
            launch.mkdir(mode=0o700)
            launcher = launch / "adapter.py"
            launcher.write_text(
                "import json, os, sys\nwith open(sys.argv[1]) as f: c = json.load(f)\nos.execve(c['adapter'], [c['adapter']], c['env'])\n",
                encoding="utf-8",
            )
            endpoints = {}
            team = "team_beep_policy_lab_epoch_1"
            for role in ["writer", "reader"]:
                port = free_port()
                log = work / f"{role}.log"
                handle = log.open("wb")
                logs.append(handle)
                env = {
                    "PATH": os.environ["PATH"],
                    "HOME": str(work),
                    "HOST": "127.0.0.1",
                    "PORT": str(port),
                    "TOKIO_WORKER_THREADS": "2",
                    "S3_ENDPOINT": fixture.url,
                    "S3_REGION": "us-east-1",
                    "S3_BUCKET_NAME": "signed-policy-lab",
                    "S3_USE_PATH_STYLE": "true",
                    "S3_ACCESS_KEY": "synthetic-storage-id",
                    "S3_SECRET_KEY": "synthetic-storage-secret",
                    "TURBO_TOKEN": f"synthetic-{role}-bearer",
                    "BEEP_CACHE_POLICY": "signed-v1",
                    "BEEP_CACHE_NAMESPACE": team,
                    "BEEP_CACHE_ACCESS_ROLE": role,
                    "OTEL_EXPORTER_OTLP_ENDPOINT": fixture.url,
                    "RUST_LOG": "trace",
                }
                command = [str(adapter)]
                launch_env = env
                if options.runtime_envelope:
                    env["TOKIO_WORKER_THREADS"] = "not-a-count"
                    unit = (
                        f"beep-cache-runtime-lab-{uuid.uuid4().hex[:12]}-{role}.service"
                    )
                    # Only this fresh, owned unit may be stopped by the finalizer.
                    loaded = subprocess.check_output(
                        [
                            "systemctl",
                            "--user",
                            "show",
                            unit,
                            "-p",
                            "LoadState",
                            "--value",
                        ],
                        env=user_manager_env(env),
                        text=True,
                        timeout=10,
                    ).strip()
                    if loaded != "not-found":
                        raise AssertionError("Runtime lab unit already exists")
                    units.append(unit)
                    runtime_units[role] = unit
                    runtime_keys[role] = set(env)
                    configuration = launch / f"{role}.json"
                    configuration.write_text(
                        json.dumps({"adapter": str(adapter), "env": env}),
                        encoding="utf-8",
                    )
                    configuration.chmod(0o600)
                    # An exec boundary clears the user manager's inherited environment.
                    # Configuration contains only the lab's synthetic credentials.
                    command = [
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
                        sys.executable,
                        str(launcher),
                        str(configuration),
                    ]
                    launch_env = user_manager_env(env)
                process = subprocess.Popen(
                    command,
                    cwd=work,
                    env=launch_env,
                    stdout=handle,
                    stderr=subprocess.STDOUT,
                )
                processes.append(process)
                endpoint = f"http://127.0.0.1:{port}"
                for _ in range(100):
                    if process.poll() is not None:
                        handle.flush()
                        captured = log.read_bytes()
                        override_panic = (
                            b"TOKIO_WORKER_THREADS" in captured
                            and b"must be usize" in captured
                        )
                        failure = {
                            "exitCode": process.returncode,
                            "outputBytes": len(captured),
                            "outputSha256": hashlib.sha256(captured).hexdigest(),
                            "runtimeOverrideDiagnostic": override_panic,
                        }
                        Path(options.output).with_suffix(
                            ".startup-failure.json"
                        ).write_text(json.dumps(failure, indent=2) + "\n")
                        if override_panic:
                            raise AssertionError(
                                "Ambient worker configuration overrode the runtime startup boundary"
                            )
                        raise AssertionError(
                            "Adapter exited before readiness; startup fixture was not qualified"
                        )
                    try:
                        if request(endpoint + "/management/health")[0] == 200:
                            break
                    except OSError:
                        time.sleep(0.05)
                else:
                    raise AssertionError("Adapter did not become ready")
                endpoints[role] = endpoint
                if options.runtime_envelope:
                    runtime_rows.append(
                        runtime_observation(
                            runtime_units[role],
                            role,
                            "ready",
                            options.adapter_sha256,
                            runtime_keys[role],
                        )
                    )

            # Dotenv must not turn a legacy process into a signed process after
            # its strict-mode/telemetry decision. Only the refused process sees it.
            policy_trap = work / "dotenv-policy-trap"
            policy_trap.mkdir()
            (policy_trap / ".env").write_text(
                f"BEEP_CACHE_POLICY=signed-v1\nBEEP_CACHE_NAMESPACE={team}\n"
                f"BEEP_CACHE_ACCESS_ROLE=writer\nAPPLICATION_SECRET={trap}\n",
                encoding="utf-8",
            )
            legacy_env = {
                key: value
                for key, value in env.items()
                if not key.startswith("BEEP_CACHE_")
            }
            legacy_env["PORT"] = str(free_port())
            legacy_env["TOKIO_WORKER_THREADS"] = "2"
            refused = subprocess.run(
                [str(adapter)],
                cwd=policy_trap,
                env=legacy_env,
                capture_output=True,
                timeout=5,
            )
            startup_passed = (
                refused.returncode != 0
                and refused.stdout == b""
                and b"Cache policy must be provided before process startup"
                in refused.stderr
                and len(refused.stderr) < 512
                and trap.encode() not in refused.stderr
            )
            if not startup_passed:
                raise AssertionError(
                    "Dotenv changed the signed-policy startup boundary"
                )
            startup_controls = [
                {
                    "case": "dotenv-policy-rejected-before-telemetry",
                    "passed": True,
                    "exitCode": refused.returncode,
                    "stdoutBytes": len(refused.stdout),
                    "boundedStaticDiagnostic": True,
                }
            ]

            path = "/v8/artifacts/0123456789abcdef"
            query = f"?teamId={team}"
            for name, role, method, suffix, auth, tag, expected, code in [
                (
                    "missing-auth",
                    "reader",
                    "GET",
                    path + query,
                    False,
                    False,
                    401,
                    "authentication-denied",
                ),
                (
                    "reader-put",
                    "reader",
                    "PUT",
                    path + query,
                    True,
                    True,
                    403,
                    "write-denied",
                ),
                (
                    "unsigned-put",
                    "writer",
                    "PUT",
                    path + query,
                    True,
                    False,
                    400,
                    "signature-missing",
                ),
                (
                    "foreign-tenant",
                    "writer",
                    "GET",
                    path + "?teamId=team_foreign_secret",
                    True,
                    False,
                    403,
                    "tenant-denied",
                ),
                (
                    "old-epoch",
                    "reader",
                    "GET",
                    path + "?teamId=team_beep_policy_lab_epoch_0",
                    True,
                    False,
                    403,
                    "tenant-denied",
                ),
                (
                    "duplicate-selector",
                    "reader",
                    "GET",
                    path + query + "&slug=private-selector",
                    True,
                    False,
                    400,
                    "selector-invalid",
                ),
                (
                    "encoded-selector",
                    "reader",
                    "GET",
                    path + query + "%2fescape",
                    True,
                    False,
                    400,
                    "selector-invalid",
                ),
                (
                    "encoded-artifact",
                    "reader",
                    "GET",
                    "/v8/artifacts/%30%31" + query,
                    True,
                    False,
                    404,
                    "route-invalid",
                ),
                (
                    "delete-denied",
                    "writer",
                    "DELETE",
                    path + query,
                    True,
                    False,
                    405,
                    "method-denied",
                ),
                (
                    "missing-selector",
                    "reader",
                    "GET",
                    path,
                    True,
                    False,
                    400,
                    "selector-invalid",
                ),
                (
                    "status-selector",
                    "reader",
                    "GET",
                    "/v8/artifacts/status",
                    True,
                    False,
                    400,
                    "selector-invalid",
                ),
            ]:
                headers = (
                    {"Authorization": f"Bearer synthetic-{role}-bearer"} if auth else {}
                )
                if tag:
                    headers["x-artifact-tag"] = "synthetic-opaque-tag"
                before = fixture.calls
                status, metadata, body = request(
                    endpoints[role] + suffix, method, headers=headers
                )
                safe = all(
                    secret.encode() not in body
                    for secret in [
                        trap,
                        "synthetic-reader-bearer",
                        "synthetic-writer-bearer",
                        "synthetic-opaque-tag",
                        "private-selector",
                        "team_foreign_secret",
                    ]
                )
                passed = (
                    status == expected
                    and metadata.get("x-beep-cache-result") == code
                    and fixture.calls == before
                    and safe
                )
                rows.append(
                    {
                        "case": name,
                        "status": status,
                        "result": metadata.get("x-beep-cache-result"),
                        "storageCalls": fixture.calls - before,
                        "passed": passed,
                    }
                )
                if not passed:
                    raise AssertionError(f"Wire denial failed: {name}")

            headers = {
                "Authorization": "Bearer synthetic-writer-bearer",
                "x-artifact-tag": "synthetic-opaque-tag",
                "x-artifact-duration": "1234",
            }
            assert (
                request(
                    endpoints["writer"] + path + query,
                    "PUT",
                    b"synthetic-payload",
                    headers,
                )[0]
                == 201
            )
            for method in ["GET", "HEAD"]:
                status, metadata, body = request(
                    endpoints["reader"] + path + query,
                    method,
                    headers={"Authorization": "Bearer synthetic-reader-bearer"},
                )
                assert (
                    status == 200
                    and metadata["x-artifact-tag"] == "synthetic-opaque-tag"
                )
                assert metadata["x-artifact-duration"] == "1234"
                assert body == (b"synthetic-payload" if method == "GET" else b"")
                rows.append({"case": f"metadata-{method.lower()}", "passed": True})

            for name, failure, method, expected, code in [
                ("metadata-unavailable", "metadata", "GET", 503, "backend-unavailable"),
                (
                    "storage-unavailable",
                    "unavailable",
                    "GET",
                    500,
                    "backend-unavailable",
                ),
                ("ambiguous-upload", "unavailable", "PUT", 500, "write-ambiguous"),
                ("storage-throttled-read", "throttle", "GET", 429, "throttled"),
                ("storage-throttled-write", "throttle", "PUT", 429, "throttled"),
            ]:
                fixture.fail = failure
                before = fixture.calls
                status, metadata, body = request(
                    endpoints["writer"] + path + query,
                    method,
                    b"synthetic-payload" if method == "PUT" else None,
                    headers,
                )
                passed = (
                    status == expected
                    and metadata.get("x-beep-cache-result") == code
                    and fixture.calls > before
                )
                rows.append(
                    {
                        "case": name,
                        "status": status,
                        "result": metadata.get("x-beep-cache-result"),
                        "storageCalls": fixture.calls - before,
                        "passed": passed,
                    }
                )
                if not passed:
                    raise AssertionError(f"Storage result attribution failed: {name}")
            fixture.fail = None

            # Both exact native clients must restore an upload from this actual
            # adapter and reject bad HMAC metadata before declared output appears.
            for pin in pins["clients"]:
                binary = (
                    Path.home()
                    / ".cache/beep/turbo-cache-lab/clients"
                    / pin["version"]
                    / "turbo"
                )
                if digest(binary) != pin["executableSha256"]:
                    raise ValueError("Native client pin mismatch")
                native = work / pin["channel"]
                native.mkdir()
                (native / "package.json").write_text(
                    json.dumps(
                        {
                            "name": "policy-lab",
                            "private": True,
                            "packageManager": "bun@1.4.4",
                            "scripts": {"build": "bun build.ts"},
                        }
                    )
                )
                (native / "build.ts").write_text(
                    'if(Bun.env.PROBE_DENY_EXECUTION==="1")process.exit(42);\nawait Bun.write("dist/result.txt","signed-adapter-output\\n");\n'
                )
                (native / "turbo.json").write_text(
                    json.dumps(
                        {
                            "remoteCache": {"signature": True},
                            "tasks": {
                                "build": {
                                    "outputs": ["dist/**"],
                                    "passThroughEnv": ["PROBE_DENY_EXECUTION"],
                                }
                            },
                        }
                    )
                )
                key = "synthetic-artifact-signing-key-at-least-32-bytes"
                saved = None
                for case in [
                    "producer",
                    "replay",
                    "wrong-key",
                    "missing-tag",
                    "tampered-tag",
                    "tampered-body",
                ]:
                    shutil.rmtree(native / "dist", ignore_errors=True)
                    shutil.rmtree(native / ".turbo", ignore_errors=True)
                    if saved is not None:
                        object_key, payload, metadata = saved
                        changed = dict(metadata)
                        if case == "missing-tag":
                            changed.pop("x-artifact-tag")
                        if case == "tampered-tag":
                            changed["x-artifact-tag"] = "synthetic-invalid-tag"
                        client.put_object(
                            Bucket="signed-policy-lab",
                            Key=object_key,
                            Body=payload
                            + (b"corrupt" if case == "tampered-body" else b""),
                            Metadata=changed,
                        )
                    role = "writer" if case == "producer" else "reader"
                    env = {
                        "PATH": os.environ["PATH"],
                        "HOME": str(work),
                        "CI": "1",
                        "TURBO_TELEMETRY_DISABLED": "1",
                        "TURBO_API": endpoints[role],
                        "TURBO_TEAMID": team,
                        "TURBO_TOKEN": f"synthetic-{role}-bearer",
                        "TURBO_REMOTE_CACHE_SIGNATURE_KEY": key
                        if case != "wrong-key"
                        else key + "wrong",
                        "PROBE_DENY_EXECUTION": "0" if case == "producer" else "1",
                    }
                    result = subprocess.run(
                        [
                            str(binary),
                            "run",
                            "build",
                            "--skip-infer",
                            "--single-package",
                            "--cache=remote:rw",
                            "--env-mode=strict",
                            "--no-daemon",
                            "--summarize",
                        ],
                        cwd=native,
                        env=env,
                        capture_output=True,
                        timeout=45,
                    )
                    summaries = list((native / ".turbo/runs").glob("*.json"))
                    assert len(summaries) == 1, "Native summary missing"
                    summary = json.loads(summaries[0].read_text())
                    task = summary["tasks"][0]
                    output = native / "dist/result.txt"
                    passed = (
                        (
                            result.returncode == 0
                            and output.read_bytes() == b"signed-adapter-output\n"
                            and task["cache"]["status"]
                            == ("MISS" if case == "producer" else "HIT")
                        )
                        if case in ["producer", "replay"]
                        else (
                            result.returncode == 42
                            and not output.exists()
                            and task["cache"]["status"] == "MISS"
                        )
                    )
                    assert key.encode() not in result.stdout + result.stderr
                    native_rows.append(
                        {
                            "channel": pin["channel"],
                            "version": pin["version"],
                            "executableSha256": pin["executableSha256"],
                            "case": case,
                            "hash": task["hash"],
                            "cacheStatus": task["cache"]["status"],
                            "exitCode": result.returncode,
                            "outputMaterialized": output.exists(),
                            "passed": passed,
                        }
                    )
                    if not passed:
                        raise AssertionError(
                            f"Native case failed: {pin['channel']} {case}"
                        )
                    if case == "producer":
                        object_key = f"{team}/{task['hash']}"
                        obj = client.get_object(
                            Bucket="signed-policy-lab", Key=object_key
                        )
                        saved = (object_key, obj["Body"].read(), obj["Metadata"])
                        # Even a tag produced by the real client's HMAC key
                        # gives the reader no independent upload capability.
                        before = fixture.calls
                        status, metadata, body = request(
                            endpoints["reader"]
                            + f"/v8/artifacts/{task['hash']}"
                            + query,
                            "PUT",
                            saved[1],
                            {
                                "Authorization": "Bearer synthetic-reader-bearer",
                                "x-artifact-tag": saved[2]["x-artifact-tag"],
                            },
                        )
                        passed = (
                            status == 403
                            and metadata.get("x-beep-cache-result") == "write-denied"
                            and fixture.calls == before
                        )
                        rows.append(
                            {
                                "case": f"{pin['channel']}-valid-tag-reader-upload",
                                "status": status,
                                "result": metadata.get("x-beep-cache-result"),
                                "storageCalls": fixture.calls - before,
                                "passed": passed,
                            }
                        )
                        if not passed:
                            raise AssertionError(
                                "A valid artifact tag granted reader upload authority"
                            )

            if options.runtime_envelope:
                for role, unit in runtime_units.items():
                    runtime_rows.append(
                        runtime_observation(
                            unit,
                            role,
                            "after-load",
                            options.adapter_sha256,
                            runtime_keys[role],
                        )
                    )
            stop_owned_adapters(processes, units)
            for handle in logs:
                handle.close()
            assert all(
                (work / f"{role}.log").read_bytes() == b""
                for role in ["writer", "reader"]
            )
            assert not list(work.glob("*.json")), "Adapter created a telemetry file"
            report = {
                "schemaVersion": "r2-cache-policy-lab/v1",
                "authority": "isolated-process-component-only",
                "storage": "Moto5.1.15 synthetic S3; no R2 IAM qualification",
                "adapterSha256": options.adapter_sha256,
                "wire": rows,
                "startup": startup_controls,
                "native": native_rows,
                "runtime": runtime_rows,
                "runtimeEnvelope": options.runtime_envelope,
                "ownedRuntimeUnitsStopped": True,
                "adapterOutputBytes": 0,
                "productionReadiness": False,
                "passed": True,
            }
            Path(options.output).write_text(json.dumps(report, indent=2) + "\n")
            print(
                f"PASS: {len(rows)} wire controls, {len(startup_controls)} startup control and {len(native_rows)} pinned native controls; no adapter log output."
            )
    finally:
        stop_owned_adapters(processes, units)
        for handle in logs:
            handle.close()
        fixture.close()


if __name__ == "__main__":
    logging.disable(logging.CRITICAL)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--adapter-sha256", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument(
        "--runtime-envelope",
        action="store_true",
        help="Require fixed workers under measured systemd user resource caps (Linux only).",
    )
    run(parser.parse_args())
