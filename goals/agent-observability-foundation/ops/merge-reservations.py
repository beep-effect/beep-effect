#!/usr/bin/env python3
"""Cooperative local owner fence. Never prints capabilities or GitHub arguments."""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
import pwd
from pathlib import Path
import re
import secrets
import stat
import sys
import tempfile

ROOT = Path(pwd.getpwuid(os.getuid()).pw_dir) / ".local/state/beep/merge-reservations"
DEFAULT_REPO = "beep-effect/beep-effect"

def fail(message):
    raise ValueError(message)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def private_bytes(path):
    path = Path(path)
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        fail("private regular evidence/capability file required")
    return path.read_bytes()

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as out:
        json.dump(value, out, sort_keys=True)
        out.write("\n")

def reservation_path(repo, pr):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo) or not str(pr).isdigit():
        fail("invalid repository or pull request identity")
    return ROOT / repo.replace("/", "__") / f"{pr}.json"

def authorize(repo, pr, requested_head=None, operation="merge"):
    path = reservation_path(repo, pr)
    if not path.exists():
        return
    record = json.loads(private_bytes(path))
    head = record["head"]
    if requested_head is not None and requested_head != head:
        fail(f"owner hold #{pr}: requested head differs from reserved head")
    cap_path = os.environ.get("BEEP_MERGE_CAPABILITY_FILE")
    proof_path = os.environ.get("BEEP_MERGE_PROOF_FILE")
    if not cap_path:
        fail(f"owner hold #{pr}: explicit owner capability required")
    if not secrets.compare_digest(digest(private_bytes(cap_path)), record["capabilitySha256"]):
        fail(f"owner hold #{pr}: capability mismatch")
    if operation == "ready":
        return
    if not proof_path:
        fail(f"owner hold #{pr}: premerge proof required")
    proof = json.loads(private_bytes(proof_path))
    expected = {"schema": "beep-owner-premerge/v1", "repo": repo, "pr": int(pr), "head": head, "owner": record["owner"]}
    if any(proof.get(key) != value for key, value in expected.items()):
        fail(f"owner hold #{pr}: proof is incomplete or stale")
    def evidence(name, json_data=True):
        reference = proof[name]
        raw = private_bytes(reference["path"])
        if digest(raw) != reference["sha256"]:
            fail(f"owner hold #{pr}: evidence hash mismatch")
        return json.loads(raw) if json_data else raw.decode()
    verdict = evidence("canonicalEvidence")
    job = evidence("jobEvidence")
    status = evidence("statusEvidence")
    log = evidence("logEvidence", False)
    if (verdict.get("schemaVersion") != "yeet-verdict/v2" or verdict.get("outcome") != "success"
        or verdict.get("resolvedHeadSha") != head or verdict.get("head") != head
        or verdict.get("mode") != "monitor" or verdict.get("mergeReady", {}).get("ready") is not True):
        fail(f"owner hold #{pr}: canonical verdict is not successful exact-head readiness")
    request, systemd = job.get("request", {}), job.get("systemd", {})
    if (job.get("schemaVersion") != "yeet-proof-job/v1" or job.get("phase") != "finished"
        or request.get("head") != head or request.get("mode") != "monitor"
        or "--until-ready" not in request.get("argv", []) or job.get("prNumber") != int(pr)
        or job.get("outcome", {}).get("verdictOutcome") != "success"
        or systemd.get("serviceResult") != "success" or str(systemd.get("exitStatus")) != "0"):
        fail(f"owner hold #{pr}: observer is not a successful terminal exact-head until-ready job")
    def instant(value):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            fail("timestamp requires timezone")
        return parsed
    finalized = instant(systemd["finalizedAt"])
    created = instant(verdict["createdAt"])
    if not finalized <= created <= datetime.now(timezone.utc):
        fail(f"owner hold #{pr}: canonical verdict must follow terminal observer finalization")
    remote = status.get("remote", {})
    if (status.get("head") != head or remote.get("headSha") != head or remote.get("number") != int(pr)
        or remote.get("state") != "OPEN" or remote.get("isDraft") is not False
        or status.get("mergeReady", {}).get("ready") is not True):
        fail(f"owner hold #{pr}: archived status must show exact-head OPEN readiness")
    lines = [line.strip() for line in log.splitlines() if line.strip()]
    if not lines or not lines[-1].startswith("[yeet] merge-ready: yes;") or "pull request is MERGED" in log:
        fail(f"owner hold #{pr}: observer log must end ready before merge detection")

def reserved(repo):
    directory = ROOT / repo.replace("/", "__")
    return [path.stem for path in directory.glob("*.json")]

