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
import tempfile
import threading
import time
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
        self.fail = False
        self.application = DomainDispatcherApplication(create_backend_app)
        self.server = make_server("127.0.0.1", 0, self, threaded=True,
                                  request_handler=QuietHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __call__(self, environ, start_response):
        self.calls += 1
        if self.fail:
            start_response("503 Service Unavailable", [("Content-Length", "0")])
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
        connection.request(method, address.path + ("?" + address.query if address.query else ""),
                           body=body, headers=headers or {})
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


def run(options):
    root = Path(__file__).resolve().parents[2]
    adapter = Path(options.adapter).resolve(strict=True)
    if digest(adapter) != options.adapter_sha256:
        raise ValueError("Adapter executable does not match the reviewed digest")
    pins = json.loads((root / "goals/turborepo-cache-conformance/research/pins-2026-10-23.json").read_text())
    fixture = StorageFixture()
    fixture.thread.start()
    client = boto3.client("s3", endpoint_url=fixture.url, region_name="us-east-1",
                          aws_access_key_id="synthetic-storage-id",
                          aws_secret_access_key="synthetic-storage-secret")
    client.create_bucket(Bucket="signed-policy-lab")
    processes = []
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
            (work / ".env").write_text(f"APPLICATION_SECRET={trap}\nRUST_LOG=trace\n")
            endpoints = {}
            team = "team_beep_policy_lab_epoch_1"
            for role in ["writer", "reader"]:
                port = free_port()
                log = work / f"{role}.log"
                handle = log.open("wb")
                logs.append(handle)
                env = {"PATH": os.environ["PATH"], "HOME": str(work), "HOST": "127.0.0.1",
                       "PORT": str(port), "TOKIO_WORKER_THREADS": "2",
                       "S3_ENDPOINT": fixture.url, "S3_REGION": "us-east-1",
                       "S3_BUCKET_NAME": "signed-policy-lab", "S3_USE_PATH_STYLE": "true",
                       "S3_ACCESS_KEY": "synthetic-storage-id", "S3_SECRET_KEY": "synthetic-storage-secret",
                       "TURBO_TOKEN": f"synthetic-{role}-bearer", "BEEP_CACHE_POLICY": "signed-v1",
                       "BEEP_CACHE_NAMESPACE": team, "BEEP_CACHE_ACCESS_ROLE": role,
                       "OTEL_EXPORTER_OTLP_ENDPOINT": fixture.url, "RUST_LOG": "trace"}
                process = subprocess.Popen([str(adapter)], cwd=work, env=env,
                                           stdout=handle, stderr=subprocess.STDOUT)
                processes.append(process)
                endpoint = f"http://127.0.0.1:{port}"
                for _ in range(100):
                    if process.poll() is not None:
                        raise AssertionError("Adapter exited before readiness")
                    try:
                        if request(endpoint + "/management/health")[0] == 200:
                            break
                    except OSError:
                        time.sleep(.05)
                else:
                    raise AssertionError("Adapter did not become ready")
                endpoints[role] = endpoint

            path = "/v8/artifacts/0123456789abcdef"
            query = f"?teamId={team}"
            for name, role, method, suffix, auth, tag, expected, code in [
                ("missing-auth", "reader", "GET", path + query, False, False, 401, "authentication-denied"),
                ("reader-put", "reader", "PUT", path + query, True, True, 403, "write-denied"),
                ("unsigned-put", "writer", "PUT", path + query, True, False, 400, "signature-missing"),
                ("foreign-tenant", "writer", "GET", path + "?teamId=team_foreign_secret", True, False, 403, "tenant-denied"),
                ("old-epoch", "reader", "GET", path + "?teamId=team_beep_policy_lab_epoch_0", True, False, 403, "tenant-denied"),
                ("duplicate-selector", "reader", "GET", path + query + "&slug=private-selector", True, False, 400, "selector-invalid"),
                ("encoded-selector", "reader", "GET", path + query + "%2fescape", True, False, 400, "selector-invalid"),
                ("encoded-artifact", "reader", "GET", "/v8/artifacts/%30%31" + query, True, False, 404, "route-invalid"),
                ("delete-denied", "writer", "DELETE", path + query, True, False, 405, "method-denied"),
                ("missing-selector", "reader", "GET", path, True, False, 400, "selector-invalid"),
                ("status-selector", "reader", "GET", "/v8/artifacts/status", True, False, 400, "selector-invalid"),
            ]:
                headers = {"Authorization": f"Bearer synthetic-{role}-bearer"} if auth else {}
                if tag:
                    headers["x-artifact-tag"] = "synthetic-opaque-tag"
                before = fixture.calls
                status, metadata, body = request(endpoints[role] + suffix, method, headers=headers)
                safe = all(secret.encode() not in body for secret in
                           [trap, "synthetic-reader-bearer", "synthetic-writer-bearer",
                            "synthetic-opaque-tag", "private-selector", "team_foreign_secret"])
                passed = (status == expected and metadata.get("x-beep-cache-result") == code
                          and fixture.calls == before and safe)
                rows.append({"case": name, "status": status, "result": metadata.get("x-beep-cache-result"),
                             "storageCalls": fixture.calls - before, "passed": passed})
                if not passed:
                    raise AssertionError(f"Wire denial failed: {name}")

            headers = {"Authorization": "Bearer synthetic-writer-bearer",
                       "x-artifact-tag": "synthetic-opaque-tag", "x-artifact-duration": "1234"}
            assert request(endpoints["writer"] + path + query, "PUT", b"synthetic-payload", headers)[0] == 201
            for method in ["GET", "HEAD"]:
                status, metadata, body = request(endpoints["reader"] + path + query, method,
                    headers={"Authorization": "Bearer synthetic-reader-bearer"})
                assert status == 200 and metadata["x-artifact-tag"] == "synthetic-opaque-tag"
                assert metadata["x-artifact-duration"] == "1234"
                assert body == (b"synthetic-payload" if method == "GET" else b"")
                rows.append({"case": f"metadata-{method.lower()}", "passed": True})

            # Both exact native clients must restore an upload from this actual
            # adapter and reject bad HMAC metadata before declared output appears.
            for pin in pins["clients"]:
                binary = Path.home() / ".cache/beep/turbo-cache-lab/clients" / pin["version"] / "turbo"
                if digest(binary) != pin["executableSha256"]:
                    raise ValueError("Native client pin mismatch")
                native = work / pin["channel"]
                native.mkdir()
                (native / "package.json").write_text(json.dumps({"name": "policy-lab", "private": True,
                    "packageManager": "bun@1.4.4", "scripts": {"build": "bun build.ts"}}))
                (native / "build.ts").write_text('if(Bun.env.PROBE_DENY_EXECUTION==="1")process.exit(42);\nawait Bun.write("dist/result.txt","signed-adapter-output\\n");\n')
                (native / "turbo.json").write_text(json.dumps({"remoteCache": {"signature": True},
                    "tasks": {"build": {"outputs": ["dist/**"], "passThroughEnv": ["PROBE_DENY_EXECUTION"]}}}))
                key = "synthetic-artifact-signing-key-at-least-32-bytes"
                saved = None
                for case in ["producer", "replay", "wrong-key", "missing-tag", "tampered-tag", "tampered-body"]:
                    shutil.rmtree(native / "dist", ignore_errors=True)
                    shutil.rmtree(native / ".turbo", ignore_errors=True)
                    if saved is not None:
                        object_key, payload, metadata = saved
                        changed = dict(metadata)
                        if case == "missing-tag":
                            changed.pop("x-artifact-tag")
                        if case == "tampered-tag":
                            changed["x-artifact-tag"] = "synthetic-invalid-tag"
                        client.put_object(Bucket="signed-policy-lab", Key=object_key,
                                          Body=payload + (b"corrupt" if case == "tampered-body" else b""), Metadata=changed)
                    role = "writer" if case == "producer" else "reader"
                    env = {"PATH": os.environ["PATH"], "HOME": str(work), "CI": "1",
                           "TURBO_TELEMETRY_DISABLED": "1", "TURBO_API": endpoints[role],
                           "TURBO_TEAMID": team, "TURBO_TOKEN": f"synthetic-{role}-bearer",
                           "TURBO_REMOTE_CACHE_SIGNATURE_KEY": key if case != "wrong-key" else key + "wrong",
                           "PROBE_DENY_EXECUTION": "0" if case == "producer" else "1"}
                    result = subprocess.run([str(binary), "run", "build", "--skip-infer", "--single-package",
                        "--cache=remote:rw", "--env-mode=strict", "--no-daemon", "--summarize"],
                        cwd=native, env=env, capture_output=True, timeout=45)
                    summaries = list((native / ".turbo/runs").glob("*.json"))
                    assert len(summaries) == 1, "Native summary missing"
                    summary = json.loads(summaries[0].read_text())
                    task = summary["tasks"][0]
                    output = native / "dist/result.txt"
                    passed = (result.returncode == 0 and output.read_bytes() == b"signed-adapter-output\n"
                              and task["cache"]["status"] == ("MISS" if case == "producer" else "HIT")) if case in ["producer", "replay"] else (result.returncode == 42 and not output.exists() and task["cache"]["status"] == "MISS")
                    assert key.encode() not in result.stdout + result.stderr
                    native_rows.append({"channel": pin["channel"], "version": pin["version"],
                        "executableSha256": pin["executableSha256"], "case": case,
                        "hash": task["hash"], "cacheStatus": task["cache"]["status"],
                        "exitCode": result.returncode, "outputMaterialized": output.exists(), "passed": passed})
                    if not passed:
                        raise AssertionError(f"Native case failed: {pin['channel']} {case}")
                    if case == "producer":
                        object_key = f"{team}/{task['hash']}"
                        obj = client.get_object(Bucket="signed-policy-lab", Key=object_key)
                        saved = (object_key, obj["Body"].read(), obj["Metadata"])

            for process in processes:
                process.terminate()
                process.wait(timeout=10)
            for handle in logs:
                handle.close()
            assert all((work / f"{role}.log").read_bytes() == b"" for role in ["writer", "reader"])
            assert not list(work.glob("*.json")), "Adapter created a telemetry file"
            report = {"schemaVersion": "r2-cache-policy-lab/v1", "authority": "isolated-process-component-only",
                "storage": "Moto5.1.15 synthetic S3; no R2 IAM qualification", "adapterSha256": options.adapter_sha256,
                "wire": rows, "native": native_rows, "adapterOutputBytes": 0,
                "productionReadiness": False, "passed": True}
            Path(options.output).write_text(json.dumps(report, indent=2) + "\n")
            print(f"PASS: {len(rows)} wire controls and {len(native_rows)} pinned native controls; no adapter log output.")
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
        for handle in logs:
            handle.close()
        fixture.close()


if __name__ == "__main__":
    logging.disable(logging.CRITICAL)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--adapter-sha256", required=True)
    parser.add_argument("--output", required=True)
    run(parser.parse_args())
