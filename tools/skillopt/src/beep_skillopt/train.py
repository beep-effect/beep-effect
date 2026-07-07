"""Console entry point that registers the Beeplaw SkillOpt environment."""

from __future__ import annotations

import shutil
from pathlib import Path


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _vendor_prompt_root() -> Path:
    candidates = [_project_root() / "vendor" / "prompts"]
    for base in (Path.cwd(), *Path.cwd().parents):
        candidates.append(base / "tools" / "skillopt" / "vendor" / "prompts")
        candidates.append(base / "vendor" / "prompts")
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return candidates[0]


def materialize_vendored_prompts() -> int:
    """Copy missing vendored SkillOpt prompt files into the installed package."""
    import skillopt

    vendor_root = _vendor_prompt_root()
    if not vendor_root.is_dir():
        raise FileNotFoundError(f"Vendored prompt directory not found: {vendor_root}")

    skillopt_root = Path(skillopt.__file__).resolve().parent
    copied = 0
    for src in sorted(vendor_root.rglob("*.md")):
        rel_path = src.relative_to(vendor_root)
        dst = skillopt_root / rel_path
        if dst.exists():
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        copied += 1

    try:
        from skillopt.prompts import clear_cache

        clear_cache()
    except Exception:
        pass

    return copied


def _patch_codex_artifact_bytes() -> None:
    """Shield skillopt's codex-timeout path from CPython's bytes-typed TimeoutExpired output.

    subprocess.TimeoutExpired.stdout/.stderr are bytes even under text=True, and
    skillopt 0.2.0's _persist_codex_artifacts writes them to a text-mode file,
    raising TypeError and killing the whole training run on a single slow rollout.
    """
    from skillopt.model import codex_harness

    original = codex_harness._persist_codex_artifacts

    def _safe(work_dir, raw, last_message):
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", "replace")
        if isinstance(last_message, bytes):
            last_message = last_message.decode("utf-8", "replace")
        return original(work_dir, raw, last_message)

    codex_harness._persist_codex_artifacts = _safe


def main() -> None:
    materialize_vendored_prompts()
    _patch_codex_artifact_bytes()

    import scripts.train as train_script

    from beep_skillopt.adapter import BeepLawAdapter

    train_script._ENV_REGISTRY["beeplaw"] = BeepLawAdapter
    train_script.main()


if __name__ == "__main__":
    main()
