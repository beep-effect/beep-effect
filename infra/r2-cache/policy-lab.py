#!/usr/bin/env python3
"""Exercise a reviewed adapter binary against disposable loopback Moto storage.

Requires moto[server]==5.1.15 and boto3 in the invoking Python environment.
This is component evidence, never R2 grant or deployment qualification.
"""

import argparse
from contextlib import ExitStack
import hashlib
import http.client
import json
import logging
import os
from pathlib import Path
import select
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from urllib.parse import urlsplit
from unittest import mock

from policy_runtime import digest, runtime_observation, start_owned_adapter, stop_owned_adapters, user_manager_env

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
        try:
            if self.thread.is_alive():
                self.server.shutdown()
        finally:
            try:
                self.server.server_close()
            finally:
                if self.thread.ident is not None:
                    self.thread.join(timeout=5)
        if self.thread.is_alive():
            raise AssertionError(
                "Owned storage fixture thread remained active after cleanup"
            )


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


def close_owned_lab_resources(processes, units, resources):
    try:
        stop_owned_adapters(processes, units)
    finally:
        resources.close()


def verify_runtime_identity_refusals(unit, role, sha256, keys, port, pid):
    cases = [
        ("wrong-listener", sha256, keys, port + 1 if port < 65535 else port - 1, pid),
        ("changed-process", sha256, keys, port, pid + 1),
        ("wrong-executable", "0" * 64, keys, port, pid),
        ("unexpected-environment", sha256, keys | {"UNEXPECTED_FIXTURE_KEY"}, port, pid),
    ]
    rows = []
    for case, expected_digest, expected_keys, expected_port, expected_pid in cases:
        try:
            runtime_observation(
                unit, role, case, expected_digest, expected_keys, expected_port, expected_pid
            )
        except AssertionError:
            rows.append({"case": case, "passed": True})
        else:
            raise AssertionError("Runtime observer accepted the " + case + " control")
    return rows


def verify_runtime_start_refusals(adapter, sha256, env, work, handle):
    rows = []
    for case, digest_value, changes in [
        ("wrong-launch-pin", "0" * 64, {}),
        ("non-loopback-launch", sha256, {"HOST": "0.0.0.0"}),
        ("artifact-key-in-backend", sha256, {"TURBO_REMOTE_CACHE_SIGNATURE_KEY": "fixture"}),
        ("agent-key-in-backend", sha256, {"OP_FIXTURE_KEY": "fixture"}),
    ]:
        processes, units = [], []
        try:
            try:
                start_owned_adapter(
                    adapter, digest_value, {**env, **changes}, work, handle, processes, units
                )
            except AssertionError:
                assert not processes and not units, "Invalid launch allocated runtime handles"
                rows.append({"case": case, "runtimeHandles": 0, "passed": True})
            else:
                raise AssertionError("Runtime launcher accepted the " + case + " control")
        finally:
            stop_owned_adapters(processes, units)
    return rows


def verify_owned_host_process(adapter, sha256, env, work):
    environment = {**env, "PORT": str(free_port())}
    before = set(work.rglob("*"))
    host = Path(__file__).with_name("policy_runtime.py")
    process = subprocess.Popen(
        [sys.executable, "-I", str(host), "owned-host"],
        cwd=work, env={"PATH": "/usr/bin"},
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
    )

    def read(expected):
        readable, _, _ = select.select([process.stdout], [], [], 15)
        if not readable:
            raise AssertionError("Owned host did not emit its bounded " + expected + " frame")
        line = process.stdout.readline(4097)
        if not line.endswith(b"\n") or len(line) > 4096:
            raise AssertionError("Owned host emitted an invalid frame")
        result = json.loads(line)
        assert result["status"] == expected, "Owned host emitted an out-of-order frame"
        return result

    try:
        payload = json.dumps({"adapter": str(adapter), "sha256": sha256, "env": environment})
        for key in ("S3_ACCESS_KEY", "S3_SECRET_KEY", "TURBO_TOKEN"):
            assert environment[key] not in str(process.args), "Secret entered host argv"
        process.stdin.write((payload + "\n").encode())
        process.stdin.flush()
        ready = read("ready")["observation"]
        status = request(f"http://127.0.0.1:{environment['PORT']}/v8/artifacts/" + "a" * 16)[0]
        assert status == 401, "Owned host accepted unauthenticated artifact access"
        process.stdin.write(b"verify\n")
        process.stdin.flush()
        after = read("after-load")["observation"]
        assert ready["sameProcess"] and after["sameProcess"]
        assert ready["ownedLoopbackListener"] and after["ownedLoopbackListener"]
        process.stdin.write(b"stop\n")
        process.stdin.flush()
        read("cleaned")
        assert process.wait(timeout=15) == 0, "Owned host did not finish successful cleanup"
        assert set(work.rglob("*")) == before, "Owned host wrote startup material into its cwd"
        return {"case": "owned-host-pipe-lifecycle", "startupFiles": 0, "secretInArgv": False, "passed": True}
    finally:
        process.stdin.close()
        if process.poll() is None:
            process.terminate()
        process.wait(timeout=20)
        process.stdout.close()


