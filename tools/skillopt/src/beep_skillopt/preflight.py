"""Refuse to launch a SkillOpt run that would waste quota or corrupt evidence.

Run from the repository root with the same ``--config`` and ``--cfg-options``
as the trainer::

    uv run --project tools/skillopt python -m beep_skillopt.preflight \\
      --config tools/skillopt/configs/beeplaw.rerun-2026-09-29.yaml

Checks (all read-only, none spends model quota):

1. The optimizer and rollout target CLIs exist and report a version, and are
   logged in. Claude Code: ``claude auth status`` (local, prints JSON with
   ``loggedIn``; no model call). Codex: ``codex login status``. Only
   ``loggedIn`` is read; account details are never printed.
2. ``out_root`` holds no previous run's outputs (a relaunch otherwise reuses a
   cached ``selection_eval_baseline`` or resumes a stale run). ``--resume``
   allows it on purpose; ``--force`` moves the old directory aside to
   ``<out_root>.prev-<UTC stamp>`` (nothing is deleted).
3. The checkout's Yeet inbox has no unacknowledged, live P0 rows. The
   SessionStart hook injects them into every Claude Code rollout, and the
   write-blocking hook failed the 2026-09-25 run. The inbox is read the same
   way ``.claude/hooks/yeet-inbox.sh`` reads it, without writing anything.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

PREVIOUS_RUN_MARKERS = (
    "history.json",
    "runtime_state.json",
    "summary.json",
    "config.json",
    "selection_eval_baseline",
    "steps",
    "skills",
    "baseline-noise.json",
    "baseline-noise",
    "screen-log.jsonl",
    "steps.jsonl",
    "ledger-rows.json",
)
WAVE_EXEMPT_KINDS = frozenset({"pr-comment", "pr-merge-ready", "proof-job-finished", "review-thread"})
_VALID_ID = re.compile(r"^[A-Za-z0-9._-]+$")
_MODEL_ALIASES = frozenset({"opus", "sonnet", "haiku", "default", "best", "opusplan"})


@dataclass
class Report:
    failures: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def fail(self, message: str) -> None:
        self.failures.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


def load_flat_config(config: str, cfg_options: list[str]) -> dict[str, Any]:
    """Resolve the config exactly as ``beep-skillopt-train`` does."""
    import scripts.train as train_script

    return train_script.load_config(argparse.Namespace(config=config, cfg_options=list(cfg_options)))


# ---------------------------------------------------------------------------
# 1. CLIs
# ---------------------------------------------------------------------------


def _run(argv: list[str], timeout: int = 30) -> subprocess.CompletedProcess[str] | None:
    try:
        return subprocess.run(argv, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        return None


def check_claude(path: str, role: str, report: Report) -> None:
    resolved = shutil.which(path)
    if not resolved:
        report.fail(f"{role}: Claude Code CLI `{path}` not found on PATH")
        return
    version = _run([resolved, "--version"])
    if version is None or version.returncode != 0:
        report.fail(f"{role}: `{path} --version` failed")
        return
    status = _run([resolved, "auth", "status"])
    logged_in = False
    if status is not None and status.returncode == 0:
        try:
            logged_in = bool(json.loads(status.stdout).get("loggedIn"))
        except (json.JSONDecodeError, AttributeError):
            logged_in = False
    if not logged_in:
        report.fail(f"{role}: Claude Code is not logged in (`{path} auth status`); run `claude auth login` first")
        return
    report.note(f"{role}: Claude Code {version.stdout.strip()} logged in")


def check_codex(path: str, role: str, report: Report) -> None:
    resolved = shutil.which(path)
    if not resolved:
        report.fail(f"{role}: Codex CLI `{path}` not found on PATH")
        return
    version = _run([resolved, "--version"])
    if version is None or version.returncode != 0:
        report.fail(f"{role}: `{path} --version` failed")
        return
    status = _run([resolved, "login", "status"])
    if status is None or status.returncode != 0:
        report.fail(f"{role}: Codex is not logged in (`{path} login status`)")
        return
    report.note(
        f"{role}: Codex {version.stdout.strip()} logged in (quota is not checkable without spending; "
        "a usage-limit error surfaces on the first rollout)"
    )


def check_backends(cfg: dict[str, Any], report: Report) -> None:
    checked: set[tuple[str, str]] = set()
    for role, backend in (("rollout target", cfg.get("target_backend")), ("optimizer", cfg.get("optimizer_backend"))):
        backend = str(backend or "")
        if backend in ("claude_code_exec", "claude_chat", "claude"):
            # claude_chat reads CLAUDE_CLI_BIN (skillopt.model.claude_backend), exec reads the config.
            chat_bin = os.environ.get("CLAUDE_CLI_BIN", "claude")
            path = str(cfg.get("claude_code_exec_path") or "claude") if backend == "claude_code_exec" else chat_bin
            key = ("claude", path)
            if key not in checked:
                checked.add(key)
                check_claude(path, role, report)
        elif backend in ("codex_exec", "codex"):
            path = str(cfg.get("codex_exec_path") or "codex")
            key = ("codex", path)
            if key not in checked:
                checked.add(key)
                check_codex(path, role, report)
        else:
            report.note(f"{role}: backend {backend!r} has no local preflight probe")
    for role, key in (("rollout target", "target_model"), ("optimizer", "optimizer_model")):
        model = str(cfg.get(key) or "").strip()
        if model.lower() in _MODEL_ALIASES:
            report.note(f"{role}: model {model!r} is an alias, not a stable pin")


# ---------------------------------------------------------------------------
# 2. out_root
# ---------------------------------------------------------------------------


def previous_outputs(out_root: Path) -> list[str]:
    if not out_root.is_dir():
        return []
    return [name for name in PREVIOUS_RUN_MARKERS if (out_root / name).exists()]


def check_out_root(out_root: Path, *, resume: bool, force: bool, report: Report) -> None:
    found = previous_outputs(out_root)
    if not found:
        report.note("out_root: empty or absent")
        return
    if resume:
        report.note(f"out_root: resuming over previous outputs ({', '.join(found)})")
        return
    if force:
        stamp = _dt.datetime.now(_dt.UTC).strftime("%Y%m%dT%H%M%SZ")
        target = out_root.with_name(f"{out_root.name}.prev-{stamp}")
        out_root.rename(target)
        report.note(f"out_root: previous outputs moved aside to {target.name}")
        return
    report.fail(
        f"out_root already holds a previous run's outputs ({', '.join(found)}); "
        "pass --resume to continue it or --force to move it aside"
    )


# ---------------------------------------------------------------------------
# 3. Yeet inbox (read-only mirror of .claude/hooks/yeet-inbox.sh)
# ---------------------------------------------------------------------------


def checkout_root(start: Path) -> Path:
    path = start.resolve()
    for candidate in (path, *path.parents):
        if (candidate / ".git").exists():
            return candidate
    return path


def _parse_ts(value: str) -> _dt.datetime | None:
    text = value.strip()
    if "." in text and text.endswith("Z"):
        text = text.split(".", 1)[0] + "Z"
    try:
        return _dt.datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=_dt.UTC)
    except ValueError:
        return None


def _active_ack_ids(acks: Path) -> set[str]:
    ids: set[str] = set()
    if not acks.is_dir():
        return ids
    now = _dt.datetime.now(_dt.UTC)
    for path in acks.iterdir():
        if not path.is_file() or path.is_symlink():
            continue
        try:
            ack = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            ack = {}
        resolution = ack.get("resolution") if isinstance(ack, dict) else None
        if isinstance(resolution, dict) and resolution.get("kind") == "waive" and resolution.get("expiresAt"):
            expiry = _parse_ts(str(resolution["expiresAt"]))
            if expiry is None or expiry <= now:
                continue
        ids.add(path.name)
    return ids


def unacknowledged_p0(root: Path) -> list[dict[str, str]]:
    inbox = root / ".beep" / "inbox"
    failures = inbox / "failures.ndjson"
    if (inbox / "active.ndjson").is_file() and (inbox / "active-p0-safe-v2").is_file():
        failures = inbox / "active.ndjson"
    if not failures.is_file():
        return []
    if failures.is_symlink():
        return [{"id": "<unreadable>", "kind": "inbox-symlink"}]
    wave: dict[str, Any] | None = None
    dispatch = inbox / "dispatch.json"
    if dispatch.is_file() and not dispatch.is_symlink():
        try:
            loaded = json.loads(dispatch.read_text(encoding="utf-8"))
            if isinstance(loaded, dict) and loaded.get("schemaVersion") == "yeet-dispatch/v1":
                wave = loaded
        except (OSError, json.JSONDecodeError):
            wave = None
    acks = _active_ack_ids(inbox / "acks")
    seen: set[str] = set()
    live: list[dict[str, str]] = []
    for line in failures.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(row, dict) or row.get("schemaVersion") != "yeet-inbox/v1":
            continue
        row_id = row.get("id")
        if not isinstance(row_id, str) or not _VALID_ID.match(row_id) or row_id in seen:
            continue
        seen.add(row_id)
        if row_id in acks or row.get("severity") != "P0":
            continue
        capsule = row.get("capsule") if isinstance(row.get("capsule"), dict) else {}
        if row.get("kind") not in WAVE_EXEMPT_KINDS and wave is not None:
            head, pr = capsule.get("headSha"), capsule.get("prNumber")
            if head is not None and pr is not None and (head != wave.get("headSha") or pr != wave.get("prNumber")):
                continue  # superseded evidence
        live.append({"id": row_id, "kind": str(row.get("kind", ""))})
    return live


def check_inbox(repo_root: Path, report: Report) -> None:
    root = checkout_root(repo_root)
    rows = unacknowledged_p0(root)
    if not rows:
        report.note("yeet inbox: no unacknowledged P0 rows")
        return
    listed = ", ".join(f"{row['id']} ({row['kind']})" for row in rows[:10])
    report.fail(
        f"yeet inbox has {len(rows)} unacknowledged P0 row(s): {listed}. The SessionStart hook injects "
        "them into every rollout; acknowledge them with `bun run beep yeet inbox ack <id> ...` first"
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def run_preflight(
    cfg: dict[str, Any],
    *,
    repo_root: Path,
    resume: bool = False,
    force: bool = False,
    check_clis: bool = True,
) -> Report:
    report = Report()
    if check_clis:
        check_backends(cfg, report)
    check_out_root(Path(str(cfg["out_root"])), resume=resume, force=force, report=report)
    check_inbox(repo_root, report)
    if not cfg.get("screen_candidates"):
        report.note("screen: OFF (env.screen_candidates is not set)")
    report.note(f"baseline repeats: {int(cfg.get('baseline_repeats') or 0)}")
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Preflight checks before launching a SkillOpt run")
    parser.add_argument("--config", required=True)
    parser.add_argument("--cfg-options", nargs="+", default=[])
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--resume", action="store_true", help="Allow an out_root that holds a previous run")
    group.add_argument("--force", action="store_true", help="Move a previous out_root aside before launch")
    parser.add_argument("--repo-root", default=os.getcwd())
    args = parser.parse_args(argv)

    cfg = load_flat_config(args.config, args.cfg_options)
    report = run_preflight(cfg, repo_root=Path(args.repo_root), resume=args.resume, force=args.force)
    for note in report.notes:
        print(f"[preflight] ok   {note}")
    for failure in report.failures:
        print(f"[preflight] FAIL {failure}", file=sys.stderr)
    if report.failures:
        print(f"[preflight] refusing to launch: {len(report.failures)} check(s) failed", file=sys.stderr)
        return 1
    print("[preflight] all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
