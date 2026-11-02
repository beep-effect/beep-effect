#!/usr/bin/env python3
"""Apply, inspect or roll back the single global hook-pulse namespace projection (issue #1865).

Operator ruling 2026-11-02: one owned projection file under `~/.cache/beep/telemetry/`,
backed up before the apply, join tested against both salts, no other home path touched.

Owned paths, all under `${XDG_CACHE_HOME:-$HOME/.cache}/beep/telemetry/`:

- `namespace-projection.json` (0600): `{version: 1, cutoverUtc, hashSalt, previousRegime}`,
  the file `.claude/hooks/hook-pulse.sh` and `hookPulseNamespace` read as the second
  salt rung.
- `backups/<UTC stamp>/`: the prior projection bytes (or an `absent` marker) plus
  `journal.json` naming the apply time and digests. Never deleted by this script.

The salt value is read from the workstation's existing ai-metrics env file
(`$XDG_CONFIG_HOME/beep/ai-metrics.env`, key `BEEP_AI_METRICS_HASH_SALT`), which the
forwarder already uses; that file is only read. Resolved values never reach stdout,
argv or the journal (the journal stores a SHA-256 of the salt only).

    --status    report whether a projection is applied and valid (default)
    --apply     back up, then write the projection; a repeat apply with the same salt
                is a no-op that preserves the original cutover
    --rollback  restore the newest backup (or remove the projection when the backup
                records `absent`); refuses when the live file drifted from the journal
"""
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

OWNED_NAME = "namespace-projection.json"
PREVIOUS_REGIME = "library-default"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def telemetry_dir() -> Path:
    cache = os.environ.get("XDG_CACHE_HOME") or str(Path.home() / ".cache")
    return Path(cache) / "beep" / "telemetry"


def refuse_symlink_ancestry(target: Path) -> None:
    for parent in [target, *target.parents]:
        if parent.is_symlink():
            raise SystemExit(f"refusing symlinked owned path or ancestry: {parent}")


def read_salt() -> str:
    config = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    env_file = Path(config) / "beep" / "ai-metrics.env"
    if env_file.is_symlink() or not env_file.is_file():
        raise SystemExit(f"salt source missing or symlinked: {env_file}")
    for line in env_file.read_text().splitlines():
        if line.startswith("BEEP_AI_METRICS_HASH_SALT="):
            value = line.split("=", 1)[1].strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if value.strip():
                return value
    raise SystemExit(f"BEEP_AI_METRICS_HASH_SALT not found in {env_file}")


def decode_projection(path: Path) -> dict:
    data = json.loads(path.read_bytes())
    if not isinstance(data, dict) or data.get("version") != 1:
        raise ValueError("version")
    if not isinstance(data.get("hashSalt"), str) or not data["hashSalt"].strip():
        raise ValueError("hashSalt")
    if data.get("previousRegime") != PREVIOUS_REGIME:
        raise ValueError("previousRegime")
    datetime.fromisoformat(data["cutoverUtc"].replace("Z", "+00:00"))
    return data


def status(target: Path) -> int:
    if target.is_symlink():
        print(f"projection: symlink (invalid, writer refuses) at {target}")
        return 1
    if not target.exists():
        print(f"projection: absent at {target}")
        return 0
    try:
        data = decode_projection(target)
    except Exception as error:  # noqa: BLE001 - the state line is the report
        print(f"projection: present but invalid ({error.__class__.__name__}) at {target}")
        return 1
    mode = oct(target.stat().st_mode & 0o777)
    print(f"projection: valid at {target}; cutoverUtc={data['cutoverUtc']}; mode={mode}; "
          f"previousRegime={data['previousRegime']}; saltSha256={digest(data['hashSalt'].encode())[:16]}…")
    return 0


