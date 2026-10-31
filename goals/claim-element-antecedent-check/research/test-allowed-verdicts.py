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
                       'sampleCount': 3, 'questions': [{'id': f'q{i}', 'type': 'finding', 'claimId': str(i)} for i in range(3)],
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
        self.packet['claims'][2]['questions'] = []
        self.packet['questions'].pop()
        out = module.summarize(self.packet, self.export)
        self.assertEqual(out['sampleErroneousAlertFractionBounds'], [1/3, 1])
        self.assertIsNone(out['wilson95BinomialApproximation'])

    def test_complete_all_right_still_has_nonzero_upper_interval(self):
        self.export.update(complete=True, verdicts=[{'id': f'q{i}', 'verdict': 'right', 'reason': ''} for i in range(3)])
        out = module.summarize(self.packet, self.export)
        self.assertIsNone(out['claimLevelErroneousAlertRate'])
        self.assertIsNone(out['wilson95BinomialApproximation'])
        self.assertFalse(out['actualAttorneyAdjudicationRecorded'])
        interval = module.wilson_interval(0, 3)
        self.assertGreater(interval[1], .5)

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

    def test_claim_question_ownership_and_denominator_controls(self):
        mutations = [lambda p: p.update(sampleCount=0), lambda p: p.update(sampleCount=True),
                     lambda p: p['claims'][1].update(claimId='0'),
                     lambda p: p['questions'].append(copy.deepcopy(p['questions'][0])),
                     lambda p: p['claims'][0].update(questions=['q1']),
                     lambda p: p['claims'][0].update(questions=['q0', 'q0']),
                     lambda p: p['claims'][0].update(questions=[]),
                     lambda p: p['questions'][0].update(type='unknown'),
                     lambda p: p['questions'].append({'id': 'orphan', 'type': 'finding', 'claimId': '0'})]
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                packet = copy.deepcopy(self.packet)
                mutate(packet)
                with self.assertRaises(ValueError):
                    module.summarize(packet, self.export)

    def test_explicit_attorney_confirmation_gates_metrics_synthetic_control_only(self):
        # The synthetic answers below are confined to this test; never write an
        # actual adjudication receipt or attach them to the real source packet.
        self.export.update(complete=True, verdicts=[{'id': f'q{i}', 'verdict': 'right', 'reason': ''} for i in range(3)])
        out = module.summarize(self.packet, self.export, human_attorney_ref='R1')
        self.assertEqual(out['claimLevelErroneousAlertRate'], 0)
        self.assertGreater(out['wilson95BinomialApproximation'][1], .5)
        for marker in [{'reviewSource': 'interface-preview'}, {'reviewSource': 'agent-input'}, {'synthetic': True}, {'synthetic': 1}, {'preview': True}, {'reviewerRole': 'non-attorney'}]:
            export = dict(self.export, **marker)
            with self.assertRaises(ValueError):
                module.summarize(self.packet, export, human_attorney_ref='R1')
        with self.assertRaises(ValueError):
            module.summarize(self.packet, self.export, human_attorney_ref='Personal Name')

    def test_nonboolean_complete_flag_is_rejected(self):
        self.export['complete'] = 'false'
        with self.assertRaises(ValueError):
            module.summarize(self.packet, self.export)


if __name__ == '__main__':
    unittest.main()
