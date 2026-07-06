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


def main() -> None:
    materialize_vendored_prompts()

    import scripts.train as train_script

    from beep_skillopt.adapter import BeepLawAdapter

    train_script._ENV_REGISTRY["beeplaw"] = BeepLawAdapter
    train_script.main()


if __name__ == "__main__":
    main()
