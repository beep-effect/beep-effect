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
        self.assertEqual(diagnostic["revision"], "a" * 40)
        self.assertEqual(diagnostic["sourceReportSha256"],
                         PROBE.hashlib.sha256(PRODUCTION_FIXTURE.read_bytes()).hexdigest())
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

    def test_chunked_source_comparison_checks_every_byte_and_length(self):
        original = b"a" * (128 * 1024) + b"tail"
        self.source.write_bytes(original)
        self.assertEqual(PROBE.read_source(self.source), original)
        self.assertTrue(PROBE.read_source(self.source, original))
        for index in [0, 64 * 1024, len(original) - 1]:
            with self.subTest(changed_byte=index):
                changed = bytearray(original)
                changed[index] ^= 1
                self.source.write_bytes(changed)
                self.assertFalse(PROBE.read_source(self.source, original))
        for changed in [original[:-1], original + b"extra"]:
            self.source.write_bytes(changed)
            self.assertFalse(PROBE.read_source(self.source, original))

    def test_source_comparison_survives_pressure_that_refuses_a_full_report_read(self):
        self.source.write_bytes(b"a" * (3 * 1024 * 1024))
        script = """
import importlib.util
from pathlib import Path
import resource
import sys
spec = importlib.util.spec_from_file_location("dependency_diagnostics", sys.argv[1])
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)
path = Path(sys.argv[2])
original = probe.read_source(path)
resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
pressure = []
try:
    while True:
        pressure.append(bytearray(1024 * 1024))
except MemoryError:
    pass
assert len(pressure) >= 2, "Insufficient room to construct bounded pressure fixture"
del pressure[-2:]
try:
    with path.open("rb") as handle:
        handle.read(probe.ARTIFACT_LIMIT)
except MemoryError:
    pass
else:
    raise AssertionError("Pressure fixture did not refuse the full report allocation")
assert probe.read_source(path, original) is True
print("bounded-source-comparison-ok")
"""
        result = subprocess.run(
            ["/usr/bin/python3", "-I", "-S", "-c", script, str(OBSERVER), str(self.source)],
            env={"PATH": "/usr/bin"}, capture_output=True, timeout=10,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), b"bounded-source-comparison-ok")

    def test_refusal_codes_distinguish_failures_without_retaining_exception_details(self):
        private = "PRIVATE_EXCEPTION_PAYLOAD_SENTINEL"
        failures = [
            (PROBE.Refusal("deadline"), "deadline"),
            (MemoryError(private), "memory-limit"),
            (subprocess.TimeoutExpired([private], 1, output=private, stderr=private), "subprocess-deadline"),
            (subprocess.SubprocessError(private), "subprocess-failed"),
            (PROBE.tarfile.ReadError(private), "archive-read-failed"),
            (FileNotFoundError(2, private, "/private/" + private), "filesystem-or-process-failed"),
            (ValueError(private), "invalid-value-or-shape"),
            (KeyError(private), "invalid-value-or-shape"),
            (TypeError(private), "invalid-value-or-shape"),
        ]
        for index, (failure, expected) in enumerate(failures):
            with self.subTest(code=expected, failure=type(failure).__name__):
                output = self.root / f"refusal-{index}.json"
                arguments = [str(OBSERVER), "--source-report", str(self.source),
                             "--output", str(output), "--revision", "a" * 40]
                with patch.object(PROBE.sys, "argv", arguments), \
                     patch.object(PROBE.resource, "setrlimit"), \
                     patch.object(PROBE, "observe", side_effect=failure):
                    self.assertEqual(PROBE.main(), 1)
                raw = output.read_bytes()
                expected_report = {
                    "schemaVersion": "cache-dependency-diagnostics/v1", "status": "refused", "code": expected,
                }
                if isinstance(failure, MemoryError):
                    expected_report.update(memoryLocation={"component": "unknown"},
                                           pythonVersion=list(PROBE.sys.version_info[:3]))
                self.assertEqual(json.loads(raw), expected_report)
                self.assertNotIn(private.encode(), raw)
                self.assertNotIn(str(self.root).encode(), raw)
                self.assertEqual(output.stat().st_mode & 0o777, 0o600)
                self.assertLessEqual(len(raw), 256)

    def test_memory_location_excludes_private_module_names_and_frame_context(self):
        private = "PRIVATE_MEMORY_CONTEXT_SENTINEL"
        for module, expected in [("tarfile", "tarfile"), ("json.encoder", "json"), (private, "unknown")]:
            with self.subTest(component=expected), patch.dict(globals(), {"__name__": module}):
                private_frame_value = str(self.root / private)
                try:
                    raise MemoryError(private_frame_value)
                except MemoryError as error:
                    location = PROBE.memory_location(error.__traceback__)
                raw = PROBE.encoded(location)
                self.assertEqual(location["component"], expected)
                self.assertEqual(set(location), {"component"} if expected == "unknown" else {"component", "line"})
                self.assertNotIn(private.encode(), raw)
                self.assertNotIn(str(self.root).encode(), raw)

    def test_memory_location_allocation_failure_preserves_minimal_refusal(self):
        output = self.root / "memory-location-refusal.json"
        arguments = [str(OBSERVER), "--source-report", str(self.source),
                     "--output", str(output), "--revision", "a" * 40]
        with patch.object(PROBE.sys, "argv", arguments), \
             patch.object(PROBE.resource, "setrlimit"), \
             patch.object(PROBE, "observe", side_effect=MemoryError("PRIVATE_PAYLOAD")), \
             patch.object(PROBE, "memory_location", side_effect=MemoryError("PRIVATE_LOCATION")):
            self.assertEqual(PROBE.main(), 1)
        self.assertEqual(json.loads(output.read_bytes()), {
            "schemaVersion": "cache-dependency-diagnostics/v1", "status": "refused", "code": "memory-limit",
        })

    def test_publication_cap_includes_failure_reports_and_refuses_special_paths(self):
        source = self.root / "publication-source.json"
        diagnostic = self.root / "publication-diagnostic.json"
        for source_size, diagnostic_size, expected in [
            (3, 8, {"source": True, "diagnostic": True}),
            (4, 8, {"source": True, "diagnostic": True}),
            (5, 8, {"source": False, "diagnostic": True}),
            (12, 1, {"source": False, "diagnostic": True}),
            (13, 1, {"source": False, "diagnostic": True}),
            (4, 13, {"source": True, "diagnostic": False}),
            (13, 13, {"source": False, "diagnostic": False}),
        ]:
            with self.subTest(source=source_size, diagnostic=diagnostic_size):
                source.write_bytes(b"s" * source_size)
                diagnostic.write_bytes(b"d" * diagnostic_size)
                with patch.object(PROBE, "ARTIFACT_LIMIT", 12):
                    plan = PROBE.publication_plan(source, diagnostic)
                self.assertEqual(plan, expected)
                retained = source_size * plan["source"] + diagnostic_size * plan["diagnostic"]
                self.assertLessEqual(retained, 12)
        source.write_bytes(b"source")
        diagnostic.unlink()
        self.assertEqual(PROBE.publication_plan(source, diagnostic), {"source": True, "diagnostic": False})
        alias = self.root / "publication-link"
        alias.symlink_to(source)
        self.assertEqual(PROBE.publication_plan(alias, source), {"source": False, "diagnostic": True})
        fifo = self.root / "publication-fifo"
        os.mkfifo(fifo)
        self.assertEqual(PROBE.publication_plan(fifo, source), {"source": False, "diagnostic": True})

    def test_publication_cli_is_read_only_and_emits_only_fixed_flags(self):
        source = self.root / "publication-source.json"
        diagnostic = self.root / "publication-diagnostic.json"
        source.write_bytes(b"PRIVATE_SOURCE_SENTINEL")
        diagnostic.write_bytes(b"PRIVATE_DIAGNOSTIC_SENTINEL")
        before = [path.read_bytes() for path in [source, diagnostic]]
        command = ["/usr/bin/python3", "-I", "-S", str(OBSERVER), "--publication-only",
                   "--source-report", str(source), "--output", str(diagnostic), "--revision", "a" * 40]
        result = subprocess.run(command, env={"PATH": "/usr/bin"}, capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, b"source=true\ndiagnostic=true\n")
        self.assertEqual(result.stderr, b"")
        self.assertEqual([path.read_bytes() for path in [source, diagnostic]], before)
        diagnostic.unlink()
        missing = subprocess.run(command, env={"PATH": "/usr/bin"}, capture_output=True, timeout=5)
        self.assertEqual(missing.returncode, 1)
        self.assertEqual(missing.stdout, b"source=true\ndiagnostic=false\n")
        self.assertEqual(missing.stderr, b"")
        self.assertEqual(source.read_bytes(), before[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
