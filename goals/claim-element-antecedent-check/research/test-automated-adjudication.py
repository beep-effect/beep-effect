"""Synthetic automated consensus controls; no attorney or corpus judgments."""
import copy
import importlib.util
import pathlib
import unittest
spec = importlib.util.spec_from_file_location('automated', pathlib.Path(__file__).with_name('summarize-automated-adjudication.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AutomatedBoundary(unittest.TestCase):
    def setUp(self):
        self.packet = {'schemaVersion': 'claim-automated-finding-review-input/v1', 'reviewAuthority': 'automated',
                       'bundleDigest': 'synthetic', 'implementationDigest': 'synthetic', 'runtimeVersion': 'synthetic',
                       'sampleSha256': 'synthetic', 'resultsSha256': 'synthetic', 'sampleCount': 2,
                       'claims': [{'claimId': 'p:1', 'patentNumber': 'p', 'claimNumber': 1, 'status': 'checked', 'questions': ['q1', 'q2']},
                                  {'claimId': 'p:2', 'patentNumber': 'p', 'claimNumber': 2, 'status': 'checked', 'questions': ['q3']}],
                       'questions': [{'id': q, 'claimId': c, 'type': 'finding', 'finding': {'kind': 'missing-antecedent'}}
                                     for q, c in [('q1', 'p:1'), ('q2', 'p:1'), ('q3', 'p:2')]],
                       'canonicalContext': {'p': [{'claimNumber': 1, 'claimText': 'the panel'}, {'claimNumber': 2, 'claimText': 'the frame'}]}}
        self.a = {'reviewAuthority': 'automated', 'reviewerRole': 'A', 'model': 'gpt-6.1-sol', 'effort': 'medium',
                  'round': 1, 'actualAttorneyAdjudicationRecorded': False, 'inputBundleDigest': 'synthetic',
                  'inputFileSha256': 'synthetic', 'verdicts': [{'id': q, 'verdict': 'right', 'confidence': .99,
                   'reason': 'Synthetic source test.', 'evidence': [{'patentNumber': 'p', 'claimNumber': n, 'quote': quote}]}
                   for q, n, quote in [('q1', 1, 'the panel'), ('q2', 1, 'the panel'), ('q3', 2, 'the frame')]]}
        self.b = copy.deepcopy(self.a)
        self.b['reviewerRole'] = 'B'

    def result(self):
        return module.summarize(self.packet, self.a, self.b, input_sha256='synthetic')

    def test_complete_consensus_is_automated_only_with_sampling_uncertainty(self):
        out = self.result()
        self.assertEqual(out['claimLevelErroneousAlertRate'], 0)
        self.assertFalse(out['actualAttorneyAdjudicationRecorded'])
        self.assertGreater(out['conditionalWilson95Envelope'][1], .5)

    def test_disagreement_and_low_confidence_remain_unknown(self):
        self.b['verdicts'][0]['verdict'] = 'wrong'
        self.a['verdicts'][2]['confidence'] = .94
        out = self.result()
        self.assertIsNone(out['claimLevelErroneousAlertRate'])
        self.assertEqual(out['identificationBounds'], [0, 1])

    def test_one_agreed_wrong_finding_establishes_positive_despite_another_unknown(self):
        for review in [self.a, self.b]:
            review['verdicts'][0]['verdict'] = 'wrong'
            review['verdicts'][1]['verdict'] = 'uncertain'
        out = self.result()
        self.assertEqual(out['claimLevelErroneousAlertRate'], .5)
        self.assertEqual(out['claimsWithAgreedErroneousFinding'], ['p:1'])

    def test_rejects_human_promotion_wrong_version_missing_duplicate_and_bad_quote(self):
        for mutate in [lambda r: r.update(reviewAuthority='human'), lambda r: r.update(actualAttorneyAdjudicationRecorded=True),
                       lambda r: r.update(inputBundleDigest='other'), lambda r: r.update(inputFileSha256='other'),
                       lambda r: r.update(verdicts=r['verdicts'][:-1]), lambda r: r['verdicts'].append(copy.deepcopy(r['verdicts'][0])),
                       lambda r: r['verdicts'][0]['evidence'][0].update(quote='invented'),
                       lambda r: r['verdicts'][0]['evidence'][0].update(patentNumber='other'), lambda r: r.update(reviewerRole='A')]:
            with self.subTest(mutate=mutate):
                candidate = copy.deepcopy(self.b)
                mutate(candidate)
                with self.assertRaises(ValueError):
                    module.summarize(self.packet, self.a, candidate, input_sha256='synthetic')


if __name__ == '__main__':
    unittest.main()
