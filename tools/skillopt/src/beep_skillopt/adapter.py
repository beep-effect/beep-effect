"""Beeplaw SkillOpt environment adapter."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
from collections import Counter
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from pathlib import Path
from typing import Any

from skillopt.datasets.base import BatchSpec, SplitDataLoader
from skillopt.envs.base import EnvAdapter
from skillopt.model.codex_harness import render_skill_md, run_target_exec
from skillopt.prompts import load_prompt


_TRUE_VALUES = {"1", "true", "yes", "on"}
_SOURCE_SUFFIXES = {
    ".cjs",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".mts",
    ".ts",
    ".tsx",
}


def _truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in _TRUE_VALUES


def _find_repo_root(start: str | os.PathLike[str] | None = None) -> Path:
    candidates: list[Path] = []
    env_root = os.environ.get("BEEP_REPO_ROOT")
    if env_root:
        candidates.append(Path(env_root))
    if start:
        candidates.append(Path(start))
    candidates.extend([Path.cwd(), Path(__file__).resolve()])

    for candidate in candidates:
        base = candidate if candidate.is_dir() else candidate.parent
        for path in (base, *base.parents):
            if (path / "goals").is_dir() and (path / "tools").is_dir():
                return path.resolve()
            if (path / "bun.lock").exists() and (path / "tools").is_dir():
                return path.resolve()
            if (path / ".git").exists() and (path / "tools").is_dir():
                return path.resolve()
    return Path.cwd().resolve()


def _resolve_path(repo_root: Path, value: str | os.PathLike[str]) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path.resolve()
    return (repo_root / path).resolve()


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _safe_id(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("._") or "item"


def _vendor_prompt_root() -> Path:
    candidates = [
        Path(__file__).resolve().parents[2] / "vendor" / "prompts",
    ]
    for base in (Path.cwd(), *Path.cwd().parents):
        candidates.append(base / "tools" / "skillopt" / "vendor" / "prompts")
        candidates.append(base / "vendor" / "prompts")
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return candidates[0]


def _prompt_from_vendor(name: str) -> str | None:
    vendor_path = _vendor_prompt_root() / "envs" / "beeplaw" / "prompts" / f"{name}.md"
    if vendor_path.is_file():
        return vendor_path.read_text(encoding="utf-8")
    return None


def _load_beeplaw_prompt(name: str) -> str | None:
    try:
        return load_prompt(name, env="beeplaw")
    except FileNotFoundError:
        return _prompt_from_vendor(name)


def _format_rollout_system(skill_content: str) -> str:
    template = _load_beeplaw_prompt("rollout_system")
    skill_section = ""
    if skill_content.strip():
        skill_section = f"## Skill\n{skill_content.strip()}\n\n"
    if template:
        return template.format(skill_section=skill_section)
    return (
        "You are an expert code-authoring agent working inside a copied fixture.\n\n"
        f"{skill_section}"
        "Read task.md, edit the fixture files as needed, and leave the working tree ready "
        "for the Beeplaw scorer."
    )


def _build_task_text(manifest: dict[str, Any], manifest_path: str) -> str:
    parts = [
        "# Beeplaw Task",
        "",
        str(manifest.get("prompt") or "").strip(),
        "",
        "## Fixture",
        "You are running inside a copied fixture directory. Edit files in this directory only.",
        "",
        "## Entrypoint",
        f"`{manifest.get('entrypoint', '')}`",
        "",
        "## Task Manifest",
        f"`{manifest_path}`",
    ]
    return "\n".join(parts).strip() + "\n"


def _build_codex_skill(skill_content: str) -> str:
    return render_skill_md(
        skill_content,
        description="Dynamic ReflACT skill for the current Beeplaw fixture task.",
        preamble=(
            "Use this skill when editing the current Beeplaw fixture. "
            "Apply the repository law guidance to the local code, keep edits focused, "
            "and leave the fixture ready for deterministic scoring."
        ),
    )


class BeepLawDataLoader(SplitDataLoader):
    """Split-directory loader for Beeplaw task manifest items."""

    def __init__(self, *args: Any, repo_root: str = "", **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.repo_root = _find_repo_root(repo_root or None)

    def setup(self, cfg: dict) -> None:
        if cfg.get("repo_root"):
            self.repo_root = _resolve_path(Path.cwd(), str(cfg["repo_root"]))
        else:
            self.repo_root = _find_repo_root(self.split_dir or None)
        super().setup(cfg)

    def load_split_items(self, split_path: str) -> list[dict]:
        items_path = Path(split_path) / "items.json"
        if not items_path.is_file():
            raise FileNotFoundError(f"Beeplaw split is missing items.json: {items_path}")
        raw_items = _read_json(items_path)
        if not isinstance(raw_items, list):
            raise ValueError(f"Expected JSON array in {items_path}")
        return [self._resolve_item(item, items_path) for item in raw_items]

    def _resolve_item(self, item: dict, items_path: Path) -> dict:
        if not isinstance(item, dict):
            raise ValueError(f"Beeplaw split item must be an object in {items_path}")
        task_path_raw = str(item.get("task_path") or "").strip()
        if not task_path_raw:
            raise ValueError(f"Beeplaw item is missing task_path in {items_path}")

        manifest_path = _resolve_path(self.repo_root, task_path_raw)
        if not manifest_path.is_file():
            raise FileNotFoundError(f"Beeplaw task manifest not found: {manifest_path}")
        manifest = _read_json(manifest_path)
        if not isinstance(manifest, dict):
            raise ValueError(f"Beeplaw task manifest must be an object: {manifest_path}")
        required_keys = {"id", "prompt", "fixture", "entrypoint", "completion", "weights"}
        missing = sorted(key for key in required_keys if key not in manifest)
        if missing:
            raise ValueError(
                f"Beeplaw task manifest is missing required keys {missing}: {manifest_path}"
            )
        if not isinstance(manifest.get("completion"), dict):
            raise ValueError(f"Beeplaw manifest completion must be an object: {manifest_path}")
        if not isinstance(manifest.get("weights"), dict):
            raise ValueError(f"Beeplaw manifest weights must be an object: {manifest_path}")

        item_id = str(item.get("id") or manifest.get("id") or "").strip()
        manifest_id = str(manifest.get("id") or "").strip()
        if not item_id:
            raise ValueError(f"Beeplaw item has no id: {items_path}")
        if manifest_id and manifest_id != item_id:
            raise ValueError(
                f"Beeplaw item id {item_id!r} does not match manifest id {manifest_id!r}"
            )

        fixture_raw = str(manifest.get("fixture") or "").strip()
        if not fixture_raw:
            raise ValueError(f"Beeplaw manifest is missing fixture: {manifest_path}")
        fixture_path = _resolve_path(self.repo_root, fixture_raw)
        if not fixture_path.is_dir():
            raise FileNotFoundError(f"Beeplaw fixture directory not found: {fixture_path}")

        resolved = dict(item)
        resolved.update(
            {
                "id": item_id,
                "task_type": "beeplaw",
                "task_description": str(manifest.get("prompt") or ""),
                "task_manifest": manifest,
                "task_manifest_path": str(manifest_path),
                "fixture_path": str(fixture_path),
                "entrypoint": str(manifest.get("entrypoint") or ""),
            }
        )
        return resolved


class BeepLawAdapter(EnvAdapter):
    """SkillOpt adapter for Beeplaw fixture-editing tasks."""

    def __init__(
        self,
        split_dir: str = "",
        data_path: str = "",
        split_mode: str = "split_dir",
        split_ratio: str = "2:1:7",
        split_seed: int = 42,
        split_output_dir: str = "",
        max_turns: int = 1,
        exec_timeout: int = 120,
        score_timeout: int = 600,
        task_timeout: int = 900,
        workers: int = 1,
        analyst_workers: int = 16,
        failure_only: bool = False,
        minibatch_size: int = 8,
        edit_budget: int = 4,
        seed: int = 42,
        limit: int = 0,
        max_completion_tokens: int = 16384,
        repo_root: str = "",
        stub_scorer: bool | str = False,
        codex_exec_sandbox: str = "workspace-write",
    ) -> None:
        self.max_turns = int(max_turns)
        self.exec_timeout = int(exec_timeout)
        self.score_timeout = int(score_timeout)
        self.task_timeout = int(task_timeout)
        self.workers = max(1, int(workers))
        self.max_completion_tokens = int(max_completion_tokens)
        self.analyst_workers = int(analyst_workers)
        self.failure_only = bool(failure_only)
        self.minibatch_size = int(minibatch_size)
        self.edit_budget = int(edit_budget)
        self.stub_scorer = _truthy(stub_scorer) or _truthy(
            os.environ.get("BEEP_SKILLOPT_STUB_SCORER")
        )
        self.repo_root = _find_repo_root(repo_root or None)
        self.target_model = ""
        self.codex_exec_sandbox = str(codex_exec_sandbox or "workspace-write")
        self.dataloader = BeepLawDataLoader(
            split_dir=split_dir,
            data_path=data_path,
            split_mode=split_mode,
            split_ratio=split_ratio,
            split_seed=split_seed,
            split_output_dir=split_output_dir,
            seed=seed,
            limit=limit,
            repo_root=str(self.repo_root),
        )

    @property
    def _env_name(self) -> str:
        return "beeplaw"

    def setup(self, cfg: dict) -> None:
        super().setup(cfg)
        if cfg.get("repo_root"):
            self.repo_root = _resolve_path(Path.cwd(), str(cfg["repo_root"]))
            self.dataloader.repo_root = self.repo_root
        self.stub_scorer = self.stub_scorer or _truthy(cfg.get("stub_scorer"))
        self.stub_scorer = self.stub_scorer or _truthy(
            os.environ.get("BEEP_SKILLOPT_STUB_SCORER")
        )
        self.target_model = str(cfg.get("target_model") or "")
        self.codex_exec_sandbox = str(
            cfg.get("codex_exec_sandbox") or self.codex_exec_sandbox or "workspace-write"
        )
        self.dataloader.setup(cfg)

    def get_dataloader(self):
        return self.dataloader

    def build_env_from_batch(self, batch: BatchSpec, **kwargs):
        return list(batch.payload or [])

    def build_train_env(self, batch_size: int, seed: int, **kwargs):
        batch = self.dataloader.build_train_batch(batch_size=batch_size, seed=seed, **kwargs)
        return self.build_env_from_batch(batch, **kwargs)

    def build_eval_env(self, env_num: int, split: str, seed: int, **kwargs):
        batch = self.dataloader.build_eval_batch(env_num=env_num, split=split, seed=seed, **kwargs)
        return self.build_env_from_batch(batch, **kwargs)

    def get_error_minibatch_prompt(self) -> str | None:
        return _load_beeplaw_prompt("analyst_error") or super().get_error_minibatch_prompt()

    def get_success_minibatch_prompt(self) -> str | None:
        return _load_beeplaw_prompt("analyst_success") or super().get_success_minibatch_prompt()

    def rollout(
        self,
        env_manager,
        skill_content: str,
        out_dir: str,
        **kwargs,
    ) -> list[dict]:
        items: list[dict] = list(env_manager or [])
        return _run_batch(
            adapter=self,
            items=items,
            out_root=out_dir,
            skill_content=skill_content,
            workers=self.workers,
            task_timeout=self.task_timeout,
            skip_exec=bool(kwargs.get("skip_exec", False)),
        )

    def get_task_types(self) -> list[str]:
        return ["beeplaw"]

    def score_stub(self, scratch_dir: str | os.PathLike[str], manifest: dict) -> dict:
        return _score_stub(Path(scratch_dir), manifest)

    def score_with_cli(
        self,
        scratch_dir: str | os.PathLike[str],
        manifest_path: str | os.PathLike[str],
    ) -> dict:
        cmd = [
            "bun",
            "run",
            "beep",
            "agent-effectiveness",
            "evals",
            "score",
            "--dir",
            str(scratch_dir),
            "--task",
            str(manifest_path),
            "--json",
        ]
        proc = subprocess.run(
            cmd,
            cwd=str(self.repo_root),
            capture_output=True,
            text=True,
            timeout=self.score_timeout,
        )
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "").strip()
            raise RuntimeError(
                f"scorer exited {proc.returncode}: {detail[:4000]}"
            )
        try:
            payload = json.loads(proc.stdout.strip())
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"scorer emitted invalid JSON: {proc.stdout[:4000]}") from exc
        if not isinstance(payload, dict) or "score" not in payload:
            raise RuntimeError(f"scorer JSON missing score: {payload!r}")
        return payload


def _iter_source_files(scratch_dir: Path) -> list[Path]:
    files: list[Path] = []
    for path in sorted(scratch_dir.rglob("*")):
        if not path.is_file():
            continue
        rel_parts = path.relative_to(scratch_dir).parts
        if any(part in {".agents", ".git", "node_modules"} for part in rel_parts):
            continue
        if rel_parts == ("task.md",):
            continue
        if path.suffix in _SOURCE_SUFFIXES:
            files.append(path)
    return files


def _read_source_corpus(scratch_dir: Path) -> str:
    chunks: list[str] = []
    for path in _iter_source_files(scratch_dir):
        try:
            rel = path.relative_to(scratch_dir)
            chunks.append(f"\n--- {rel} ---\n{path.read_text(encoding='utf-8')}")
        except UnicodeDecodeError:
            continue
    return "\n".join(chunks)


def _score_stub(scratch_dir: Path, manifest: dict) -> dict:
    completion = manifest.get("completion") or {}
    required = list(completion.get("requiredPatterns") or [])
    forbidden = list(completion.get("forbiddenPatterns") or [])
    corpus = _read_source_corpus(scratch_dir)
    checks: list[dict[str, Any]] = []
    violations: list[dict[str, Any]] = []

    def record(kind: str, pattern: str, ok: bool, message: str = "") -> None:
        checks.append({"kind": kind, "pattern": pattern, "ok": ok})
        if not ok:
            violations.append(
                {
                    "source": "completion",
                    "ruleId": kind,
                    "file": str(manifest.get("entrypoint") or ""),
                    "line": 0,
                    "message": message or f"{kind} pattern failed: {pattern}",
                }
            )

    for pattern in required:
        try:
            ok = re.search(str(pattern), corpus, flags=re.MULTILINE) is not None
        except re.error as exc:
            ok = False
            message = f"invalid required regex {pattern!r}: {exc}"
        else:
            message = f"required pattern not found: {pattern}"
        record("requiredPatterns", str(pattern), ok, message)

    for pattern in forbidden:
        try:
            found = re.search(str(pattern), corpus, flags=re.MULTILINE) is not None
        except re.error as exc:
            found = True
            message = f"invalid forbidden regex {pattern!r}: {exc}"
        else:
            message = f"forbidden pattern found: {pattern}"
        record("forbiddenPatterns", str(pattern), not found, message)

    total = len(checks)
    passed = sum(1 for check in checks if check["ok"])
    score = 1.0 if total == 0 else passed / total
    return {
        "taskId": str(manifest.get("id") or ""),
        "score": score,
        "breakdown": {
            "completion": score,
            "stubRequiredForbidden": score,
        },
        "violations": violations,
        "stub": True,
        "checks": checks,
    }


def _score_failure_reason(score_payload: dict) -> str:
    score = float(score_payload.get("score", 0.0) or 0.0)
    violations = score_payload.get("violations") or []
    if not violations:
        return f"score={score:.4f}"
    messages = []
    for violation in violations[:3]:
        if isinstance(violation, dict):
            messages.append(str(violation.get("message") or violation))
        else:
            messages.append(str(violation))
    return f"score={score:.4f}: " + " | ".join(messages)


def _copy_fixture(item: dict, scratch_dir: Path) -> None:
    if scratch_dir.exists():
        shutil.rmtree(scratch_dir)
    fixture_path = Path(str(item["fixture_path"]))
    shutil.copytree(fixture_path, scratch_dir)


def _inject_target_workspace(
    scratch_dir: Path,
    *,
    skill_content: str,
    task_text: str,
) -> None:
    skill_md = _build_codex_skill(skill_content)
    _write_text(
        scratch_dir / ".agents" / "skills" / "skillopt-target" / "SKILL.md",
        skill_md,
    )
    _write_text(scratch_dir / "task.md", task_text)


def _base_result(item: dict, scratch_dir: Path) -> dict:
    manifest = item.get("task_manifest") or {}
    return {
        "id": str(item["id"]),
        "task_type": "beeplaw",
        "task_description": str(manifest.get("prompt") or item.get("task_description") or ""),
        "hard": 0.0,
        "soft": 0.0,
        "response": "",
        "fail_reason": "",
        "agent_ok": False,
        "n_turns": 0,
        "scratch_dir": str(scratch_dir),
        "task_manifest_path": str(item.get("task_manifest_path") or ""),
    }


def _process_one(
    *,
    adapter: BeepLawAdapter,
    item: dict,
    out_root: str,
    skill_content: str,
    skip_exec: bool,
) -> dict:
    item_id = str(item["id"])
    safe_id = _safe_id(item_id)
    pred_dir = Path(out_root) / "predictions" / safe_id
    scratch_dir = Path(out_root) / "scratch" / safe_id / "worktree"
    pred_dir.mkdir(parents=True, exist_ok=True)
    result = _base_result(item, scratch_dir)
    manifest = dict(item.get("task_manifest") or {})
    manifest_path = str(item.get("task_manifest_path") or "")
    task_text = _build_task_text(manifest, manifest_path)
    system_prompt = _format_rollout_system(skill_content)
    conversation: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": task_text},
    ]

    try:
        _copy_fixture(item, scratch_dir)
        _inject_target_workspace(
            scratch_dir,
            skill_content=skill_content,
            task_text=task_text,
        )
        _write_text(pred_dir / "target_system_prompt.txt", system_prompt)
        _write_text(pred_dir / "target_user_prompt.txt", task_text)

        if skip_exec:
            response = "[skip_exec] target execution skipped for stub scorer validation."
            raw = response
        else:
            response, raw = run_target_exec(
                work_dir=str(scratch_dir),
                prompt=str(manifest.get("prompt") or ""),
                model=adapter.target_model,
                timeout=adapter.exec_timeout,
                sandbox=adapter.codex_exec_sandbox,
                full_auto=False,
                allow_file_edits=True,
            )
        result["response"] = response
        result["agent_ok"] = True
        result["n_turns"] = 0 if skip_exec else 1
        conversation.append({"role": "agent", "content": response})
        _write_text(pred_dir / "target_raw.txt", raw)
    except Exception as exc:  # noqa: BLE001
        result["fail_reason"] = f"target execution error: {type(exc).__name__}: {exc}"
        conversation.append({"role": "system", "content": result["fail_reason"]})
        _write_text(pred_dir / "conversation.json", json.dumps(conversation, indent=2))
        return result

    try:
        if adapter.stub_scorer:
            score_payload = adapter.score_stub(scratch_dir, manifest)
        else:
            score_payload = adapter.score_with_cli(scratch_dir, manifest_path)
        score = max(0.0, min(1.0, float(score_payload.get("score", 0.0) or 0.0)))
        result["soft"] = score
        result["hard"] = 1.0 if score >= 0.999 else 0.0
        result["scorer"] = score_payload
        if result["hard"] < 1.0:
            result["fail_reason"] = _score_failure_reason(score_payload)
        verification = "[BEEPLAW SCORE]\n" + json.dumps(
            score_payload,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        conversation.append({"role": "system", "content": verification})
        _write_text(pred_dir / "scorer.json", json.dumps(score_payload, indent=2))
    except Exception as exc:  # noqa: BLE001
        result["fail_reason"] = f"scorer error: {type(exc).__name__}: {exc}"
        conversation.append({"role": "system", "content": result["fail_reason"]})

    _write_text(pred_dir / "conversation.json", json.dumps(conversation, indent=2))
    return result


def _raise_on_systemic_failure(results: list[dict]) -> None:
    if not results or not all(row.get("agent_ok") is False for row in results):
        return
    reasons = Counter(str(row.get("fail_reason") or "unknown error") for row in results)
    common_reason, count = reasons.most_common(1)[0]
    raise RuntimeError(
        f"Beeplaw rollout failed for all {len(results)} items before scoring "
        f"({count}x): {common_reason}"
    )


def _timeout_result(item: dict, task_timeout: int, out_root: str) -> dict:
    scratch_dir = Path(out_root) / "scratch" / _safe_id(str(item.get("id") or "item")) / "worktree"
    row = _base_result(item, scratch_dir)
    row["fail_reason"] = f"task-timeout-{task_timeout}s"
    row["phase"] = "timeout"
    return row


def _error_result(item: dict, task_timeout: int, out_root: str, exc: Exception) -> dict:
    row = _timeout_result(item, task_timeout, out_root)
    row["phase"] = "error"
    row["fail_reason"] = f"unexpected: {type(exc).__name__}: {exc}"
    return row


def _run_batch(
    *,
    adapter: BeepLawAdapter,
    items: list[dict],
    out_root: str,
    skill_content: str,
    workers: int,
    task_timeout: int,
    skip_exec: bool,
) -> list[dict]:
    task_timeout = max(int(task_timeout), int(adapter.exec_timeout) + int(adapter.score_timeout) + 60)
    out_path = Path(out_root)
    results_path = out_path / "results.jsonl"
    out_path.mkdir(parents=True, exist_ok=True)

    done_ids: set[str] = set()
    existing: list[dict] = []
    if results_path.exists():
        with results_path.open(encoding="utf-8") as f:
            for line in f:
                try:
                    row = json.loads(line)
                    done_ids.add(str(row["id"]))
                    existing.append(row)
                except Exception:
                    pass

    pending = [item for item in items if str(item["id"]) not in done_ids]
    if not pending:
        _raise_on_systemic_failure(existing)
        return existing

    total = len(existing) + len(pending)
    completed = len(existing)
    correct_count = sum(1 for row in existing if row.get("hard", 0))
    if existing:
        print(f"    [beeplaw rollout] resuming: {completed}/{total} already done", flush=True)

    results = list(existing)
    started_at: dict[str, float] = {}

    def run_item(item: dict) -> dict:
        started_at[str(item["id"])] = time.time()
        return _process_one(
            adapter=adapter,
            item=item,
            out_root=out_root,
            skill_content=skill_content,
            skip_exec=skip_exec,
        )

    with results_path.open("a", encoding="utf-8") as outf:
        executor = ThreadPoolExecutor(max_workers=max(1, int(workers)))
        try:
            futures = {executor.submit(run_item, item): item for item in pending}
            pending_futures = set(futures)
            while pending_futures:
                done, _ = wait(pending_futures, timeout=5, return_when=FIRST_COMPLETED)
                now = time.time()
                timed_out = [
                    future
                    for future in pending_futures - done
                    if str(futures[future]["id"]) in started_at
                    and now - started_at[str(futures[future]["id"])] >= task_timeout
                ]
                for future in done:
                    pending_futures.remove(future)
                    item = futures[future]
                    try:
                        result = future.result()
                    except Exception as exc:  # noqa: BLE001
                        result = _error_result(item, task_timeout, out_root, exc)
                    results.append(result)
                    completed += 1
                    if result.get("hard", 0):
                        correct_count += 1
                    acc = correct_count / completed if completed else 0.0
                    print(
                        f"    [beeplaw rollout] {completed}/{total} "
                        f"(acc={acc:.3f}) id={result['id']} "
                        f"hard={result.get('hard', '?')}",
                        flush=True,
                    )
                    outf.write(json.dumps(result, ensure_ascii=False) + "\n")
                    outf.flush()
                for future in timed_out:
                    pending_futures.remove(future)
                    future.cancel()
                    result = _timeout_result(futures[future], task_timeout, out_root)
                    results.append(result)
                    completed += 1
                    acc = correct_count / completed if completed else 0.0
                    print(
                        f"    [beeplaw rollout] {completed}/{total} "
                        f"(acc={acc:.3f}) id={result['id']} TIMEOUT",
                        flush=True,
                    )
                    outf.write(json.dumps(result, ensure_ascii=False) + "\n")
                    outf.flush()
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    _raise_on_systemic_failure(results)
    return results
