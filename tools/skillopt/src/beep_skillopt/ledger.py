"""Record a SkillOpt run's candidates as harness-ledger rows, through the CLI only.

The ledger CLI (``bun run beep harness-ledger``) is the single writer of
``harness-ledger/rows/*.jsonl``; this module never touches those files. It
reads ``<out_root>/steps.jsonl`` (see :mod:`beep_skillopt.export`) and plans:

* one ``propose`` row per candidate the screen or the loop gate decided on
  (mechanism ``skill``, edit ``diff:<digest>``, a hypothesis written from
  structured facts, the rollout target's model id and reasoning effort);
* a ``disposition --to rejected`` row for a candidate the screen or the loop
  gate rejected (negative evidence). A gate-rejected row carries
  ``--score`` (candidate minus current gate score) and ``--cost`` (skill
  characters added);
* a ``disposition --to rejected`` row WITHOUT ``--score``/``--cost`` for a
  candidate that repeats an earlier screened-out one (export's
  ``not_evaluated_reason = "screen-cache-hit"``): the trainer's cache recorded
  0.0 for it without a rollout, so there is no measurement to report;
* nothing more for a candidate the loop gate accepted: it stays ``proposed``
  because only a human admits (D2). This module never writes ``accepted``.

``--dry-run`` (the default) prints the exact invocations. ``--write`` runs
them. A marker file ``<out_root>/ledger-rows.json`` maps step -> row ids and is
saved after each successful CLI call. The marker can lag the ledger (a crash
between the CLI append and the save), so ``--write`` first reads the ledger
through ``list --json`` and reconciles: a step whose proposal (same ``diff:``
edit and hypothesis) is already a chain is not proposed again, and a
disposition goes to that chain's latest row only while it is still
``proposed``.
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from beep_skillopt.export import STEPS_FILE

MARKER_FILE = "ledger-rows.json"
DEFAULT_CLI = "bun run beep harness-ledger"
EXPECTED_METRIC = "skillopt selection soft score"
FORBIDDEN_DISPOSITIONS = frozenset({"accepted"})

Runner = Callable[[Sequence[str], Path], "RunResult"]


@dataclass
class RunResult:
    returncode: int
    stdout: str
    stderr: str


@dataclass
class PlannedStep:
    step: int
    digest: str
    propose: list[str]
    disposition: list[str] | None = None
    kind: str = ""
    claim: str = ""
    notes: list[str] = field(default_factory=list)


def default_runner(argv: Sequence[str], cwd: Path) -> RunResult:
    proc = subprocess.run(list(argv), cwd=str(cwd), capture_output=True, text=True)
    return RunResult(proc.returncode, proc.stdout, proc.stderr)


def _read_jsonl(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def _fmt(value: Any) -> str:
    return "n/a" if value is None else f"{float(value):.4f}"


def rollout_fingerprint(config: dict[str, Any]) -> tuple[str, str]:
    """Model id and reasoning effort of the rollout target, from ``config.json``."""
    model = str(config.get("target_model") or "").strip()
    backend = str(config.get("target_backend") or "").strip()
    if backend == "claude_code_exec":
        effort = str(config.get("claude_code_exec_effort") or "").strip()
    elif backend == "codex_exec":
        effort = str(config.get("codex_exec_reasoning_effort") or "").strip()
    else:
        effort = str(config.get("reasoning_effort") or "").strip()
    return model, effort


def skill_name(config: dict[str, Any]) -> str:
    skill_init = str(config.get("skill_init") or "")
    name = Path(skill_init).parent.name if skill_init else ""
    return name or "trained"


def _full(value: Any) -> str:
    """Full-precision number text (a 4-decimal rounding hides a 2.5e-7 tie gap)."""
    return "n/a" if value is None else repr(float(value))


def incumbent(row: dict[str, Any]) -> Any:
    """The score the loop gate compared against (export's ``previous_best``)."""
    value = row.get("previous_best")
    return row.get("prev_current") if value is None else value


def noise_note(row: dict[str, Any]) -> str:
    """One clause on the measured baseline noise band, or '' without one."""
    within, spread, delta = row.get("within_baseline_noise"), row.get("baseline_noise_spread"), row.get("gate_delta")
    if within is None or spread is None or delta is None:
        return ""
    where = "within" if within else "outside"
    return f"; delta {float(delta):+.6g} is {where} the measured baseline noise spread {float(spread):.6g}"


def hypothesis_for(row: dict[str, Any], skill: str) -> str:
    applied = row.get("edits_applied")
    edits = f"{applied} applied edit(s)" if applied is not None else "its edits"
    text = (
        f"SkillOpt rerun step {row['step']} (epoch {row.get('epoch')}) candidate for the {skill} skill "
        f"with {edits} under edit budget {row.get('edit_budget')} "
        f"({row.get('skill_chars_before')} -> {row.get('skill_chars_after')} chars) raises the "
        f"selection {row.get('gate_metric') or 'soft'} score above the current "
        f"{_fmt(incumbent(row))}"
    )
    if row.get("gate_verdict") == "accept":
        cand = row.get("candidate_gate_score")
        text += (
            f". Loop gate accepted it at {_full(cand)} over incumbent {_full(incumbent(row))}"
            f"{noise_note(row)}; not admitted (a human admits)"
        )
    return text


def rejection_for(row: dict[str, Any]) -> tuple[str, list[str]] | None:
    """Evidence text plus extra flags when the row was rejected, else None."""
    if row.get("not_evaluated_reason") == "screen-cache-hit":
        earlier = row.get("repeats_step")
        evidence = (
            f"pre-evaluation screen (cached): repeats the candidate screened out at step {earlier}; "
            "the trainer's selection cache recorded 0.0 without a rollout, so no score was measured"
        )
        return evidence, []
    if row.get("screen_verdict") == "reject":
        codes = ", ".join(row.get("screen_codes") or []) or "rejected"
        rules = ", ".join(row.get("screen_rules") or [])
        evidence = f"pre-evaluation screen: {codes}" + (f" (rules: {rules})" if rules else "")
        return evidence, []
    if row.get("gate_verdict") == "reject":
        metric = row.get("gate_metric") or "soft"
        cand = row.get("candidate_gate_score")
        if cand is None:
            cand = row.get("selection_soft")
        current = incumbent(row)
        evidence = (
            f"loop gate: {metric} {_fmt(cand)} <= current {_fmt(current)} "
            f"(best {_fmt(row.get('prev_best'))}){noise_note(row)}; score = candidate minus current, "
            "cost = skill chars added"
        )
        flags: list[str] = []
        before, after = row.get("skill_chars_before"), row.get("skill_chars_after")
        if cand is not None and current is not None and before is not None and after is not None:
            flags = ["--score", f"{float(cand) - float(current):.6f}", "--cost", str(int(after) - int(before))]
        return evidence, flags
    return None


def plan(
    steps: list[dict[str, Any]],
    config: dict[str, Any],
    cli: Sequence[str],
    *,
    model: str | None = None,
    effort: str | None = None,
) -> list[PlannedStep]:
    cfg_model, cfg_effort = rollout_fingerprint(config)
    model = model if model is not None else cfg_model
    effort = effort if effort is not None else cfg_effort
    skill = skill_name(config)
    planned: list[PlannedStep] = []
    for row in steps:
        digest = row.get("diff_digest")
        # A candidate is recorded once the screen rejected it or the loop gate
        # decided on it; a step without a candidate (skip) has no digest.
        decided = (
            row.get("screen_verdict") == "reject"
            or row.get("not_evaluated_reason") == "screen-cache-hit"
            or row.get("gate_verdict") in ("accept", "reject")
        )
        if not digest or not decided:
            continue
        claim = hypothesis_for(row, skill)
        propose = [
            *cli,
            "propose",
            "--mechanism",
            "skill",
            "--edit",
            f"diff:{digest}",
            "--hypothesis",
            claim,
            "--expected-surface",
            "skill",
            "--expected-metric",
            EXPECTED_METRIC,
        ]
        if model:
            propose += ["--model", model]
        if effort:
            propose += ["--reasoning-effort", effort]
        propose.append("--json")
        item = PlannedStep(step=int(row["step"]), digest=str(digest), propose=propose, claim=claim)
        rejection = rejection_for(row)
        if rejection is not None:
            evidence, flags = rejection
            item.kind = "rejected"
            item.disposition = [*cli, "disposition", "--row", "{row}", "--to", "rejected", "--evidence", evidence, *flags, "--json"]
        else:
            item.kind = "proposed (gate accepted; human admits)"
        planned.append(item)
    for item in planned:
        if item.disposition:
            target = item.disposition[item.disposition.index("--to") + 1]
            if target in FORBIDDEN_DISPOSITIONS:
                raise AssertionError("the recorder must never write an accepted disposition")
    return planned


def parse_row_id(stdout: str) -> str:
    decoder = json.JSONDecoder()
    for index, char in enumerate(stdout):
        if char != "{":
            continue
        try:
            value, _ = decoder.raw_decode(stdout[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and isinstance(value.get("rowId"), str):
            return value["rowId"]
    raise ValueError("ledger CLI output carried no rowId")


def parse_ledger_list(stdout: str) -> list[Any]:
    """The JSON array ``harness-ledger list --json`` printed, skipping any log noise."""
    decoder = json.JSONDecoder()
    for index, char in enumerate(stdout):
        if char != "[":
            continue
        try:
            value, _ = decoder.raw_decode(stdout[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(value, list) and (not value or any(isinstance(entry, dict) for entry in value)):
            return value
    raise ValueError("ledger CLI list output carried no JSON array of entries")


ChainKey = tuple[str, str]


def index_chains(entries: list[Any]) -> dict[ChainKey, list[dict[str, Any]]]:
    """Latest row of every skill chain, keyed by ``(diff digest, hypothesis claim)``.

    A disposition row copies its predecessor's edit and hypothesis, so the
    latest row still names the proposal. The claim names the step, which keeps
    two steps apart when they share a digest (a cache-hit repeat).
    """
    chains: dict[ChainKey, list[dict[str, Any]]] = {}
    for entry in entries:
        row = entry.get("row") if isinstance(entry, dict) else None
        if not isinstance(row, dict) or row.get("mechanismClass") != "skill":
            continue
        edit = row.get("edit") or {}
        if edit.get("kind") != "diff-digest":
            continue
        claim = (row.get("hypothesis") or {}).get("claim")
        chains.setdefault((str(edit.get("ref")), str(claim)), []).append(
            {**row, "chainLength": entry.get("chainLength")}
        )
    return chains


def ledger_head(chains: list[dict[str, Any]], propose_id: str | None) -> tuple[dict[str, Any] | None, str | None]:
    """The one chain carrying a step's proposal, or a refusal when several do."""
    if len(chains) > 1 and propose_id:
        linked = [row for row in chains if propose_id in (row.get("rowId"), row.get("previousRowId"))]
        if len(linked) == 1:
            return linked[0], None
    if len(chains) > 1:
        ids = ", ".join(sorted(str(row.get("rowId")) for row in chains))
        return None, f"{len(chains)} ledger chains already carry this proposal ({ids}); resolve the duplicate first"
    return (chains[0] if chains else None), None


def load_marker(out_root: Path) -> dict[str, dict[str, Any]]:
    path = out_root / MARKER_FILE
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_marker(out_root: Path, marker: dict[str, dict[str, Any]]) -> None:
    path = out_root / MARKER_FILE
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(marker, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def record(
    out_root: str | Path,
    *,
    write: bool = False,
    cli: Sequence[str] | None = None,
    repo_root: str | Path | None = None,
    runner: Runner | None = None,
    model: str | None = None,
    effort: str | None = None,
    echo: Callable[[str], None] = print,
) -> int:
    root = Path(out_root)
    steps_path = root / STEPS_FILE
    if not steps_path.is_file():
        echo(f"missing {STEPS_FILE}; run `python -m beep_skillopt.export --out-root {root}` first")
        return 1
    config_path = root / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8")) if config_path.is_file() else {}
    cli_argv = list(cli) if cli is not None else shlex.split(DEFAULT_CLI)
    cwd = Path(repo_root) if repo_root else Path.cwd()
    runner = runner or default_runner
    marker = load_marker(root)
    planned = plan(_read_jsonl(steps_path), config, cli_argv, model=model, effort=effort)
    echo(f"# {len(planned)} candidate(s); mode={'write' if write else 'dry-run'}")
    chains: dict[ChainKey, list[dict[str, Any]]] = {}
    if write:
        listing = runner([*cli_argv, "list", "--json"], cwd)
        if listing.returncode != 0:
            echo(f"# ledger list failed (exit {listing.returncode}): {listing.stderr.strip()[:500]}")
            return 1
        try:
            chains = index_chains(parse_ledger_list(listing.stdout))
        except ValueError as exc:
            echo(f"# ledger list output unreadable: {exc}")
            return 1

    for item in planned:
        key = str(item.step)
        done = marker.get(key, {})
        if done and done.get("digest") != item.digest:
            echo(f"# step {item.step}: marker digest differs from steps.jsonl; refusing to re-record")
            return 1
        if done.get("propose") and (item.disposition is None or done.get("disposition")):
            echo(f"# step {item.step}: already recorded ({done.get('propose')}); skipping")
            continue

        row_id = done.get("propose")
        head, problem = ledger_head(chains.get((item.digest, item.claim), []), row_id)
        if problem:
            echo(f"# step {item.step}: {problem}")
            return 1
        if head is not None and not row_id:
            # The CLI appended this proposal but the marker save never happened.
            proposal = head["rowId"] if head.get("disposition") == "proposed" else head.get("previousRowId")
            row_id = str(proposal or head["rowId"])
            echo(f"# step {item.step}: proposal already in the ledger ({row_id}); not proposing again")
            marker[key] = {"digest": item.digest, "propose": row_id, "disposition": None}
            save_marker(root, marker)
        elif not row_id:
            echo(shlex.join(item.propose))
            if write:
                result = runner(item.propose, cwd)
                if result.returncode != 0:
                    echo(f"# step {item.step}: propose failed (exit {result.returncode}): {result.stderr.strip()[:500]}")
                    return 1
                row_id = parse_row_id(result.stdout)
                marker[key] = {"digest": item.digest, "propose": row_id, "disposition": None}
                save_marker(root, marker)
        if item.disposition is None:
            echo(f"# step {item.step}: {item.kind}")
            continue
        target = row_id
        if head is not None:
            latest = head.get("disposition")
            if latest == "rejected":
                marker[key]["disposition"] = head["rowId"]
                save_marker(root, marker)
                echo(f"# step {item.step}: the ledger already records rejected ({head['rowId']}); skipping")
                continue
            if latest != "proposed":
                echo(f"# step {item.step}: the chain's latest row {head['rowId']} is {latest}; leaving it in place")
                continue
            target = str(head["rowId"])
        argv = [tok.replace("{row}", target or f"<rowId of step {item.step} propose>") for tok in item.disposition]
        echo(shlex.join(argv))
        if write:
            result = runner(argv, cwd)
            if result.returncode != 0:
                echo(f"# step {item.step}: disposition failed (exit {result.returncode}): {result.stderr.strip()[:500]}")
                return 1
            marker[key]["disposition"] = parse_row_id(result.stdout)
            save_marker(root, marker)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Record SkillOpt candidates as harness-ledger rows via the CLI")
    parser.add_argument("--out-root", required=True, help="The run's env.out_root directory")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Print the CLI invocations (default)")
    mode.add_argument("--write", action="store_true", help="Run the CLI invocations")
    parser.add_argument("--cli", default=os.environ.get("BEEP_HARNESS_LEDGER_CLI", DEFAULT_CLI),
                        help=f"Ledger CLI command prefix (default: {DEFAULT_CLI!r})")
    parser.add_argument("--repo-root", default=None, help="Working directory for the CLI (default: cwd)")
    parser.add_argument("--model", default=None, help="Override the rollout target model id")
    parser.add_argument("--reasoning-effort", default=None, help="Override the rollout target effort")
    args = parser.parse_args(argv)
    return record(
        args.out_root,
        write=bool(args.write),
        cli=shlex.split(args.cli),
        repo_root=args.repo_root,
        model=args.model,
        effort=args.reasoning_effort,
    )


if __name__ == "__main__":
    sys.exit(main())