def guard(args):
    repo = DEFAULT_REPO
    value_options = {"--repo", "-R", "--subject", "-t", "--body", "-b", "--body-file", "-F", "--author-email", "--match-head-commit"}
    i = 0
    while i < len(args):
        value = args[i]
        if value in value_options:
            if i + 1 >= len(args):
                fail("missing option value")
            if value in ("--repo", "-R"):
                repo = args[i + 1].removeprefix("https://github.com/").rstrip("/")
            i += 2
            continue
        if value.startswith("--repo="):
            repo = value.split("=", 1)[1]
        elif value.startswith("-R") and len(value) > 2:
            repo = value[2:]
        i += 1
    # Explicit PR porcelain mutations, including ready and auto-merge controls.
    for i in range(len(args) - 1):
        if args[i] == "pr" and args[i + 1] in ("merge", "ready"):
            tail = args[i + 2:]
            selectors, parsed_flags, head = [], set(), None
            boolean_options = {"--admin", "--auto", "--delete-branch", "-d", "--disable-auto", "--merge", "-m", "--rebase", "-r", "--squash", "-s", "--undo"}
            j = 0
            positional_only = False
            while j < len(tail):
                value = tail[j]
                option = value.split("=", 1)[0]
                if not positional_only and value == "--":
                    positional_only = True
                elif not positional_only and option in value_options:
                    if "=" in value:
                        option_value = value.split("=", 1)[1]
                    else:
                        if j + 1 >= len(tail):
                            fail("missing PR option value")
                        j += 1
                        option_value = tail[j]
                    if option == "--match-head-commit":
                        head = option_value
                elif not positional_only and option in boolean_options:
                    parsed_flags.add(option)
                elif not positional_only and value.startswith(("-t", "-b", "-F", "-R")) and len(value) > 2:
                    pass
                elif not positional_only and value.startswith("-"):
                    if reserved(repo):
                        fail("owner holds exist: unrecognized PR option syntax")
                    return
                else:
                    selectors.append(value)
                j += 1
            if len(selectors) != 1:
                if reserved(repo):
                    fail("owner holds exist: exactly one explicit PR selector required")
                return
            selector = selectors[0]
            if not (selector.isdigit() or "/pull/" in selector):
                if reserved(repo):
                    fail("owner holds exist: use numeric PR selector or full PR URL")
                return
            if selector and "/pull/" in selector:
                match = re.search(r"github\.com/([^/]+/[^/]+)/pull/(\d+)", selector)
                if not match:
                    fail("unrecognized pull request URL")
                repo, selector = match.groups()
            if selector is None:
                if reserved(repo):
                    fail("owner holds exist: use an explicit numeric PR selector")
                return
            if args[i + 1] == "merge" and "--auto" in parsed_flags and reservation_path(repo, selector).exists():
                fail(f"owner hold #{selector}: auto-merge is forbidden; owner must merge explicitly")
            if args[i + 1] == "merge" and "--disable-auto" in parsed_flags:
                if any(x.startswith("--disable-auto=") and x != "--disable-auto=true" for x in tail):
                    if reservation_path(repo, selector).exists():
                        fail(f"owner hold #{selector}: ambiguous disable-auto boolean refused")
                else:
                    return
            if args[i + 1] == "merge" and reservation_path(repo, selector).exists() and head is None:
                fail(f"owner hold #{selector}: merge requires --match-head-commit full reserved SHA")
            authorize(repo, selector, head, "ready" if args[i + 1] == "ready" else "merge")
            return
    if "api" not in args:
        return
    # Inspect only route and mutation names. Never log args or transport payloads.
    routes = [re.sub(r"^https://api\.github\.com/", "", x).lstrip("/") for x in args]
    endpoint = next((x for x in routes if x.startswith("repos/")), "").split("?", 1)[0].rstrip("/")
    match = re.fullmatch(r"repos/([^/]+/[^/]+)/pulls/(\d+)/merge(?:\?.*)?", endpoint)
    if match:
        method = next((args[i + 1].upper() for i, x in enumerate(args[:-1]) if x in ("-X", "--method")), None)
        method = next((x[2:].upper() for x in args if x.startswith("-X") and len(x) > 2), method)
        method = next((x.split("=", 1)[1].upper() for x in args if x.startswith("--method=")), method)
        method = method or ("POST" if any(x in ("-f", "-F", "--field", "--raw-field", "--input") or x.startswith(("--field=", "--raw-field=", "--input=")) or (x.startswith(("-f", "-F")) and len(x) > 2) for x in args) else "GET")
        if method != "GET":
            fields = [x[2:] if x.startswith(("-f", "-F")) and len(x) > 2 else x.removeprefix("--field=").removeprefix("--raw-field=") for x in args]
            sha = next((x.split("=", 1)[1] for x in fields if x.startswith("sha=")), None)
            if reservation_path(match[1], match[2]).exists() and sha is None:
                fail(f"owner hold #{match[2]}: REST merge requires explicit sha field")
            authorize(match[1], match[2], sha)
        return
    if any(x.split("?", 1)[0].rstrip("/") == "graphql" for x in routes):
        text = " ".join(args)
        opaque = any(x == "--input" or x.startswith("--input=") or "query=@" in x for x in args)
        if opaque or any(name in text for name in ("mergePullRequest", "enablePullRequestAutoMerge", "markPullRequestReadyForReview")):
            # GraphQL node IDs cannot safely identify a PR locally. Reserved repos
            # must use explicit REST/porcelain routes, even with a capability.
            if reserved(repo):
                fail("owner holds exist: GraphQL merge/ready or opaque input refused; use explicit PR route")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    reserve = sub.add_parser("reserve")
    reserve.add_argument("--repo", default=DEFAULT_REPO)
    reserve.add_argument("--pr", required=True, type=int)
    reserve.add_argument("--head", required=True)
    reserve.add_argument("--owner", required=True)
    reserve.add_argument("--capability-file", required=True)
    check = sub.add_parser("check")
    check.add_argument("--repo", default=DEFAULT_REPO)
    check.add_argument("--pr", required=True, type=int)
    check.add_argument("--head")
    check.add_argument("--operation", choices=("ready", "merge"), default="merge")
    advance = sub.add_parser("advance")
    advance.add_argument("--repo", default=DEFAULT_REPO)
    advance.add_argument("--pr", required=True, type=int)
    advance.add_argument("--old-head", required=True)
    advance.add_argument("--head", required=True)
    sub.add_parser("guard").add_argument("args", nargs=argparse.REMAINDER)
    opts = parser.parse_args()
    if opts.command == "reserve":
        if not re.fullmatch("[a-f0-9]{40}", opts.head):
            fail("full head SHA required")
        path = reservation_path(opts.repo, opts.pr)
        if path.exists():
            fail("reservation already exists; owner must explicitly reconcile it")
        cap = secrets.token_bytes(32).hex().encode() + b"\n"
        capfile = Path(opts.capability_file)
        capfile.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(capfile, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as out:
            out.write(cap)
        save(path, {"schema": "beep-merge-reservation/v1", "repo": opts.repo, "pr": opts.pr,
                    "head": opts.head, "owner": opts.owner, "capabilitySha256": digest(cap)})
        if not (ROOT / "active").exists():
            save(ROOT / "active", {"schema": "beep-merge-reservation-active/v1"})
        print(f"reserved #{opts.pr} at {opts.head[:10]}")
    elif opts.command == "advance":
        if not re.fullmatch("[a-f0-9]{40}", opts.head):
            fail("full new head SHA required")
        path = reservation_path(opts.repo, opts.pr)
        if not path.exists():
            fail("cannot advance an absent reservation")
        fd = os.open(path.parent / ".advance.lock", os.O_WRONLY | os.O_CREAT, 0o600)
        with os.fdopen(fd, "w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            authorize(opts.repo, opts.pr, opts.old_head, "ready")
            record = json.loads(private_bytes(path))
            if record["head"] != opts.old_head:
                fail("reservation moved before advance")
            record["head"] = opts.head
            temporary_fd, temporary_path = tempfile.mkstemp(prefix=".advance-", dir=path.parent)
            try:
                with os.fdopen(temporary_fd, "w") as out:
                    json.dump(record, out, sort_keys=True)
                    out.write("\n")
                    out.flush()
                    os.fsync(out.fileno())
                os.replace(temporary_path, path)
            finally:
                if os.path.exists(temporary_path):
                    os.unlink(temporary_path)
        print(f"advanced #{opts.pr} at {opts.head[:10]}")
    elif opts.command == "check":
        authorize(opts.repo, opts.pr, opts.head, opts.operation)
    else:
        guard(opts.args)

if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, TypeError) as error:
        # Errors from malformed JSON/files may contain transport content, so only
        # deliberate sanitized validation messages are exposed.
        message = str(error) if type(error) is ValueError else "reservation/evidence unreadable or malformed"
        if isinstance(error, json.JSONDecodeError):
            message = "reservation/evidence JSON malformed"
        print(f"merge-reservations: {message}", file=sys.stderr)
        sys.exit(73)
