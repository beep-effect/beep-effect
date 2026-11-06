#!/usr/bin/env python3
"""Call original find_case_name over the sealed scan inputs, including its guard."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

SCAN_SHA = '9731078b964f5daa0c075b630a5fa236efe06cb297c123f45f39a637bbac9553'


def native(text):
    if text is None:
        return None
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def restore(value):
    if value is None:
        return None
    data, width = bytes.fromhex(value['bytes']), value['width']
    return ''.join(chr(int.from_bytes(data[index:index + width], 'little')) for index in range(0, len(data), width))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (
        '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f', '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite import helpers, models
    assert importlib.metadata.version('regex') == '2023.12.25'
    sha = lambda data: hashlib.sha256(data).hexdigest()
    repo = Path(__file__).resolve().parents[3]
    scan_file = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/case-name-scan.json'
    assert sha(scan_file.read_bytes()) == SCAN_SHA
    scan = json.loads(scan_file.read_bytes())
    assert scan['helpersSha256'] == sha((root / 'eyecite/helpers.py').read_bytes())
    original_process = helpers._process_case_name
    originals = {name: getattr(helpers.re, name) for name in ['search', 'match', 'sub', 'split']}
    calls, rows = [], []
    processing = False

    def process(*values, **kwargs):
        nonlocal processing
        processing = True
        return original_process(*values, **kwargs)

    def record(name):
        def invoke(*values, **kwargs):
            calls.append(name)
            return originals[name](*values, **kwargs)
        return invoke

    def snapshot(citation):
        return {'metadata': {key: native(value) if isinstance(value, str) else value for key, value in vars(citation.metadata).items()},
                'year': citation.year, 'fullSpanStart': citation.full_span_start, 'fullSpanEnd': citation.full_span_end,
                'span': list(citation.span()), 'fullSpan': list(citation.full_span())}

    for case in scan['cases']:
        request = case['request']
        for short in [False, True]:
            for seeded in [False, True]:
                words = [restore(word['data']) if word['kind'] == 'Text' else
                         getattr(models, word['kind'])(restore(word['data']), 0, 0,
                                                      groups={key: restore(value) for key, value in word['groups'].items()})
                         for word in request['words']]
                token = models.CitationToken('1 X 1', 100, 105, {'volume': '1', 'reporter': 'X', 'page': '1'})
                cls = models.ShortCaseCitation if short else models.FullCaseCitation
                metadata = {'year': 'PRIOR-Y'} if seeded else {}
                if short and seeded:
                    metadata['antecedent_guess'] = 'PRIOR-A'
                citation = cls(token, request['index'], span_start=0 if seeded else None,
                               full_span_start=777 if seeded else None, full_span_end=888 if seeded else None,
                               year=1998 if seeded else None, metadata=metadata)
                if seeded:
                    citation.metadata.plaintiff = 'PRIOR-P'
                    citation.metadata.defendant = 'PRIOR-D'
                document = models.Document(plain_text=''.join(str(word) for word in words) or ' ', words=words)
                before = snapshot(citation)
                calls.clear()
                processing = False
                error = None
                patches = [patch.object(helpers.re, name, record(name)) for name in originals]
                with patch.object(helpers, '_process_case_name', process):
                    for current in patches:
                        current.start()
                    try:
                        assert helpers.find_case_name(citation, document, short) is None
                    except (TypeError, ValueError, KeyError, IndexError) as exc:
                        error = type(exc).__name__
                    finally:
                        for current in reversed(patches):
                            current.stop()
                rows.append({'id': len(rows), 'scanCase': case['id'], 'short': short, 'seeded': seeded,
                             'before': before, 'after': snapshot(citation), 'processed': processing,
                             'error': error, 'regexCalls': list(calls)})
    output = {'schemaVersion': 'citation-plain-case-name/v1', 'oracleCommit': scan['oracleCommit'], 'oracleTree': scan['oracleTree'],
              'python': '3.11.15', 'regex': '2023.12.25', 'producerSha256': sha(Path(__file__).read_bytes()),
              'scanSha256': SCAN_SHA, 'sources': {name: sha((root / 'eyecite' / name).read_bytes()) for name in ['helpers.py', 'models.py']},
              'licenseSha256': sha((root / 'LICENSE').read_bytes()), 'cases': rows,
              'scope': 'Original default helper composition, not arbitrary supplied search dictionaries or target proof.'}
    formatter = ['bunx', '--no-install', 'biome']
    output['formatter'] = subprocess.check_output(formatter + ['--version'], cwd=repo, text=True).strip()
    fixture = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/plain-case-name.json'
    formatted = subprocess.run(formatter + ['format', '--stdin-file-path=' + str(fixture)],
                               input=json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + '\n',
                               cwd=repo, text=True, capture_output=True, check=True).stdout
    args.output.write_text(formatted)
    print(json.dumps({'cases': len(rows), 'processed': sum(row['processed'] for row in rows),
                      'errors': sum(row['error'] is not None for row in rows), 'regexCalls': sum(len(row['regexCalls']) for row in rows)}))


if __name__ == '__main__':
    main()
