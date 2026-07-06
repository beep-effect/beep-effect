from __future__ import annotations

import tempfile
from pathlib import Path

from beep_skillopt.adapter import BeepLawAdapter


def _repo_root() -> Path:
    path = Path(__file__).resolve()
    for candidate in (path, *path.parents):
        if (candidate / "tools" / "skillopt").is_dir() and (candidate / "goals").is_dir():
            return candidate
    raise RuntimeError("repo root not found")


def main() -> None:
    repo_root = _repo_root()
    split_dir = repo_root / "tools" / "skillopt" / "tests" / "fixtures" / "splits"
    adapter = BeepLawAdapter(
        split_dir=str(split_dir),
        split_mode="split_dir",
        repo_root=str(repo_root),
        stub_scorer=True,
        workers=1,
    )
    with tempfile.TemporaryDirectory() as tmp:
        adapter.setup(
            {
                "split_mode": "split_dir",
                "split_dir": str(split_dir),
                "repo_root": str(repo_root),
                "out_root": tmp,
                "target_model": "",
                "stub_scorer": True,
            }
        )
        items = adapter.build_train_env(batch_size=1, seed=7)
        assert len(items) == 1
        results = adapter.rollout(items, "Prefer deterministic code edits.", tmp, skip_exec=True)
        assert len(results) == 1
        assert results[0]["id"] == "toy-required-pattern"
        assert results[0]["soft"] == 1.0
        assert results[0]["hard"] == 1.0
        assert results[0]["agent_ok"] is True
        assert Path(results[0]["scratch_dir"]).is_dir()
    print("stub-ok")


if __name__ == "__main__":
    main()