def verify_cleanup_failure_continuation():
    observations = []
    env = user_manager_env(os.environ)
    for failure in ("stop-timeout", "show-failure"):
        units = []
        processes = []
        real_run = subprocess.run
        real_output = subprocess.check_output
        injected = []
        try:
            for role in ("first", "remaining"):
                unit = f"beep-cache-cleanup-{uuid.uuid4().hex[:12]}-{role}.service"
                loaded = real_output(
                    ["systemctl", "--user", "show", unit, "-p", "LoadState", "--value"],
                    env=env,
                    text=True,
                    timeout=10,
                ).strip()
                assert loaded == "not-found", "Cleanup failure fixture already exists"
                units.append(unit)
                real_run(
                    [
                        "systemd-run",
                        "--user",
                        "--quiet",
                        f"--unit={unit}",
                        "--service-type=exec",
                        "--property=RuntimeMaxSec=30",
                        "--property=MemoryMax=16M",
                        "--property=TasksMax=4",
                        "/usr/bin/sleep",
                        "30",
                    ],
                    env=env,
                    capture_output=True,
                    check=True,
                    timeout=10,
                )
            processes.append(
                subprocess.Popen(
                    ["/usr/bin/sleep", "30"],
                    env={},
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            )

            def failing_run(args, *positional, **keywords):
                if (
                    failure == "stop-timeout"
                    and not injected
                    and args == ["systemctl", "--user", "stop", units[0]]
                ):
                    injected.append(True)
                    raise subprocess.TimeoutExpired(args, 15)
                return real_run(args, *positional, **keywords)

            def failing_output(args, *positional, **keywords):
                if (
                    failure == "show-failure"
                    and not injected
                    and args
                    == [
                        "systemctl",
                        "--user",
                        "show",
                        units[0],
                        "-p",
                        "ActiveState",
                        "--value",
                    ]
                ):
                    injected.append(True)
                    raise subprocess.CalledProcessError(1, args)
                return real_output(args, *positional, **keywords)

            reported = False
            with (
                mock.patch.object(subprocess, "run", side_effect=failing_run),
                mock.patch.object(
                    subprocess, "check_output", side_effect=failing_output
                ),
            ):
                try:
                    stop_owned_adapters(processes, units)
                except (AssertionError, subprocess.SubprocessError):
                    reported = True
            assert injected and reported, "Cleanup failure was not surfaced"
            remaining = real_output(
                [
                    "systemctl",
                    "--user",
                    "show",
                    units[1],
                    "-p",
                    "ActiveState",
                    "--value",
                ],
                env=env,
                text=True,
                timeout=10,
            ).strip()
            assert remaining == "inactive", "Cleanup skipped the remaining owned unit"
            assert processes[0].poll() is not None, "Cleanup skipped the owned child"
            observations.append(
                {
                    "case": failure,
                    "injectedFailureReported": True,
                    "remainingOwnedUnitStopped": True,
                    "ownedChildReaped": True,
                    "passed": True,
                }
            )
        finally:
            stop_owned_adapters(processes, units)

    closed = []
    resources = ExitStack()
    resources.callback(lambda: closed.append("fixture"))
    resources.callback(lambda: closed.append("remaining-log"))

    def failed_log_close():
        closed.append("failing-log")
        raise OSError("synthetic log close failure")

    resources.callback(failed_log_close)
    with mock.patch(
        f"{__name__}.stop_owned_adapters",
        side_effect=AssertionError("synthetic stop failure"),
    ):
        try:
            close_owned_lab_resources([], [], resources)
        except OSError:
            pass
        else:
            raise AssertionError("Cleanup and log closure failures were hidden")
    assert closed == ["failing-log", "remaining-log", "fixture"], (
        "A cleanup failure skipped owned closures"
    )
    observations.append(
        {
            "case": "cleanup-and-log-close-failure",
            "allLogsAttempted": True,
            "storageFixtureClosed": True,
            "injectedFailureReported": True,
            "passed": True,
        }
    )
    return observations


def run(options):
    cleanup_controls = []
    if options.runtime_envelope:
        verify_pending_unit_cleanup()
        cleanup_controls = verify_cleanup_failure_continuation()
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
    resources = ExitStack()
    resources.callback(fixture.close)
    processes = []
    units = []
    runtime_rows = []
    runtime_controls = []
    runtime_units = {}
    runtime_keys = {}
    runtime_environments = {}
    runtime_pids = {}
    runtime_ports = {}
    logs = []
    rows = []
    native_rows = []
    cache = Path.home() / ".cache/beep/turbo-r2-policy-lab/runs"
    try:
        fixture.thread.start()
        client = boto3.client(
            "s3",
            endpoint_url=fixture.url,
            region_name="us-east-1",
            aws_access_key_id="synthetic-storage-id",
            aws_secret_access_key="synthetic-storage-secret",
        )
        client.create_bucket(Bucket="signed-policy-lab")
        cache.mkdir(parents=True, exist_ok=True)
        work = Path(resources.enter_context(tempfile.TemporaryDirectory(dir=cache)))
        # An upstream dotenv reload would replace the deliberately missing
        # application configuration and emit OTEL or log files.
        trap = "SYNTHETIC_PRIVATE_DOTENV_SENTINEL"
        (work / ".env").write_text(
            f"APPLICATION_SECRET={trap}\nRUST_LOG=trace\nS3_SERVER_SIDE_ENCRYPTION={trap}\n"
        )
        endpoints = {}
        team = "team_beep_policy_lab_epoch_1"
        for role in ["writer", "reader"]:
            port = free_port()
            log = work / f"{role}.log"
            handle = resources.enter_context(log.open("wb"))
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
            endpoint = f"http://127.0.0.1:{port}"
            if options.runtime_envelope:
                env["TOKIO_WORKER_THREADS"] = "not-a-count"
                if role == "writer":
                    runtime_controls.extend(
                        verify_runtime_start_refusals(
                            adapter, options.adapter_sha256, env, work, handle
                        )
                    )
                unit, pid, observation = start_owned_adapter(
                    adapter, options.adapter_sha256, env, work, handle, processes, units
                )
                runtime_units[role] = unit
                runtime_keys[role] = set(env)
                runtime_environments[role] = dict(env)
                runtime_pids[role] = pid
                runtime_ports[role] = port
                runtime_rows.append(observation)
                if role == "writer":
                    runtime_controls.extend(
                        verify_runtime_identity_refusals(
                            unit, role, options.adapter_sha256, set(env), port, pid
                        )
                    )
            else:
                process = subprocess.Popen(
                    [str(adapter)],
                    cwd=work,
                    env=env,
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
            raise AssertionError("Dotenv changed the signed-policy startup boundary")
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
                status == 200 and metadata["x-artifact-tag"] == "synthetic-opaque-tag"
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
                        Body=payload + (b"corrupt" if case == "tampered-body" else b""),
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
                    raise AssertionError(f"Native case failed: {pin['channel']} {case}")
                if case == "producer":
                    object_key = f"{team}/{task['hash']}"
                    obj = client.get_object(Bucket="signed-policy-lab", Key=object_key)
                    saved = (object_key, obj["Body"].read(), obj["Metadata"])
                    # Even a tag produced by the real client's HMAC key
                    # gives the reader no independent upload capability.
                    before = fixture.calls
                    status, metadata, body = request(
                        endpoints["reader"] + f"/v8/artifacts/{task['hash']}" + query,
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
            runtime_controls.append(
                verify_owned_host_process(
                    adapter, options.adapter_sha256, runtime_environments["writer"], work
                )
            )
            for role, unit in runtime_units.items():
                runtime_rows.append(
                    runtime_observation(
                        unit,
                        role,
                        "after-load",
                        options.adapter_sha256,
                        runtime_keys[role],
                        runtime_ports[role],
                        runtime_pids[role],
                    )
                )
        stop_owned_adapters(processes, units)
        for handle in logs:
            handle.close()
        assert all(
            (work / f"{role}.log").read_bytes() == b"" for role in ["writer", "reader"]
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
            "runtimeControls": runtime_controls,
            "runtimeEnvelope": options.runtime_envelope,
            "cleanupControls": cleanup_controls,
            "ownedRuntimeUnitsStopped": True,
            "adapterOutputBytes": 0,
            "productionReadiness": False,
            "passed": True,
        }
    finally:
        close_owned_lab_resources(processes, units, resources)
    Path(options.output).write_text(json.dumps(report, indent=2) + "\n")
    print(
        f"PASS: {len(rows)} wire controls, {len(startup_controls)} startup control and {len(native_rows)} pinned native controls; no adapter log output."
    )


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
