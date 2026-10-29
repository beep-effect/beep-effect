"""Check the Alchemy-owned trial grants and bounded disposable R2 objects.

Requires the existing owner-only Cloudflare CLI login and pinned local Alchemy
state. Writes only a sanitized receipt; it never activates a cache consumer.
Run from the repository root with boto3==1.43.121.
"""

import datetime
import hashlib
import json
import os
import pathlib
import re
import secrets
import stat
import sys
import urllib.request

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

os.umask(0o077)
stage = "preflight"
report = {
    "schemaVersion": "cache-r2-trial-grants/v1",
    "recordedAt": datetime.datetime.now(datetime.UTC).isoformat(),
    "authority": "actual-storage-grant-observation-only",
    "signedAdapterActivated": False,
    "credentialHandoffComplete": False,
    "payloadBytesRetained": False,
    "secretValuesInReport": False,
}
try:
    assert boto3.__version__ == "1.43.121"
    root = pathlib.Path.home() / ".local/state/beep/r2-cache/alchemy"
    assert root.stat().st_mode & 0o777 == 0o700
    folder = root / "state/BeepTurboR2SignedCredentials/r2-signed-credentials"
    cf = pathlib.Path.home() / ".config/cloudflare/config/default.json"
    info = cf.lstat()
    assert (
        stat.S_ISREG(info.st_mode)
        and info.st_uid == os.getuid()
        and info.st_mode & 0o077 == 0
    )
    auth = json.loads(cf.read_text())
    assert datetime.datetime.fromisoformat(
        auth["expiration_time"]
    ) > datetime.datetime.now(datetime.UTC)
    catalog = (
        pathlib.Path.home()
        / ".cache/beep/alchemy-r2-pilot-95f1581/packages/cloudflare/src/ApiToken/PermissionGroups.ts"
    )
    groups = {
        name: identifier
        for identifier, name in re.findall(
            r'id: "([a-f0-9]{32})",\s+name: "([^"]+)"', catalog.read_text()
        )
    }
    clients = {}
    rows = []
    account = None
    bucket = "beep-turbo-r2-pilot"
    for role, logical in [
        ("reader", "SignedTrialReader"),
        ("writer", "SignedTrialWriter"),
    ]:
        p = folder / (logical + ".json")
        info = p.lstat()
        assert (
            stat.S_ISREG(info.st_mode)
            and info.st_uid == os.getuid()
            and info.st_mode & 0o077 == 0
        )
        saved = json.loads(p.read_text())
        assert saved["status"] == "created"
        attr = saved["attr"]
        props = saved["props"]
        selected = attr["accountId"]
        assert re.fullmatch(r"[a-f0-9]{32}", selected)
        assert account is None or account == selected
        account = selected
        identifier = attr["tokenId"]
        assert re.fullmatch(r"[a-f0-9]{32}", identifier)
        expected_names = ["Workers R2 Storage Bucket Item Read"] + (
            ["Workers R2 Storage Bucket Item Write"] if role == "writer" else []
        )
        expected_policy = {
            "effect": "allow",
            "permissionGroups": expected_names,
            "resources": {
                f"com.cloudflare.edge.r2.bucket.{account}_default_{bucket}": "*"
            },
        }
        assert props["policies"] == [expected_policy]
        stage = "api-metadata-" + role
        request = urllib.request.Request(
            "https://api.cloudflare.com/client/v4/accounts/"
            + account
            + "/tokens/"
            + identifier,
            headers={
                "Authorization": "Bearer " + auth["oauth_token"],
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read(1024 * 1024 + 1)
        assert len(body) <= 1024 * 1024
        metadata = json.loads(body)
        assert metadata["success"] is True
        token = metadata["result"]
        assert token["id"] == identifier and token["status"] == "active"
        assert datetime.datetime.fromisoformat(
            token["expires_on"]
        ) == datetime.datetime(2026, 11, 28, tzinfo=datetime.UTC)
        policies = token["policies"]
        assert len(policies) == 1
        observed = policies[0]
        assert (
            observed["effect"] == "allow"
            and observed["resources"] == expected_policy["resources"]
        )
        assert sorted(g["id"] for g in observed["permission_groups"]) == sorted(
            groups[n] for n in expected_names
        )
        value = attr["value"]
        assert isinstance(value, dict) and set(value) == {"__redacted__"}
        token_value = value["__redacted__"]
        assert isinstance(token_value, str) and len(token_value) > 20
        clients[role] = boto3.client(
            "s3",
            endpoint_url="https://" + account + ".r2.cloudflarestorage.com",
            region_name="auto",
            aws_access_key_id=identifier,
            aws_secret_access_key=hashlib.sha256(token_value.encode()).hexdigest(),
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                retries={"total_max_attempts": 1},
                connect_timeout=5,
                read_timeout=10,
            ),
        )
        rows.append(
            {
                "role": role,
                "active": True,
                "permissionGroups": expected_names,
                "selectedBucketOnly": True,
                "expiresAt": "2026-11-28T00:00:00Z",
                "stateMode": "0600",
                "tokenIdSha256": hashlib.sha256(identifier.encode()).hexdigest(),
            }
        )
    report["roles"] = rows
    key = "__beep_signed_trial_permission_probe/" + secrets.token_hex(16)
    other = key + "-reader-denial"
    payload = b"beep-scoped-grant-control\n"
    operations = []
    stage = "storage-grants"
    try:
        status = clients["writer"].put_object(Bucket=bucket, Key=key, Body=payload)[
            "ResponseMetadata"
        ]["HTTPStatusCode"]
        assert status == 200
        operations.append(
            {
                "role": "writer",
                "operation": "PUT",
                "status": status,
                "bytes": len(payload),
            }
        )
        result = clients["reader"].get_object(Bucket=bucket, Key=key)
        with result["Body"] as body:
            actual = body.read(len(payload) + 1)
        assert actual == payload
        operations.append(
            {
                "role": "reader",
                "operation": "GET",
                "status": result["ResponseMetadata"]["HTTPStatusCode"],
                "exactBytes": True,
            }
        )
        for method, target in [("put_object", other), ("delete_object", key)]:
            try:
                args = {"Bucket": bucket, "Key": target}
                if method == "put_object":
                    args["Body"] = payload
                getattr(clients["reader"], method)(**args)
            except ClientError as error:
                code = error.response["ResponseMetadata"]["HTTPStatusCode"]
                assert code == 403
                operations.append(
                    {
                        "role": "reader",
                        "operation": "PUT" if method == "put_object" else "DELETE",
                        "status": code,
                        "denied": True,
                    }
                )
            else:
                raise AssertionError("Reader unexpectedly has object-write authority")
    finally:
        cleanup_failures = []
        for target in (key, other):
            try:
                result = clients["writer"].delete_object(Bucket=bucket, Key=target)
                assert result["ResponseMetadata"]["HTTPStatusCode"] == 204
                try:
                    clients["writer"].head_object(Bucket=bucket, Key=target)
                except ClientError as error:
                    assert error.response["ResponseMetadata"]["HTTPStatusCode"] == 404
                else:
                    raise AssertionError("Owned probe object remained after cleanup")
            except (AssertionError, BotoCoreError, ClientError) as error:
                cleanup_failures.append(type(error).__name__)
        report["cleanupFailures"] = cleanup_failures
        if cleanup_failures:
            raise RuntimeError("Owned probe cleanup failed; every object was attempted")
        report["ownedProbeObjectsCleaned"] = True
        report["cleanupHeadsNotFound"] = 2
    report.update(
        {
            "result": "passed",
            "operations": operations,
            "maximumProbeObjectBytes": len(payload) * 2,
            "objectNamespace": "dedicated non-cache probe prefix",
            "endpointValuesRetained": False,
        }
    )
    output = pathlib.Path(".beep/producer-upload/alchemy-trial-grants-current.json")
    output.write_text(json.dumps(report, indent=2) + "\n")
    output.chmod(0o600)
    print(
        "PASS: two exact active policies, writer upload/delete, reader exact read, reader PUT/DELETE denied; owned probe objects cleaned."
    )
except (
    AssertionError,
    OSError,
    ValueError,
    KeyError,
    TypeError,
    RuntimeError,
    BotoCoreError,
    ClientError,
) as error:
    print(
        json.dumps(
            {
                "stage": stage,
                "result": "failed",
                "type": type(error).__name__,
                "ownedProbeObjectsCleaned": report.get(
                    "ownedProbeObjectsCleaned", False
                ),
                "secretValuesInReport": False,
            }
        )
    )
    sys.exit(1)
