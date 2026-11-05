#!/usr/bin/env python3
"""Hosted-only small-fixture regressions; never inspect the runner's full tree."""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
OBSERVER = HERE / "native-dependency-diagnostics.py"
SPEC = importlib.util.spec_from_file_location("dependency_diagnostics", OBSERVER)
PROBE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROBE)
PRODUCTION_FIXTURE = Path(sys.argv.pop(1))


class DependencyDiagnostics(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix="dependency-diagnostic-test-")
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.previous = Path.cwd()
        os.chdir(self.root)
        self.addCleanup(os.chdir, self.previous)
        (self.root / "node_modules/example").mkdir(parents=True)
        self.payload = self.root / "node_modules/example/index.js"
        self.payload.write_bytes(b"PRIVATE_PAYLOAD_SENTINEL_001")
        self.source = self.root / "source.json"

    def write_source(self):
        # Use a real GNU tar stream. The separate TS-owned fixture additionally
        # binds our result to inspectCacheDependencyTree's production digest.
        digest = PROBE.snapshot(PROBE.time.monotonic() + 10)["sha256"]
        self.source.write_text(json.dumps({
            "schemaVersion": "cache-producer-workflow/v2", "revision": "a" * 40,
            "toolchain": {"installedDependencies": {"format": "canonical-gnu-tar/v1", "sha256": digest}},
        }))

    def observe(self):
        self.write_source()
        data, status = PROBE.observe(self.source, "a" * 40)
        self.assertEqual(status, 0)
        self.assertNotIn(b"PRIVATE_PAYLOAD_SENTINEL", data)
        self.assertNotIn(str(self.root).encode(), data)
        self.assertLessEqual(len(data) + self.source.stat().st_size, PROBE.ARTIFACT_LIMIT)
        return json.loads(data)

    def test_production_digest_and_exclusive_private_output(self):
        output = PRODUCTION_FIXTURE.parent / "diagnostic.json"
        command = ["/usr/bin/python3", "-I", "-S", str(OBSERVER),
                   "--source-report", str(PRODUCTION_FIXTURE), "--output", str(output), "--revision", "a" * 40]
        result = subprocess.run(command, cwd=PRODUCTION_FIXTURE.parent, env={"PATH": "/usr/bin"},
                                capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stdout)
        diagnostic = json.loads(output.read_bytes())
        self.assertEqual(diagnostic["status"], "stable-match")
        self.assertTrue(diagnostic["snapshotsEqual"])
        self.assertTrue(diagnostic["declaredDigestMatches"])
        self.assertEqual(diagnostic["second"]["changedCount"], 0)
        self.assertEqual(output.stat().st_mode & 0o777, 0o600)
        original = output.read_bytes()
        self.assertNotEqual(subprocess.run(command, cwd=PRODUCTION_FIXTURE.parent, env={"PATH": "/usr/bin"},
                                           capture_output=True, timeout=10).returncode, 0)
        self.assertEqual(output.read_bytes(), original)

    def test_same_size_content_modes_and_links_are_distinguishable(self):
        before = self.observe()
        self.payload.write_bytes(b"PRIVATE_PAYLOAD_SENTINEL_002")
        changed = self.observe()
        self.assertNotEqual(before["first"]["sha256"], changed["first"]["sha256"])
        self.assertEqual(before["first"]["groups"][1][1:4], changed["first"]["groups"][1][1:4])
        self.assertNotEqual(before["first"]["groups"][1][4], changed["first"]["groups"][1][4])
        self.assertEqual(before["first"]["groups"][1][5:], changed["first"]["groups"][1][5:])
        self.payload.chmod(0o700)
        mode = self.observe()
        self.assertEqual(changed["first"]["groups"][1][4], mode["first"]["groups"][1][4])
        self.assertNotEqual(changed["first"]["groups"][1][5], mode["first"]["groups"][1][5])
        link = self.root / "node_modules/example/link"
        link.symlink_to("index.js")
        first_link = self.observe()
        link.unlink()
        link.symlink_to("missing")
        second_link = self.observe()
        self.assertEqual(first_link["first"]["groups"][1][4:6], second_link["first"]["groups"][1][4:6])
        self.assertNotEqual(first_link["first"]["groups"][1][6], second_link["first"]["groups"][1][6])

    def test_timestamp_changes_do_not_change_normalized_digest(self):
        before = self.observe()
        os.utime(self.payload, (1, 1))
        after = self.observe()
        self.assertEqual(before["first"], after["first"])

    def test_drift_between_snapshots_is_retained_and_refused(self):
        self.write_source()
        original = PROBE.snapshot
        calls = 0

        def drift(deadline):
            nonlocal calls
            calls += 1
            if calls == 2:
                self.payload.write_bytes(b"PRIVATE_PAYLOAD_SENTINEL_002")
            return original(deadline)

        with patch.object(PROBE, "snapshot", drift):
            data, status = PROBE.observe(self.source, "a" * 40)
        report = json.loads(data)
        self.assertEqual(status, 1)
        self.assertEqual(report["status"], "refused-drift")
        self.assertTrue(report["declaredDigestMatches"])
        self.assertFalse(report["snapshotsEqual"])
        self.assertEqual(report["second"]["changedCount"], 1)

    def test_stale_source_digest_and_replaced_source_are_refused(self):
        self.write_source()
        with self.assertRaisesRegex(PROBE.Refusal, "source-revision-mismatch"):
            PROBE.observe(self.source, "b" * 40)
        self.payload.write_bytes(b"PRIVATE_PAYLOAD_SENTINEL_002")
        data, status = PROBE.observe(self.source, "a" * 40)
        self.assertEqual(status, 1)
        self.assertFalse(json.loads(data)["declaredDigestMatches"])
        self.write_source()
        original = PROBE.snapshot

        def replace_source(deadline):
            result = original(deadline)
            self.source.write_bytes(self.source.read_bytes() + b" ")
            return result

        with patch.object(PROBE, "snapshot", replace_source):
            data, status = PROBE.observe(self.source, "a" * 40)
        self.assertEqual(status, 1)
        self.assertFalse(json.loads(data)["sourceUnchanged"])

    def test_refuses_symlink_root_special_entries_and_publication_overflow(self):
        self.write_source()
        modules = self.root / "node_modules"
        modules.rename(self.root / "actual")
        modules.symlink_to("actual", target_is_directory=True)
        with self.assertRaisesRegex(PROBE.Refusal, "dependency-root-not-physical"):
            PROBE.observe(self.source, "a" * 40)
        modules.unlink()
        (self.root / "actual").rename(modules)
        os.mkfifo(modules / "special")
        with self.assertRaisesRegex(PROBE.Refusal, "archive-entry-type"):
            PROBE.observe(self.source, "a" * 40)
        (modules / "special").unlink()
        with patch.object(PROBE, "ARTIFACT_LIMIT", self.source.stat().st_size + 100):
            with self.assertRaisesRegex(PROBE.Refusal, "aggregate-artifact-bound"):
                PROBE.observe(self.source, "a" * 40)

    def test_package_grouping_redacts_unusual_names_and_does_not_follow_links(self):
        (self.root / "node_modules/.bun/pkg@1.0/node_modules/pkg").mkdir(parents=True)
        (self.root / "node_modules/.bun/pkg@1.0/node_modules/pkg/x.js").write_bytes(b"x")
        (self.root / "node_modules/@scope/pkg").mkdir(parents=True)
        (self.root / "node_modules/SECRET NAME").mkdir()
        (self.root / "node_modules/example/absolute").symlink_to("/etc/passwd")
        report = self.observe()
        labels = [row[0] for row in report["first"]["groups"]]
        self.assertIn(".bun/pkg@1.0", labels)
        self.assertIn("@scope/pkg", labels)
        self.assertNotIn("SECRET NAME", labels)
        self.assertTrue(any(label.startswith("opaque:") for label in labels))
        self.assertEqual(sum(row[2] for row in report["first"]["groups"]), 2)

    def test_stream_group_and_deadline_bounds_refuse_and_reap_owned_tar(self):
        with patch.object(PROBE, "STREAM_LIMIT", 64):
            with self.assertRaisesRegex(PROBE.Refusal, "archive-stream-bound"):
                PROBE.snapshot(PROBE.time.monotonic() + 10)
        with patch.object(PROBE, "GROUP_LIMIT", 1):
            with self.assertRaisesRegex(PROBE.Refusal, "group-bound"):
                PROBE.snapshot(PROBE.time.monotonic() + 10)
        with self.assertRaisesRegex(PROBE.Refusal, "deadline"):
            PROBE.snapshot(PROBE.time.monotonic() - 1)

    def test_symlink_and_fifo_source_reports_are_not_read(self):
        self.write_source()
        alias = self.root / "alias.json"
        alias.symlink_to(self.source)
        with self.assertRaises(OSError):
            PROBE.read_source(alias)
        fifo = self.root / "fifo.json"
        os.mkfifo(fifo)
        with self.assertRaisesRegex(PROBE.Refusal, "source-not-regular"):
            PROBE.read_source(fifo)


if __name__ == "__main__":
    unittest.main(verbosity=2)
