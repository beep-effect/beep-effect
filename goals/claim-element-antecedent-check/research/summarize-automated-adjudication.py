"""Source-bound automated review consensus; never claims attorney adjudication.

Usage: python3 .../summarize-automated-adjudication.py INPUT_JSON REVIEW_A_JSON REVIEW_B_JSON
"""
import argparse
import hashlib
import importlib.util
import json
import pathlib

spec = importlib.util.spec_from_file_location('review_boundary', pathlib.Path(__file__).with_name('summarize-allowed-verdicts.py'))
boundary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boundary)


def check_review(packet, review, *, input_sha256):
    if review.get('reviewAuthority') != 'automated':
        raise ValueError('This lane accepts explicitly automated reviews only.')
    if review.get('model') != 'gpt-6.1-sol' or review.get('effort') != 'medium':
        raise ValueError('Review model/effort does not match the declared review route.')
    if review.get('actualAttorneyAdjudicationRecorded') is not False or review.get('actualAttorneyAgreementRecorded', False) is not False:
        raise ValueError('Automated review cannot claim actual attorney authority.')
    if review.get('inputBundleDigest') != packet['bundleDigest'] or review.get('inputFileSha256') != input_sha256:
        raise ValueError('Automated review is bound to another input/runtime version.')
    if type(review.get('round')) is not int or not 1 <= review['round'] <= 3:
        raise ValueError('Review round is outside the bounded protocol.')
    questions = boundary.validate_packet_coverage(packet)
    claims = {c['claimId']: c for c in packet['claims']}
    rows = {}
    quote_checks = 0
    for row in review.get('verdicts', []):
        qid = row.get('id')
        if qid not in questions or qid in rows:
            raise ValueError('Duplicate or unknown automated question id.')
        if row.get('verdict') not in ['right', 'wrong', 'uncertain']:
            raise ValueError('Invalid automated verdict.')
        confidence = row.get('confidence')
        if type(confidence) not in [int, float] or not 0 <= confidence <= 1:
            raise ValueError('Invalid declared confidence.')
        reason = row.get('reason', row.get('rationale'))
        if not isinstance(reason, str) or not reason.strip():
            raise ValueError('Every automated judgment requires a substantive reason.')
        evidence = row.get('evidence', row.get('sourceEvidence', []))
        if not isinstance(evidence, list) or not evidence:
            raise ValueError('Every automated judgment requires exact source evidence.')
        selected = claims[questions[qid]['claimId']]
        for item in evidence:
            patent = item.get('patentNumber', item.get('patent', selected['patentNumber']))
            number = item.get('claimNumber', selected['claimNumber'])
            quote = item.get('quote', item.get('anchor', {}).get('quote'))
            if patent != selected['patentNumber'] or type(number) is not int:
                raise ValueError('Evidence must identify a claim in the same source patent.')
            contexts = packet['canonicalContext'].get(patent, [])
            text = next((c['claimText'] for c in contexts if c['claimNumber'] == number), None)
            if not text or not isinstance(quote, str) or not quote or quote not in text:
                raise ValueError('Automated evidence quote is not an exact source substring: ' + qid)
            quote_checks += 1
        rows[qid] = row
    if set(rows) != set(questions):
        raise ValueError('Automated review must cover every selected question exactly once.')
    if not isinstance(review.get('reviewerRole'), str) or not review['reviewerRole']:
        raise ValueError('Reviewer role is required for independence tracking.')
    return rows, quote_checks


