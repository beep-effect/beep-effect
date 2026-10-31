"""Validate an actual review export and summarize claim-level erroneous alerts.

No export -> no adjudicated estimate. Never accepts resolved-only denominators.
Usage: python3 .../summarize-allowed-verdicts.py PACKET_JSON VERDICTS_JSON
Output is a derived summary; source files are read-only. Synthetic controls must
remain labelled synthetic and must never be stored as human adjudication.
"""
import hashlib
import json
import math
import pathlib
import sys


def summarize(packet, export):
    if packet['schemaVersion'] != 'claim-allowed-attorney-packet/v1':
        raise ValueError('Unsupported packet schema.')
    if export['schemaVersion'] != 'claim-allowed-attorney-verdicts/v1':
        raise ValueError('Unsupported verdict schema.')
    for field in ['bundleDigest', 'sampleSha256', 'implementationDigest', 'resultsSha256']:
        if packet[field] != export[field]:
            raise ValueError('Review export is bound to a different ' + field)
    by_id = {q['id']: q for q in packet['questions']}
    answers = {}
    for row in export['verdicts']:
        if row['id'] not in by_id or row['id'] in answers:
            raise ValueError('Unknown or duplicate verdict id.')
        if row['verdict'] not in ['right', 'wrong', 'uncertain']:
            raise ValueError('Invalid verdict.')
        if not isinstance(row.get('reason'), str):
            raise ValueError('A verdict reason must be text.')
        if row['verdict'] != 'right' and not row['reason'].strip():
            raise ValueError('Wrong or uncertain verdict requires a reason.')
        answers[row['id']] = row
    # A claimed complete export cannot silently omit questions. Partial exports
    # remain admissible and explicit; input failures never become clean claims.
    if export.get('complete') and len(answers) != len(by_id):
        raise ValueError('Export claims completion but omits questions.')
    positive, negative, unknown = [], [], []
    for claim in packet['claims']:
        if claim['status'] != 'checked':
            unknown.append(claim['claimId'])
            continue
        questions = [by_id[qid] for qid in claim['questions']]
        if any(q['type'] == 'finding' and answers.get(q['id'], {}).get('verdict') == 'wrong' for q in questions):
            positive.append(claim['claimId'])
        elif questions and all(answers.get(q['id'], {}).get('verdict') == 'right' for q in questions):
            negative.append(claim['claimId'])
        else:
            unknown.append(claim['claimId'])
    n = packet['sampleCount']
    if len(positive) + len(negative) + len(unknown) != n:
        raise ValueError('Sample denominator does not match packet claims.')
    rate = None
    interval = None
    if not unknown:
        rate = len(positive) / n
        z = 1.959963984540054
        denominator = 1 + z*z/n
        center = (rate + z*z/(2*n)) / denominator
        half = z * math.sqrt(rate*(1-rate)/n + z*z/(4*n*n)) / denominator
        interval = [max(0.0, center-half), min(1.0, center+half)]
    return {'schemaVersion': 'claim-allowed-adjudicated-summary/v1',
            'bundleDigest': packet['bundleDigest'], 'implementationDigest': packet['implementationDigest'],
            'sampleCount': n, 'answeredQuestions': len(answers), 'questionCount': len(by_id),
            'claimsWithConfirmedErroneousFinding': positive,
            'claimsWithoutErroneousEmittedFinding': negative, 'unresolvedClaims': unknown,
            'sampleErroneousAlertFractionBounds': [len(positive)/n, (len(positive)+len(unknown))/n],
            'boundsAreConfidenceInterval': False,
            'claimLevelErroneousAlertRate': rate, 'wilson95BinomialApproximation': interval,
            'estimand': 'Claim-level erroneous emitted advisory alert rate on the frozen allowed sample; not finding precision or a clean-claim specificity estimate.',
            'intervalCaveat': 'Wilson binomial approximation for simple random sampling without replacement; no finite-population correction. Unresolved claims suppress the point estimate and interval.'}


if __name__ == '__main__':
    packet, export = (json.loads(pathlib.Path(p).read_text()) for p in sys.argv[1:])
    payload = {k: v for k, v in packet.items() if k != 'bundleDigest'}
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    if digest != packet['bundleDigest']:
        raise ValueError('Packet content no longer matches its bundle digest.')
    print(json.dumps(summarize(packet, export), indent=2))
