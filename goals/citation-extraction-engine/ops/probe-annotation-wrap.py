#!/usr/bin/env python3
"""Observe unchanged eyecite wrap_html_tags, replacement errors and warnings."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import re._parser
import subprocess
import sys
import warnings


def native(text):
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text)) <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    pin, tree = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (pin, tree, '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite.utils import wrap_html_tags
    texts = ['', 'plain', '<>', '<a>', '<a>x</a>', '<<a>>', '<a\nB>', '<a><b></a>',
             '<i>\ud800\ud83d\ude00</i>', '<i>😀\ud83d\ude00</i>', '<i>\x00</i>', '<i attr=">">x']
    values = ['', '[', ']', '\\', '\\n', '\\a', '\\b', '\\f', '\\r', '\\t', '\\v', '\\\\',
              '\\&', '\\_', '\\é', '\\😀', '\\q', '\\x41', '\\u0041', '\\1', '\\0', '\\00', '\\000',
              '\\07', '\\077', '\\377', '\\400', '\\777', '\\08', '\\100', '\\10', '\\11', '\\18', '\\99',
              '\\g<0>', '\\g<1>', '\\g<01>', '\\g<+1>', '\\g< 1 >', '\\g<١>', '\\g<1_0>', '\\g<-1>',
              '\\g<2>', '\\g<name>', '\\g<é>', '\\g<>', '\\g', '\\g<1', '\\g<1073741823>', '\\g<+2>', '2', '8']
    pairs = [(value, ']') for value in values] + [('[', value) for value in values]
    pairs += [('\\', '1'), ('\\', '\\n'), ('\\g<', '>'), ('\\0', '7'), ('\\1', '0'), ('😀', '\ud800')]
    rows = []
    for text in texts:
        for before, after in pairs:
            re.purge()  # Explicit cold template cache for each independent observation.
            with warnings.catch_warnings(record=True) as observed:
                warnings.simplefilter('always')
                try:
                    result = {'_tag': 'Success', 'text': native(wrap_html_tags(text, before, after))}
                except (re.error, IndexError) as error:
                    result = {'_tag': 'Failure', 'kind': type(error).__name__, 'message': native(str(error))}
            rows.append({'id': len(rows), 'source': native(text), 'before': native(before), 'after': native(after),
                         'matches': [{'start': m.start(), 'end': m.end()} for m in re.finditer(r'(<[^>]+>)', text)],
                         'warnings': [w.category.__name__ for w in observed], 'result': result})
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    out = {'schemaVersion': 'citation-annotation-wrap/v1', 'oracleCommit': pin, 'oracleTree': tree,
           'python': '3.11.15', 'cacheState': 'cold-per-case', 'producerSha256': sha(Path(__file__).read_bytes()),
           'utilsSha256': sha((root / 'eyecite/utils.py').read_bytes()),
           'templateParserSha256': sha(Path(re._parser.__file__).read_bytes()),
           'pattern': native(r'(<[^>]+>)'), 'cases': rows}
    args.output.write_text(json.dumps(out, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'cases': len(rows), 'success': sum(r['result']['_tag']=='Success' for r in rows),
                      'failure': sum(r['result']['_tag']=='Failure' for r in rows),
                      'warnings': sum(len(r['warnings']) for r in rows)}))


if __name__ == '__main__':
    main()
