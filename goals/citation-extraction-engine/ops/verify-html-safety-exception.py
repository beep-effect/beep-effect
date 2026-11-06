#!/usr/bin/env python3
"""Check the narrowly authorized HTML safety exception and reject scope expansion."""
import copy
import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
AUDIT = 'packages/law-practice/use-cases/test/fixtures/eyecite/html-cleaner-audit.json'
SHA = '049bbadd90348588e2e7a1c62daf1f5dba0b6865df9f2001b9461b8b80f9cb71'


def check(decision, raw):
    assert decision['schemaVersion'] == 1
    assert decision['id'] == 'native-html-resource-safety-2026-10-29'
    assert decision['status'] == 'approved' and decision['date'] == '2026-10-29'
    assert decision['authorization'] == {
        'source': 'direct human conversation reply',
        'questionItemId': ['request_user_input_async', 'call_392045c7df86459786267cd81e1a18f0', 0],
        'answer': 'Approve explicit safety divergence (Recommended)',
    }
    assert decision['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert decision['sourceAudit'] == {'path': AUDIT, 'sha256': SHA, 'evidencedCases': ['depth-256', 'depth-257', 'depth-300']}
    assert hashlib.sha256(raw).hexdigest() == SHA
    source = json.loads(raw)
    assert source['targetProof'] is None and source['divergenceApproval'] is None
    assert [row['name'] for row in source['cases'] if any(d['depthLimit'] for d in row['diagnostics'])] == decision['sourceAudit']['evidencedCases']
    assert decision['scope'] == {
        'trigger': 'native HTML parser resource exhaustion',
        'failureTag': 'CitationSafetyLimitExceeded', 'operation': 'clean',
        'limit': 'nativeHtmlParserResource', 'discardPartialResult': True,
        'preserveOtherHtmlBehavior': True, 'configurableLimitAdded': False,
    }
    assert decision['qualification'] == {
        'completionGuard': 'focused source-completion replay only',
        'nativeParserBackend': 'pending', 'canonicalCompletion': False, 'normalizationLaw': False,
    }


def main():
    decision = json.loads((REPO / 'goals/citation-extraction-engine/ops/html-safety-exception.json').read_bytes())
    raw = (REPO / AUDIT).read_bytes()
    check(decision, raw)
    mutations = [
        lambda d: d['scope'].update(trigger='all fatal parser diagnostics'),
        lambda d: d['scope'].update(discardPartialResult=False),
        lambda d: d['scope'].update(preserveOtherHtmlBehavior=False),
        lambda d: d['scope'].update(configurableLimitAdded=True),
        lambda d: d['scope'].update(failureTag='CitationParseFailure'),
        lambda d: d['qualification'].update(nativeParserBackend='qualified'),
        lambda d: d['qualification'].update(canonicalCompletion=True),
        lambda d: d['qualification'].update(normalizationLaw=True),
        lambda d: d['authorization'].update(answer='no reply'),
        lambda d: d['sourceAudit']['evidencedCases'].append('isolated-surrogate'),
    ]
    for mutate in mutations:
        corrupt = copy.deepcopy(decision)
        mutate(corrupt)
        try:
            check(corrupt, raw)
        except AssertionError:
            continue
        raise AssertionError('expanded or fabricated authorization accepted')
    try:
        check(decision, raw + b' ')
    except AssertionError:
        pass
    else:
        raise AssertionError('changed source accepted')
    print('PASS scoped human decision / unchanged source audit / 11 corruption controls; backend qualification remains pending')


if __name__ == '__main__':
    main()