def summarize(packet, review_a, review_b, *, input_sha256):
    if packet.get('schemaVersion') != 'claim-automated-finding-review-input/v1' or packet.get('reviewAuthority') != 'automated':
        raise ValueError('Wrong automated review input schema/authority.')
    a, aq = check_review(packet, review_a, input_sha256=input_sha256)
    b, bq = check_review(packet, review_b, input_sha256=input_sha256)
    if review_a['reviewerRole'] == review_b['reviewerRole']:
        raise ValueError('Independent reviewers must have distinct roles.')
    consensus = {}
    for qid in a:
        same = a[qid]['verdict'] == b[qid]['verdict'] and min(a[qid]['confidence'], b[qid]['confidence']) >= .95
        consensus[qid] = {'id': qid, 'verdict': a[qid]['verdict'] if same else 'uncertain',
                          'reviewerAVerdict': a[qid]['verdict'], 'reviewerBVerdict': b[qid]['verdict'],
                          'confidenceThresholdMet': min(a[qid]['confidence'], b[qid]['confidence']) >= .95,
                          'agreed': same}
    positive, negative, unknown = [], [], []
    questions = {q['id']: q for q in packet['questions']}
    category_counts = {}
    for qid, row in consensus.items():
        q = questions[qid]
        kind = q.get('finding', {}).get('kind', 'no-emitted-findings')
        counts = category_counts.setdefault(kind, {'right': 0, 'wrong': 0, 'uncertain': 0})
        counts[row['verdict']] += 1
    for claim in packet['claims']:
        ids = claim['questions']
        if claim['status'] != 'checked':
            unknown.append(claim['claimId'])
        elif any(questions[q]['type'] == 'finding' and consensus[q]['verdict'] == 'wrong' for q in ids):
            positive.append(claim['claimId'])
        elif ids and all(consensus[q]['verdict'] == 'right' for q in ids):
            negative.append(claim['claimId'])
        else:
            unknown.append(claim['claimId'])
    n = packet['sampleCount']
    if len(positive) + len(negative) + len(unknown) != n:
        raise ValueError('Claim classifications do not retain the fixed sample denominator.')
    k, u = len(positive), len(unknown)
    envelope = [boundary.wilson_interval(k, n)[0], boundary.wilson_interval(k+u, n)[1]]
    return {'schemaVersion': 'claim-automated-adjudication-summary/v1', 'reviewAuthority': 'automated',
            'actualAttorneyAgreementRecorded': False, 'actualAttorneyAdjudicationRecorded': False,
            'automatedAdjudicationRecorded': True, 'inputBundleDigest': packet['bundleDigest'],
            'implementationDigest': packet['implementationDigest'], 'runtimeVersion': packet['runtimeVersion'],
            'sampleSha256': packet['sampleSha256'], 'resultsSha256': packet['resultsSha256'],
            'sampleCount': n, 'populationCount': 3184, 'questionCount': len(questions),
            'claimsWithAgreedErroneousFinding': positive, 'claimsWithAllStatementsAgreedRight': negative,
            'unresolvedClaims': unknown, 'claimLevelErroneousAlertRate': k/n if not u else None,
            'identificationBounds': [k/n, (k+u)/n], 'identificationBoundsAreConfidenceInterval': False,
            'conditionalWilson95Envelope': envelope,
            'intervalKind': 'Wilson-binomial-approximation' if not u else 'Wilson-envelope-for-unresolved-sample-outcomes',
            'categoryCounts': category_counts, 'consensus': list(consensus.values()),
            'verifiedEvidenceQuotes': aq+bq, 'reviewerRoles': [review_a['reviewerRole'], review_b['reviewerRole']],
            'estimand': 'Automated-adjudication estimate of the fraction of the fixed 3184-claim allowed cohort receiving at least one erroneous emitted advisory statement.',
            'limitations': ['Self-assessed confidence is not calibrated probability.',
                           'Intervals approximate sampling uncertainty conditional on automated judgments; correlated model adjudication error is not covered.',
                           'The claim sample is unchanged but prior predictions informed development repairs; no fresh held-out validation is claimed.',
                           'Coverage warnings are separate from substantive alleged defects; allowed status does not prove antecedent correctness.',
                           'Not all-USPTO prevalence, finding-level precision, independently clean-claim specificity, attorney agreement or legal validation.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input')
    parser.add_argument('review_a')
    parser.add_argument('review_b')
    args = parser.parse_args()
    raw = pathlib.Path(args.input).read_bytes()
    packet = json.loads(raw)
    payload = {k: v for k, v in packet.items() if k != 'bundleDigest'}
    if hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest() != packet['bundleDigest']:
        raise ValueError('Automated input content differs from its bundle digest.')
    raw_a, raw_b = pathlib.Path(args.review_a).read_bytes(), pathlib.Path(args.review_b).read_bytes()
    result = summarize(packet, json.loads(raw_a), json.loads(raw_b), input_sha256=hashlib.sha256(raw).hexdigest())
    result.update(inputFileSha256=hashlib.sha256(raw).hexdigest(), reviewerASha256=hashlib.sha256(raw_a).hexdigest(), reviewerBSha256=hashlib.sha256(raw_b).hexdigest())
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
