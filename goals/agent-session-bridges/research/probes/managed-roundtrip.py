#!/usr/bin/env python3
"""Opt-in synthetic managed Codex/peer proof; never forward a peer reply.

Existing subscription credential files are referenced, never read by this runner.
All runtime state and raw logs remain owner-private under the runtime HOME cache.
This experiment does not enroll existing application conversations.
"""

import argparse
import hashlib
import json
import os
import pathlib
import shutil
import signal
import sqlite3
import subprocess
import time
import traceback
import uuid


class ProbeBlocked(Exception):
    """Carry only a fixed sanitized failure code into the public receipt."""


def write_private(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")
    path.chmod(0o600)


def executable(name):
    found = shutil.which(name)
    if found is None:
        raise ProbeBlocked("required-executable-unavailable")
    return str(pathlib.Path(found).resolve())


def source_digests(repo):
    paths = set(repo.glob("packages/tooling/tool/cli/src/commands/AgentMessage/*.ts"))
    for pattern in ("packages/drivers/ai-provider-cli/src/**/*.ts", "packages/drivers/acp/src/**/*.ts",
                    "packages/foundation/capability/mcp-kit/src/**/*.ts"):
        paths.update(repo.glob(pattern))
    for relative in ("tsconfig.json", "tsconfig.base.json", "bun.lock", "package.json",
                     "packages/tooling/tool/cli/src/bin.ts", "packages/tooling/tool/cli/tsconfig.json",
                     "packages/tooling/tool/cli/package.json", "packages/drivers/ai-provider-cli/package.json",
                     "packages/drivers/acp/package.json", "packages/foundation/capability/mcp-kit/package.json"):
        path = repo / relative
        if path.is_file():
            paths.add(path)
    return [{"file": str(path.relative_to(repo)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in sorted(paths)]


def run(args):
    report = {
        "schemaVersion": "agent-message-live-proof/v1",
        "mode": "native-managed-autonomous-tools",
        "providers": ["codex", args.peer],
        "models": {"codex": "gpt-6.1-sol", args.peer: "grok-4.7" if args.peer == "grok" else "claude-opus-5-5"},
        "effort": "medium",
        "controllerRelaysPeerReplies": False,
        "existingApplicationEnrollment": False,
        "builtInToolDenialVerified": False,
        "busyPeerExercise": {"requested": args.exercise_busy_peer, "passed": False,
                             "mode": "controller-submitted-queue-during-active-native-turn"},
        "passed": False,
    }
    if args.exercise_busy_peer and args.peer != "claude":
        report["failureCode"] = "busy-peer-exercise-requires-claude"
        return report
    if not args.run_model_probes:
        report["failureCode"] = "explicit-model-probe-opt-in-required"
        return report
    os.umask(0o077)
    home = pathlib.Path.home().resolve()
    cache = home / ".cache/beep/agent-comms-implementation"
    # A runtime HOME redirect must not turn the cache into a repository state path.
    repo = pathlib.Path(args.repo).resolve()
    if cache.is_symlink() or not cache.resolve().is_relative_to(home / ".cache") or cache.resolve().is_relative_to(repo):
        report["failureCode"] = "runtime-cache-boundary-rejected"
        return report
    cache.mkdir(parents=True, exist_ok=True, mode=0o700)
    root = cache / ("managed-" + uuid.uuid4().hex)
    root.mkdir(mode=0o700)
    state = root / "state"
    state.mkdir(mode=0o700)
    controller_home = root / "controller-home"
    controller_home.mkdir(mode=0o700)
    started = time.monotonic()
    deadline = started + 420
    processes, command_processes, handles = [], [], []
    db = None
    binary_paths = {}
    base_env = {key: os.environ[key] for key in ("PATH", "LANG", "USER", "LOGNAME") if key in os.environ}
    controller_env = dict(base_env, HOME=str(controller_home))
    scope = "beep-synthetic-communication"
    nonce = "COMMS_" + uuid.uuid4().hex
    conversation = "conversation-" + nonce
    ping, reply, seed_id = "ping-" + nonce, "reply-" + nonce, "seed-" + nonce
    peer = args.peer

    try:
        cli = repo / "packages/tooling/tool/cli/src/bin.ts"
        if not cli.is_file():
            raise ProbeBlocked("repository-cli-unavailable")
        bun = executable("bun")
        binary_paths["bun"] = pathlib.Path(bun)
        version = subprocess.run([bun, "--version"], env=controller_env, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, text=True, timeout=5, check=True).stdout.strip()
        if len(version) > 128 or any(character not in "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-+" for character in version):
            raise ProbeBlocked("bun-version-metadata-invalid")
        report["bunVersion"] = version
        commands = [bun, str(cli), "agent-message"]
        report["sourceDigests"] = source_digests(repo)
        report["runnerSha256"] = hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()

        def command(*parts):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise ProbeBlocked("total-deadline-elapsed")
            child = subprocess.Popen(commands + list(parts), cwd=repo, env=controller_env,
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                     start_new_session=True)
            command_processes.append(child)
            try:
                stdout, stderr = child.communicate(timeout=min(45, remaining))
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                child.communicate(timeout=5)
                raise
            if child.returncode:
                with (root / "command-error.private.log").open("a") as output:
                    output.write(stdout + "\n" + stderr + "\n")
                raise ProbeBlocked("operator-cli-failed")
            return stdout

        profiles, grants = {}, {}
        for provider in ("codex", peer):
            owned_home = root / (provider + "-home")
            work = root / (provider + "-workspace")
            owned_home.mkdir(mode=0o700)
            work.mkdir(mode=0o700)
            provider_env = dict(base_env, HOME=str(owned_home))
            binary = executable(provider)
            binary_paths[provider] = pathlib.Path(binary)
            prefix = []
            if provider == "codex":
                config = owned_home / ".codex"
                auth = home / ".codex/auth.json"
                config.mkdir(mode=0o700)
                if not auth.is_file():
                    raise ProbeBlocked("existing-subscription-reference-unavailable")
                (config / "auth.json").symlink_to(auth)
                provider_env["CODEX_HOME"] = str(config)
            else:
                config = owned_home / (".grok" if provider == "grok" else ".claude")
                auth = home / (".grok/auth.json" if provider == "grok" else ".claude/.credentials.json")
                config.mkdir(mode=0o700)
                if not auth.is_file():
                    raise ProbeBlocked("existing-subscription-reference-unavailable")
                if provider == "grok":
                    (config / "config.toml").write_text("[cli]\nauto_update = false\n[session]\nload_envrc = false\n")
                    provider_env.update(GROK_DISABLE_AUTOUPDATER="1", GROK_MEMORY="0", GROK_SUBAGENTS="0",
                                        GROK_WEB_FETCH="0", GROK_WRITE_FILE="0")
                # The peer gets a read-only root and writable owned scratch only.
                # These filesystem mounts do not prove built-in tool denial.
                prefix = ["--ro-bind", "/", "/"]
                for socket_dir in ("/run/podman", "/run/containerd", "/run/docker"):
                    if pathlib.Path(socket_dir).is_dir():
                        prefix += ["--tmpfs", socket_dir]
                for writable in (owned_home, work, state):
                    prefix += ["--bind", str(writable), str(writable)]
                prefix += ["--ro-bind", str(auth), str(config / auth.name), "--proc", "/proc", "--dev-bind", "/dev", "/dev", binary]
                binary = executable("bwrap")
                binary_paths["bwrap"] = pathlib.Path(binary)
            grant = {"grantId": "grant-" + provider, "endpointId": provider, "ownerId": "owner-" + provider,
                     "generation": 1, "repositoryScope": scope, "conversationScope": conversation,
                     "allowedRecipients": [peer if provider == "codex" else "codex"],
                     "expiresAt": int((time.time() + 600) * 1000), "maxMessages": 1}
            grant_file = root / (provider + "-grant.json")
            write_private(grant_file, grant)
            grants[provider] = grant_file
            tool = {"name": "peer", "command": bun,
                    "args": [str(cli), "agent-message", "tools", "--state-dir", str(state), "--grant-file", str(grant_file)],
                    "env": {"PATH": base_env.get("PATH", ""), "HOME": str(owned_home)}}
            profile = {"provider": provider, "executable": binary, "prefixArgs": prefix, "workspace": str(work),
                       "profileRoot": str(owned_home), "env": provider_env, "authLane": "existing-subscription", "tools": [tool]}
            if provider == "grok":
                profile["sandboxWritablePaths"] = [str(state)]
            profile_file = root / (provider + "-profile.json")
            write_private(profile_file, profile)
            profiles[provider] = profile_file

        report["executableDigests"] = {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in binary_paths.items()}
        command("list", "--state-dir", str(state))
        for provider, profile_file in profiles.items():
            out = (root / (provider + "-stdout.private.log")).open("w")
            err = (root / (provider + "-stderr.private.log")).open("w")
            handles += [out, err]
            proc = subprocess.Popen(commands + ["serve", "--state-dir", str(state), "--profile-file", str(profile_file),
                                               "--endpoint", provider, "--participant", "agent-" + provider,
                                               "--owner", "owner-" + provider, "--repository-scope", scope, "--generation", "1"],
                                    cwd=repo, env=controller_env, stdout=out, stderr=err, start_new_session=True)
            processes.append(proc)
        db = sqlite3.connect(state / "messages.sqlite", timeout=5)
        enrollment_deadline = min(deadline, time.monotonic() + 90)
        while time.monotonic() < enrollment_deadline:
            if any(proc.poll() is not None for proc in processes):
                raise ProbeBlocked("owned-runtime-exited-before-enrollment")
            rows = db.execute("select payload from agent_message_endpoints").fetchall()
            if len(rows) == 2:
                break
            time.sleep(0.3)
        else:
            raise ProbeBlocked("enrollment-deadline-elapsed")
        bindings = {value["endpointId"]: value for (raw,) in rows for value in [json.loads(raw)]}
        if set(bindings) != {"codex", peer}:
            raise ProbeBlocked("unexpected-enrollment")
        for provider, binding in bindings.items():
            policy = binding["policy"]
            if (policy["provider"] != provider or policy["modelId"] != report["models"][provider]
                    or policy["effort"] != "medium" or policy["policyEvidence"] == "unverified"):
                raise ProbeBlocked("enrollment-policy-pin-mismatch")
        report["enrollmentPinsMatched"] = True
        report["enrolledProviders"] = ["codex", peer]
        for provider, grant_file in grants.items():
            command("grant", "--state-dir", str(state), "--file", str(grant_file))
        controller = dict(bindings["codex"], endpointId="controller", participantId="controller", sessionId="seed-only", ownerId="controller")
        controller_file = root / "controller.json"
        write_private(controller_file, controller)
        command("register", "--state-dir", str(state), "--file", str(controller_file))

        def controller_send(target_provider, message_id, body):
            target = bindings[target_provider]
            now = int(time.time() * 1000)
            envelope = {"schemaVersion": "agent-message/v1", "conversationId": conversation,
                        "requestedMode": "queued", "messageId": message_id, "idempotencyKey": message_id,
                        "from": "controller", "to": {"kind": "direct", "endpointId": target_provider},
                        "repositoryScope": scope, "body": body, "createdAt": now, "expiresAt": now + 240000,
                        "capabilityFingerprint": target["capabilityFingerprint"],
                        "policyFingerprint": target["policyFingerprint"]}
            envelope_file = root / (message_id + ".json")
            write_private(envelope_file, envelope)
            command("send", "--state-dir", str(state), "--file", str(envelope_file))

        busy_ids = []
        if args.exercise_busy_peer:
            primer_id, queued_id = "primer-" + nonce, "busy-" + nonce
            busy_ids = [primer_id, queued_id]
            primer_body = ("Synthetic busy-queue primer. First acknowledge this message using agent_message_acknowledge. "
                           "Then write approximately 800 words of neutral explanation of FIFO queues, in plain text, "
                           "and finish your turn. Do not send or reply to any peer. Do not use other tools, browse, "
                           "inspect files, delegate, spend, or mutate repository files.")
            controller_send("claude", primer_id, primer_body)
            opportunity_deadline = min(deadline, time.monotonic() + 90)
            while time.monotonic() < opportunity_deadline:
                primer = db.execute("select state,dispatch_active from agent_messages where id = ?", (primer_id,)).fetchone()
                if primer == ("acknowledged", 1):
                    break
                if primer is not None and (primer[0] in ("ambiguous", "failed", "expired") or primer[1] == 2):
                    raise ProbeBlocked("busy-primer-requires-reconciliation")
                if primer == ("acknowledged", 0):
                    raise ProbeBlocked("busy-opportunity-missed")
                if any(proc.poll() is not None for proc in processes):
                    raise ProbeBlocked("owned-runtime-exited-during-busy-exercise")
                time.sleep(0.1)
            else:
                raise ProbeBlocked("busy-opportunity-missed")
            queued_body = (f"Synthetic queued message nonce {nonce}. Acknowledge this message using "
                           "agent_message_acknowledge, then finish. Do not send or reply to any peer. "
                           "Do not use any other tools or perform other work.")
            controller_send("claude", queued_id, queued_body)
            # One read snapshot must witness the primer still active and the new mail still queued.
            observed = dict((message_id, (status, activity)) for message_id, status, activity in
                            db.execute("select id,state,dispatch_active from agent_messages where id in (?, ?)", busy_ids))
            if observed.get(primer_id) != ("acknowledged", 1) or observed.get(queued_id) != ("accepted", 0):
                raise ProbeBlocked("busy-opportunity-missed")
            report["busyPeerExercise"]["acceptedDuringActiveAcknowledgedTurn"] = True
            settle_deadline = min(deadline, time.monotonic() + 120)
            while time.monotonic() < settle_deadline:
                observed = dict((message_id, (status, activity)) for message_id, status, activity in
                                db.execute("select id,state,dispatch_active from agent_messages where id in (?, ?)", busy_ids))
                if all(observed.get(message_id) == ("acknowledged", 0) for message_id in busy_ids):
                    usage = dict(db.execute("select id,used from agent_message_grants"))
                    if usage != {"grant-codex": 0, "grant-claude": 0}:
                        raise ProbeBlocked("busy-exercise-unexpected-peer-send")
                    report["busyPeerExercise"].update(passed=True, bothAcknowledged=True,
                                                       bothNativeDispatchesSettled=True, logicalMessages=2,
                                                       outboundGrantUsageUnchanged=True)
                    break
                if any(status in ("ambiguous", "failed", "expired") or activity == 2
                       for status, activity in observed.values()):
                    raise ProbeBlocked("busy-delivery-requires-reconciliation")
                if any(proc.poll() is not None for proc in processes):
                    raise ProbeBlocked("owned-runtime-exited-during-busy-exercise")
                time.sleep(0.3)
            else:
                raise ProbeBlocked("busy-delivery-deadline-elapsed")

        body = (f"Synthetic autonomous peer-tool proof only. Acknowledge this message using agent_message_acknowledge. "
                f"Then invoke agent_message_send once with messageId {ping}, conversationId {conversation}, recipient {peer}, "
                f'body exactly: "Synthetic peer proof. Acknowledge this message. Use agent_message_reply with messageId {reply}, '
                f'replyTo {ping}, body exactly {nonce}. Do not send any other message." After sending, finish your turn. '
                "When the reply arrives, acknowledge it and do not send or reply again. Do not use any other tools, browse, "
                "inspect files, delegate, spend, or mutate repository files.")
        controller_send("codex", seed_id, body)
        exchange_deadline = min(deadline, time.monotonic() + 240)
        while time.monotonic() < exchange_deadline:
            rows = db.execute("select id,state,payload from agent_messages").fetchall()
            states = {message_id: status for message_id, status, _ in rows}
            active = db.execute("select count(*) from agent_messages where dispatch_active != 0").fetchone()[0]
            expected_ids = [seed_id, ping, reply] + busy_ids
            if all(states.get(message_id) == "acknowledged" for message_id in expected_ids) and active == 0:
                messages = {message_id: json.loads(payload) for message_id, _, payload in rows}
                if set(messages) != set(expected_ids) or messages[reply]["body"] != nonce or messages[reply].get("replyTo") != ping:
                    raise ProbeBlocked("reply-correlation-or-message-count-mismatch")
                if messages[ping]["from"] != "codex" or messages[reply]["from"] != peer:
                    raise ProbeBlocked("autonomous-sender-mismatch")
                if any(message["conversationId"] != conversation for message in messages.values()):
                    raise ProbeBlocked("conversation-scope-mismatch")
                usage = dict(db.execute("select id,used from agent_message_grants"))
                if usage != {"grant-codex": 1, "grant-" + peer: 1}:
                    raise ProbeBlocked("grant-usage-mismatch")
                report.update(passed=True, seedAcknowledged=True, requestAcknowledged=True, replyAcknowledged=True,
                              allNativeDispatchesSettled=True, logicalMessages=len(expected_ids),
                              autonomousExchangeLogicalMessages=3, grantUsageByProvider={"codex": 1, peer: 1})
                break
            if (any(status in ("ambiguous", "failed", "expired") for status in states.values()) or
                    db.execute("select count(*) from agent_messages where dispatch_active = 2").fetchone()[0]):
                raise ProbeBlocked("delivery-requires-reconciliation")
            if any(proc.poll() is not None for proc in processes):
                raise ProbeBlocked("owned-runtime-exited-during-exchange")
            time.sleep(0.5)
        else:
            raise ProbeBlocked("autonomous-roundtrip-deadline-elapsed")
    except ProbeBlocked as error:
        report["failureCode"] = str(error)
    except subprocess.TimeoutExpired:
        report["failureCode"] = "owned-command-deadline-elapsed"
    except Exception:
        report["failureCode"] = "probe-internal-failure"
        (root / "failure.private.log").write_text(traceback.format_exc())
    finally:
        owned_processes = processes + command_processes
        for proc in owned_processes:
            # Kill the entire owned group even if its leader exited first.
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        for proc in owned_processes:
            try:
                proc.wait(timeout=6)
            except subprocess.TimeoutExpired:
                pass
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                report["failureCode"] = "owned-process-cleanup-incomplete"
                report["passed"] = False
        report["ownedLeadersStopped"] = all(proc.poll() is not None for proc in owned_processes)
        cleanup_deadline = time.monotonic() + 2
        groups_alive = True
        while groups_alive and time.monotonic() < cleanup_deadline:
            groups_alive = False
            for proc in owned_processes:
                try:
                    os.killpg(proc.pid, 0)
                    groups_alive = True
                except ProcessLookupError:
                    pass
            if groups_alive:
                time.sleep(0.1)
        report["ownedProcessGroupsStopped"] = not groups_alive
        if groups_alive:
            report["failureCode"] = "owned-process-cleanup-incomplete"
            report["passed"] = False
        if db is not None:
            db.close()
        for handle in handles:
            handle.close()
        try:
            if "sourceDigests" in report:
                report["finalSourceDigests"] = source_digests(repo)
                report["finalRunnerSha256"] = hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
                report["sourceChanged"] = (report["sourceDigests"] != report["finalSourceDigests"]
                                           or report["runnerSha256"] != report["finalRunnerSha256"])
                if report["sourceChanged"]:
                    report["passed"] = False
                    report["failureCode"] = "source-changed-during-probe"
            if "executableDigests" in report:
                report["finalExecutableDigests"] = {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in binary_paths.items()}
                report["executableChanged"] = report["executableDigests"] != report["finalExecutableDigests"]
                if report["executableChanged"]:
                    report["passed"] = False
                    report["failureCode"] = "executable-changed-during-probe"
        except Exception:
            report["passed"] = False
            report["failureCode"] = "source-or-executable-recheck-failed"
        report["elapsedSeconds"] = round(time.monotonic() - started, 2)
        write_private(root / "receipt.json", report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-model-probes", action="store_true")
    parser.add_argument("--repo", required=True)
    parser.add_argument("--peer", choices=("grok", "claude"), required=True)
    parser.add_argument("--exercise-busy-peer", action="store_true",
                        help="Claude only: witness controller queue acceptance during an acknowledged active turn")
    args = parser.parse_args()
    try:
        receipt = run(args)
    except Exception:
        # Preflight filesystem failures also remain sanitized on stdout/stderr.
        receipt = {"schemaVersion": "agent-message-live-proof/v1", "passed": False,
                   "failureCode": "probe-preflight-failure"}
    print(json.dumps(receipt, sort_keys=True))
    return 0 if receipt["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