def apply(target: Path, backups: Path) -> int:
    salt = read_salt()
    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%S.%fZ")
    if target.exists():
        try:
            live = decode_projection(target)
        except Exception as error:  # noqa: BLE001 - drift is reported, never overwritten
            raise SystemExit(f"projection present but invalid ({error.__class__.__name__}); inspect before re-applying")
        if live["hashSalt"] == salt:
            print(f"already applied: {target} (cutoverUtc={live['cutoverUtc']} retained; no backup written)")
            return 0
    backup_dir = backups / stamp
    if backup_dir.exists():
        raise SystemExit(f"backup generation already exists: {backup_dir}")
    backup_dir.mkdir(parents=True, mode=0o700)
    prior_sha = None
    if target.exists():
        prior = target.read_bytes()
        prior_sha = digest(prior)
        (backup_dir / OWNED_NAME).write_bytes(prior)
        os.chmod(backup_dir / OWNED_NAME, 0o600)
        restore = f"cp -p -- {backup_dir / OWNED_NAME} {target}"
    else:
        (backup_dir / "original-state").write_text("absent\n")
        restore = f"rm -- {target}"
    document = {
        "version": 1,
        "cutoverUtc": now.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "hashSalt": salt,
        "previousRegime": PREVIOUS_REGIME,
    }
    body = (json.dumps(document, indent=2) + "\n").encode()
    journal = {
        "version": 1,
        "appliedUtc": document["cutoverUtc"],
        "owned": str(target),
        "priorSha256": prior_sha,
        "ownedSha256": digest(body),
        "saltSha256": digest(salt.encode()),
        "saltSource": "$XDG_CONFIG_HOME/beep/ai-metrics.env#BEEP_AI_METRICS_HASH_SALT (read only)",
        "restore": restore,
    }
    (backup_dir / "journal.json").write_text(json.dumps(journal, indent=2) + "\n")
    os.chmod(backup_dir / "journal.json", 0o600)
    staged = target.with_name(f".{OWNED_NAME}.{stamp}.tmp")
    staged.write_bytes(body)
    os.chmod(staged, 0o600)
    staged.replace(target)
    if target.read_bytes() != body:
        raise SystemExit("post-write verification failed")
    print(f"applied: {target}")
    print(f"cutoverUtc: {document['cutoverUtc']}")
    print(f"backup: {backup_dir}")
    print(f"rollback: {restore}")
    return 0


def rollback(target: Path, backups: Path) -> int:
    generations = sorted(p for p in backups.iterdir() if p.is_dir()) if backups.is_dir() else []
    if not generations:
        raise SystemExit("no backup generation to roll back to")
    latest = generations[-1]
    journal = json.loads((latest / "journal.json").read_text())
    if target.is_symlink():
        raise SystemExit("projection drift (symlink); rollback refused before writes")
    if target.exists() and digest(target.read_bytes()) != journal["ownedSha256"]:
        raise SystemExit("projection drift (bytes differ from the journal); rollback refused before writes")
    prior = latest / OWNED_NAME
    if journal["priorSha256"] is None:
        target.unlink(missing_ok=True)
        print(f"rolled back: removed {target} (prior state was absent)")
    else:
        if not prior.is_file() or digest(prior.read_bytes()) != journal["priorSha256"]:
            raise SystemExit("backup drift; rollback refused before writes")
        staged = target.with_name(f".{OWNED_NAME}.rollback.tmp")
        staged.write_bytes(prior.read_bytes())
        os.chmod(staged, 0o600)
        staged.replace(target)
        print(f"rolled back: restored {target} from {prior}")
    (latest / "rolled-back.json").write_text(
        json.dumps({"rolledBackUtc": datetime.now(timezone.utc).isoformat()}, indent=2) + "\n"
    )
    print(f"backup generation retained: {latest}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--status", action="store_true")
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    root = telemetry_dir()
    target = root / OWNED_NAME
    backups = root / "backups"
    refuse_symlink_ancestry(target)
    if args.apply:
        root.mkdir(parents=True, exist_ok=True)
        return apply(target, backups)
    if args.rollback:
        return rollback(target, backups)
    return status(target)


if __name__ == "__main__":
    sys.exit(main())
