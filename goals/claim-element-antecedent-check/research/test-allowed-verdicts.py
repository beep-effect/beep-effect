"""Synthetic boundary controls only; these are not human review evidence."""
import copy
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('allowed_verdicts', pathlib.Path(__file__).with_name('summarize-allowed-verdicts.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReviewBoundary(unittest.TestCase):
    def setUp(self):
        self.packet = {'schemaVersion': 'claim-allowed-attorney-packet/v1', 'bundleDigest': 'synthetic',
                       'sampleSha256': 'synthetic', 'implementationDigest': 'synthetic', 'resultsSha256': 'synthetic',
                       'sampleCount': 3, 'questions': [{'id': f'q{i}', 'type': 'finding'} for i in range(3)],
                       'claims': [{'claimId': str(i), 'status': 'checked', 'questions': [f'q{i}']} for i in range(3)]}
        self.export = {k: self.packet[k] for k in ['bundleDigest', 'sampleSha256', 'implementationDigest', 'resultsSha256']}
        self.export.update(schemaVersion='claim-allowed-attorney-verdicts/v1', complete=False, verdicts=[])

    def test_empty_is_unknown_not_zero(self):
        out = module.summarize(self.packet, self.export)
        self.assertIsNone(out['claimLevelErroneousAlertRate'])
        self.assertEqual(out['sampleErroneousAlertFractionBounds'], [0, 1])

    def test_partial_wrong_retains_full_denominator_and_failed_claim(self):
        self.export['verdicts'] = [{'id': 'q0', 'verdict': 'wrong', 'reason': 'Synthetic control'}]
        self.packet['claims'][2]['status'] = 'input-failed'
        out = module.summarize(self.packet, self.export)
        self.assertEqual(out['sampleErroneousAlertFractionBounds'], [1/3, 1])
        self.assertIsNone(out['wilson95BinomialApproximation'])

    def test_complete_all_right_still_has_nonzero_upper_interval(self):
        self.export.update(complete=True, verdicts=[{'id': f'q{i}', 'verdict': 'right', 'reason': ''} for i in range(3)])
        out = module.summarize(self.packet, self.export)
        self.assertEqual(out['claimLevelErroneousAlertRate'], 0)
        self.assertGreater(out['wilson95BinomialApproximation'][1], .5)

    def test_uncertain_is_not_a_clean_claim(self):
        self.export['verdicts'] = [{'id': 'q0', 'verdict': 'uncertain', 'reason': 'Synthetic ambiguity'}]
        self.assertEqual(len(module.summarize(self.packet, self.export)['unresolvedClaims']), 3)

    def test_rejects_other_version_duplicate_unknown_and_false_completion(self):
        for mutate in [lambda e: e.update(bundleDigest='other'),
                       lambda e: e.update(verdicts=[{'id': 'unknown', 'verdict': 'right', 'reason': ''}]),
                       lambda e: e.update(verdicts=[{'id': 'q0', 'verdict': 'right', 'reason': ''}]*2),
                       lambda e: e.update(complete=True),
                       lambda e: e.update(verdicts=[{'id': 'q0', 'verdict': 'wrong', 'reason': ''}])]:
            with self.subTest(mutate=mutate):
                export = copy.deepcopy(self.export)
                mutate(export)
                with self.assertRaises(ValueError):
                    module.summarize(self.packet, export)


if __name__ == '__main__':
    unittest.main()
