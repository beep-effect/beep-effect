"""Synthetic-only component and admission tests; never opens repository corpus data."""
import copy
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest import mock


SPEC = importlib.util.spec_from_file_location("census", pathlib.Path(__file__).with_name("census-components.py"))
census = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(census)


def anchor(start, quote):
    return {"startChar": start, "endChar": start + len(quote), "quote": quote}


def tree(number=1):
    root, child = str(number), f"{number}.a"
    first, second = anchor(0, "A sensor"), anchor(13, "the sensor")
    return {"claimNumber": number, "elements": [
        {"path": root, "kind": "preamble-subject", "anchor": first,
         "terms": [{"anchor": first, "determiner": "a", "head": "sensor"}]},
        {"path": child, "kind": "limitation", "anchor": second,
         "terms": [{"anchor": second, "determiner": "the", "head": "sensor"}]}],
        "edges": [{"kind": "part-of", "child": child, "parent": root},
                  {"kind": "antecedent", "referring": {"path": child, "anchor": second},
                   "introducing": {"path": root, "anchor": first}}]}


def score(number=1, strict=False, missing=False):
    return {"claimNumber": number, "strict": strict, "predictionMissing": missing,
            "parsed": True, "abstained": True}


class ComponentTests(unittest.TestCase):
    def row(self, expected, actual, strict=False):
        return census.components([expected], [actual] if actual else [],
                                 [score(expected["claimNumber"], strict, actual is None)])[0]

    def test_exact_control_has_no_features_or_raw_text(self):
        row = self.row(tree(), tree(), True)
        self.assertEqual(row["features"], [])
        self.assertNotIn("sensor", json.dumps(row))

    def test_kind_is_separate_from_span_and_term_identity(self):
        actual = tree()
        actual["elements"][1]["kind"] = "functional-relation"
        metrics = self.row(tree(), actual)["metrics"]
        self.assertEqual(metrics["elementSpan"]["matched"], 2)
        self.assertEqual(metrics["elementKindGivenSpan"], {"compared": 2, "matched": 1, "unavailable": 0})
        self.assertEqual(metrics["termHeadGivenAnchor"]["matched"], 2)
        self.assertEqual(metrics["conditionalEdge:part-of"]["unavailableGold"], 1)

    def test_boundary_change_reports_missing_endpoints(self):
        actual = tree()
        actual["elements"][1]["anchor"] = anchor(12, " the sensor")
        row = self.row(tree(), actual)
        self.assertIn("elementSpan", row["features"])
        self.assertEqual(row["metrics"]["conditionalEdge:antecedent"]["unavailableGold"], 1)
        self.assertEqual(row["metrics"]["termAnchor"]["matched"], 2)

    def test_same_span_different_kind_is_ambiguous_for_conditional_kind_only(self):
        expected = tree()
        element = copy.deepcopy(expected["elements"][1])
        element.update(path="1.b", kind="functional-relation", terms=[])
        expected["elements"].append(element)
        row = self.row(expected, copy.deepcopy(expected), True)
        self.assertEqual(row["metrics"]["elementSpan"]["matched"], 3)
        self.assertEqual(row["metrics"]["elementKindGivenSpan"]["compared"], 1)
        self.assertEqual(row["metrics"]["elementKindGivenSpan"]["unavailable"], 1)

    def test_reference_dangling_parent_refuses_instead_of_inventing_mapping(self):
        expected = tree()
        expected["edges"][0]["parent"] = "1.missing"
        with self.assertRaisesRegex(ValueError, "Reference edge endpoint"):
            self.row(expected, tree())

    def test_term_head_and_determiner_do_not_become_segmentation(self):
        actual = tree()
        actual["elements"][1]["terms"][0].update(head="transducer", determiner="said")
        row = self.row(tree(), actual)
        self.assertIn("termHeadGivenAnchor", row["features"])
        self.assertIn("termDeterminerGivenAnchor", row["features"])
        self.assertNotIn("elementSpan", row["features"])
        self.assertNotIn("termOrderGivenElement", row["features"])

    def test_term_order_and_ownership_separated(self):
        expected = tree()
        extra = {"anchor": anchor(24, "a wire"), "head": "wire", "determiner": "a"}
        expected["elements"][1]["terms"].append(extra)
        actual = copy.deepcopy(expected)
        actual["elements"][1]["terms"].reverse()
        row = self.row(expected, actual)
        self.assertIn("termOrderGivenElement", row["features"])
        self.assertNotIn("termOwnershipGivenAnchor", row["features"])
        actual = copy.deepcopy(expected)
        actual["elements"][0]["terms"].append(actual["elements"][1]["terms"].pop())
        row = self.row(expected, actual)
        self.assertIn("termOwnershipGivenAnchor", row["features"])
        self.assertNotIn("termAnchor", row["features"])

    def test_repeated_mention_anchor_is_unavailable_not_arbitrary(self):
        expected = tree()
        expected["elements"][0]["terms"].append(copy.deepcopy(expected["elements"][1]["terms"][0]))
        row = self.row(expected, copy.deepcopy(expected), True)
        self.assertEqual(row["ambiguousMentionAnchors"], 1)
        self.assertEqual(row["metrics"]["termHeadGivenAnchor"]["compared"], 1)
        self.assertEqual(row["metrics"]["conditionalEdge:antecedent"]["unavailableGold"], 1)
        self.assertIn("ambiguous-mention-anchor", row["features"])

    def test_duplicate_nodes_and_paths_and_claims_fail(self):
        for change in ("identity", "path", "claim"):
            with self.subTest(change=change):
                expected = tree()
                if change == "claim":
                    trees = [expected, copy.deepcopy(expected)]
                else:
                    duplicate = copy.deepcopy(expected["elements"][1])
                    duplicate["path"] = "1.b" if change == "identity" else "1.a"
                    if change == "path":
                        duplicate["anchor"] = anchor(30, "a wire")
                    expected["elements"].append(duplicate)
                    trees = [expected]
                with self.assertRaisesRegex(ValueError, "Duplicate or ambiguous"):
                    census.family_index(trees)

    def test_cross_claim_donor_and_parent_keep_family_identity(self):
        first, second = tree(), tree(2)
        second["edges"].append({"kind": "depends-on-element", "dependent": "2", "ancestor": "1"})
        second["edges"][1]["introducing"]["path"] = "1"
        actual = copy.deepcopy(second)
        actual["edges"][1]["introducing"]["path"] = "2"
        rows = census.components([first, second], [copy.deepcopy(first), actual], [score(1, True), score(2)])
        row = rows[1]
        self.assertEqual(row["metrics"]["conditionalEdge:antecedent"]["matched"], 0)
        self.assertEqual(row["metrics"]["claimParentFromEdges"]["matched"], 1)
        self.assertEqual(row["metrics"]["antecedentGivenMention"]["matched"], 0)

    def test_multiple_element_dependencies_do_not_manufacture_claim_parents(self):
        first, second = tree(), tree(2)
        edge = {"kind": "depends-on-element", "dependent": "2", "ancestor": "1"}
        second["edges"].append(edge)
        actual = copy.deepcopy(second)
        actual["edges"].append({"kind": "depends-on-element", "dependent": "2.a", "ancestor": "1.a"})
        row = census.components([first, second], [copy.deepcopy(first), actual], [score(2)])[0]
        self.assertEqual(row["metrics"]["claimParentFromEdges"],
                         {"gold": 1, "predicted": 1, "matched": 1, "unavailableGold": 0, "unavailablePredicted": 0})
        self.assertEqual(row["metrics"]["edge:depends-on-element"]["gold"], 1)
        self.assertEqual(row["metrics"]["edge:depends-on-element"]["predicted"], 2)

    def test_parent_and_functional_parts_are_directed_and_ordered(self):
        expected = tree()
        expected["edges"].append({"kind": "functional", "element": "1.a", "parts": [
            {"kind": "term", "term": {"path": "1.a", "anchor": anchor(13, "the sensor")}},
            {"kind": "text", "anchor": anchor(23, "!")} ]})
        actual = copy.deepcopy(expected)
        actual["edges"][-1]["parts"].reverse()
        row = self.row(expected, actual)
        self.assertEqual(row["metrics"]["conditionalEdge:functional"]["matched"], 0)
        self.assertNotIn("elementSpan", row["features"])
        actual = copy.deepcopy(expected)
        actual["edges"][0].update(child="1", parent="1.a")
        row = self.row(expected, actual)
        self.assertEqual(row["metrics"]["conditionalEdge:part-of"]["matched"], 0)

    def test_missing_prediction_preserves_denominator(self):
        row = self.row(tree(), None)
        self.assertTrue(row["predictionMissing"])
        self.assertEqual(row["metrics"]["elementSpan"],
                         {"gold": 2, "predicted": 0, "matched": 0, "unavailableGold": 0, "unavailablePredicted": 0})
        self.assertEqual(row["metrics"]["conditionalEdge:antecedent"]["unavailableGold"], 1)


class AdmissionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = pathlib.Path(self.temporary.name)
        self.root, self.replay = self.base / "repo", self.base / "replay"
        self.root.mkdir()
        self.replay.mkdir()
        self.output, self.seal = self.base / "census", self.base / "seal.json"
        self.files, self.families = [], []
        position = 0
        for index in range(60):
            family = f"{10000000 + index}-root-1"
            count = 8 if index < 2 else 9
            expected, records, scores = [], [], []
            for number in range(1, count + 1):
                position += 1
                value = tree(number)
                expected.append(value)
                actual = copy.deepcopy(value)
                strict = position <= 46
                missing = position == 538
                if not strict:
                    actual["elements"][1]["terms"][0]["head"] = "changed"
                records.append({"decomposition": {"status": "undecomposed" if missing else "decomposed",
                    "qualification": {"record": {"sourceOrdinal": number}}, **({} if missing else {"tree": actual})}})
                scores.append(score(number, strict, missing))
            path = self.root / census.REFERENCE_ROOT / family / "expected.json"
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps(expected))
            self.write_replay(f"{family}.prediction.json", {"report": {"records": records}})
            self.write_replay(f"{family}.service.json", {})
            self.families.append({"familyId": family, "claims": scores, "inputFailure": None})
        self.write_replay("results.json", {"schemaVersion": "claim-input-tool-evaluation/v1",
                                          "implementationDigest": "synthetic", "families": self.families})
        self.seal.write_text(json.dumps({"resultDirectory": str(self.replay), "files": self.files}))
        self.sha = next(f["sha256"] for f in self.files if f["path"] == "results.json")

    def write_replay(self, name, data):
        raw = json.dumps(data).encode()
        (self.replay / name).write_bytes(raw)
        self.files.append({"path": name, "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)})

    def run_census(self):
        with mock.patch.object(census, "RESULT_SHA256", self.sha):
            return census.run(self.root, self.replay, self.seal, self.output)

    def test_complete_synthetic538_with_missing_tree_and46_retained(self):
        report = self.run_census()
        self.assertEqual(len(report["claims"]), 538)
        self.assertEqual(report["authoritativeStrict"], 46)
        self.assertEqual(len(report["retainedStrictClaims"]), 46)
        self.assertTrue(report["diagnosticOnly"])
        self.assertEqual(sum(p["claims"] for p in report["patterns"]), 538)
        self.assertEqual(report["overlappingFeatureCounts"]["prediction-missing"], 1)
        text = (self.output / "census.json").read_text()
        self.assertNotIn("sensor", text)
        self.assertNotIn("quote", text)
        self.assertEqual(len(report["inputsUsed"]), 122)  # seal, results, 60 reference/prediction pairs

    def test_tampered_results_or_prediction_is_refused_before_output(self):
        for name in ("results.json", self.files[0]["path"]):
            with self.subTest(name=name):
                path = self.replay / name
                old = path.read_bytes()
                path.write_bytes(old + b" ")
                with self.assertRaisesRegex(ValueError, "Sealed input identity"):
                    self.run_census()
                self.assertFalse(self.output.exists())
                path.write_bytes(old)

    def test_wrong_result_pin_refuses_even_self_consistent_seal(self):
        with self.assertRaisesRegex(ValueError, "Pinned results SHA"):
            census.run(self.root, self.replay, self.seal, self.output)
        self.assertFalse(self.output.exists())

    def test_fresh_output_existing_or_overlapping_paths_refused(self):
        self.output.mkdir()
        marker = self.output / "keep.txt"
        marker.write_text("preserve")
        with self.assertRaisesRegex(ValueError, "fresh directory"):
            self.run_census()
        self.assertEqual(marker.read_text(), "preserve")
        for destination in (self.root / "new", self.replay / "new", self.base / "absent" / ".."):
            with self.subTest(destination=str(destination)):
                with self.assertRaises(ValueError):
                    census.output_path(self.root, self.replay, self.seal, destination)

    def test_symlink_or_path_escape_refused(self):
        (self.replay / "linked").symlink_to(self.root, target_is_directory=True)
        for name in ("../seal.json", "/etc/passwd", "linked/data.json"):
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    census.checked_path(self.replay, name)
        reference = self.root / census.REFERENCE_ROOT / self.families[0]["familyId"] / "expected.json"
        raw = reference.read_bytes()
        reference.unlink()
        elsewhere = self.base / "foreign.json"
        elsewhere.write_bytes(raw)
        reference.symlink_to(elsewhere)
        with self.assertRaisesRegex(ValueError, "Symlink"):
            self.run_census()
        self.assertFalse(self.output.exists())

    def test_trusted_base_and_ancestor_aliases_accept_complete_synthetic_census(self):
        alias = self.base / "trusted-alias"
        alias.symlink_to(self.base, target_is_directory=True)
        with mock.patch.object(census, "RESULT_SHA256", self.sha):
            report = census.run(alias / "repo", alias / "replay", alias / "seal.json", alias / "census")
        self.assertEqual(report["selectedClaims"], 538)
        self.assertEqual(report["authoritativeStrict"], 46)
        self.assertEqual(len(report["retainedStrictClaims"]), 46)
        self.assertTrue(self.output.is_dir())

    def test_symlink_below_trusted_base_refused_even_when_target_stays_inside(self):
        (self.replay / "linked").symlink_to(self.replay, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "Symlink"):
            census.checked_path(self.replay, "linked/results.json")

    def test_output_alias_into_input_and_dangling_output_leaf_refused(self):
        alias = self.base / "input-alias"
        alias.symlink_to(self.replay, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "overlap"):
            census.output_path(self.root, self.replay, self.seal, alias / "new")
        self.output.symlink_to(self.base / "absent")
        with self.assertRaisesRegex(ValueError, "fresh directory"):
            census.output_path(self.root, self.replay, self.seal, self.output)

    def test_extra_or_escaped_seal_file_and_duplicate_entries_refused(self):
        original = self.seal.read_text()
        for name in ("../foreign.prediction.json", self.files[0]["path"]):
            data = json.loads(original)
            data["files"][-1] = {**data["files"][0], "path": name}
            self.seal.write_text(json.dumps(data))
            with self.assertRaises(ValueError):
                self.run_census()
            self.assertFalse(self.output.exists())
        self.seal.write_text(original)


if __name__ == "__main__":
    unittest.main()
