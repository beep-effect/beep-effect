#!/usr/bin/env python3
"""Observe original short/Id./supra/unknown constructors from actual default Documents."""
import argparse
import ast
import hashlib
import importlib.metadata
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch


def native(text):
    if text is None:
        return None
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == ('04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f', '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    import regex
    from regex import _regex_core as core
    from eyecite import find, helpers, models, regexes, tokenizers
    assert importlib.metadata.version('regex') == '2023.12.25' and regex.DEFAULT_VERSION == regex.V0
    ops = Path(__file__).resolve().parent
    def load(name, path):
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    normalizer = load('operations', ops / 'export-operations.py')
    normalize, _ = normalizer.make_normalizer(root)
    profile_source = ops / 'probe-regex-verbose.py'
    parsed = ast.parse(profile_source.read_text())
    original_main = next(node for node in parsed.body if isinstance(node, ast.FunctionDef) and node.name == 'main')
    profile_function = next(node for node in original_main.body if isinstance(node, ast.FunctionDef) and node.name == 'v0_profile')
    profile_namespace = {'core': core}
    exec(compile(ast.Module(body=[profile_function], type_ignores=[]), str(profile_source), 'exec'), profile_namespace)
    v0_profile = profile_namespace['v0_profile']
    sha = lambda data: hashlib.sha256(data).hexdigest()
    refs = {id(e): normalize(e)['artifactSha256'] for extractor in tokenizers.EXTRACTORS
            for key in ['exact_editions', 'variation_editions'] for e in extractor.extra.get(key, [])}
    reference = lambda e: None if e is None else refs[id(e)]
    pattern = regexes.SUPRA_ANTECEDENT_REGEX
    bindings = []
    for raw in [f'^(?:{pattern})', f'(?:{pattern})$']:
        compiled = regex.compile(raw, 64)
        info, source = core.Info(64 | core.VERSION0 | core.UNICODE), core.Source(raw)
        source.ignore_space = bool(64 & regex.X)
        tree = core._parse_pattern(source, info)
        assert compiled.groups == 2 and dict(compiled.groupindex) == info.group_index
        width, _, repeated, nullable = v0_profile(tree)
        word = native(raw)
        bindings.append({'patternSha256': sha(bytes([word['width']]) + bytes.fromhex(word['bytes'])), 'flags': 64,
                         'profile': {'groups': compiled.groups, 'names': dict(compiled.groupindex), 'minimumWidthFloor': width,
                                     'repeatedCaptures': repeated, 'nullableMultiRepeat': nullable}})
    scenes = [
        'Foo, 1 U.S., at 2', '1 U.S., at 2', 'Foo at 2, 1 U.S.', 'Foo, 1 F.2d at 2',
        '<em>Foo</em>, 1 U.S., at 2', '<em>see</em>, 1 U.S., at 2',
        'Foo v. Bar, supra, 1 F.2d at 2', 'Adarand, 515 U.S. at 241',
        'Id.', 'Ibid. at 42', 'Id. at 42 (note)', 'Id., ¶ 12', 'Id. at 12–14.', 'Id. at ١٢', 'Id. at 0',
        'Smith, supra, at 240.', 'Smith, 515 supra, at 240.', 'supra', 'Smith supra.', 'Smith, supra, somethingelse',
        'é界😀, supra, at 2', '§ 2', '§§ 1 and 2', '§',
    ]
    rows, used, no_targets = [], {}, []
    original = {name: getattr(helpers.re, name) for name in ['search', 'match', 'sub', 'split']}
    calls = []
    def record(name):
        def invoke(*values, **kwargs):
            calls.append(name)
            return original[name](*values, **kwargs)
        return invoke
    for scene, text in enumerate(scenes):
        has_markup = text.startswith('<')
        document = models.Document(markup_text=text, clean_steps=['html']) if has_markup else models.Document(plain_text=text)
        document.tokenize(tokenizers.default_tokenizer)
        count = 0
        for index, token in document.citation_tokens:
            kind = type(token).__name__
            if type(token) is models.CitationToken and token.short:
                construct = lambda: find._extract_shortform_citation(document, index)
            elif type(token) is models.IdToken:
                construct = lambda: find._extract_id_citation(document.words, index)
            elif type(token) is models.SupraToken:
                construct = lambda: find._extract_supra_citation(document.words, index)
            elif type(token) is models.SectionToken:
                construct = lambda: models.UnknownCitation(token, index)
            else:
                continue
            count += 1
            exact, variation = list(getattr(token, 'exact_editions', [])), list(getattr(token, 'variation_editions', []))
            for edition in exact + variation:
                used[reference(edition)] = edition.reporter.source
            calls.clear()
            observers = [patch.object(helpers.re, name, record(name)) for name in original]
            for observer in observers:
                observer.start()
            expected = error = None
            try:
                citation = construct()
                expected = {'kind': type(citation).__name__, 'metadata': {key: native(value) if isinstance(value, str) else value for key, value in vars(citation.metadata).items()},
                            'span': list(citation.span()), 'spanEnd': citation.span_end, 'fullSpanStart': citation.full_span_start,
                            'fullSpanEnd': citation.full_span_end, 'fullSpan': list(citation.full_span())}
                if hasattr(citation, 'year'):
                    expected.update(year=citation.year, editionGuess=reference(citation.edition_guess))
            except (KeyError, TypeError, AttributeError) as failure:
                error = type(failure).__name__
            finally:
                for observer in reversed(observers):
                    observer.stop()
            rows.append({'id': len(rows), 'scene': scene, 'hasMarkup': has_markup, 'markup': native(text) if has_markup else None,
                         'plain': native(document.plain_text), 'index': index,
                         'words': [{'kind': 'Text' if isinstance(word, str) else type(word).__name__, 'data': native(str(word)),
                                    'start': getattr(word, 'start', None), 'groups': {k: native(v) for k, v in getattr(word, 'groups', {}).items()}} for word in document.words],
                         'token': {'kind': kind, 'data': native(token.data), 'start': token.start, 'end': token.end, 'groups': {k: native(v) for k, v in token.groups.items()},
                                   'exact': [reference(e) for e in exact], 'variation': [reference(e) for e in variation], 'short': getattr(token, 'short', False)},
                         'expected': expected, 'error': error, 'calls': list(calls)})
        if not count:
            no_targets.append({'scene': scene, 'plain': native(document.plain_text), 'hasMarkup': has_markup,
                               'tokenKinds': [type(token).__name__ for _, token in document.citation_tokens]})
    edition_bindings = [{'id': i, 'ref': ref, 'source': used[ref]} for i, ref in enumerate(sorted(used))]
    ids = {row['ref']: row['id'] for row in edition_bindings}
    for row in rows:
        for field in ['exact', 'variation']:
            row['token'][field] = [ids[ref] for ref in row['token'][field]]
    repo = ops.parents[2]
    word = native(pattern)
    output = {'schemaVersion': 'citation-reference-token/v1', 'oracleCommit': git('rev-parse', 'HEAD'), 'oracleTree': git('rev-parse', 'HEAD^{tree}'),
              'producerSha256': sha(Path(__file__).read_bytes()), 'normalizerSha256': sha((ops / 'export-operations.py').read_bytes()),
              'profileProducerSha256': sha((ops / 'probe-regex-verbose.py').read_bytes()), 'supraPatternSha256': sha(bytes([word['width']]) + bytes.fromhex(word['bytes'])),
              'configuration': {'supra': {'pattern': word, 'bindings': bindings}}, 'editionBindings': edition_bindings,
              'sources': {name: sha((root / 'eyecite' / name).read_bytes()) for name in ['find.py', 'models.py', 'helpers.py', 'tokenizers.py', 'regexes.py']},
              'licenseSha256': sha((root / 'LICENSE').read_bytes()), 'lockSha256': sha((root / 'uv.lock').read_bytes()), 'python': '3.11.15',
              'noTargetDocuments': no_targets, 'versions': {name: importlib.metadata.version(name) for name in ['eyecite', 'regex', 'lxml', 'reporters-db', 'courts-db']}, 'cases': rows,
              'scope': 'Actual built-in short/Id./supra/unknown constructors; no whole get_citations or general host mutation parity claim.'}
    formatter = ['bunx', '--no-install', 'biome']
    output['formatter'] = subprocess.check_output(formatter + ['--version'], cwd=repo, text=True).strip()
    fixture = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/reference-token.json'
    result = subprocess.run(formatter + ['format', '--stdin-file-path=' + str(fixture)], input=json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + '\n', cwd=repo, text=True, capture_output=True, check=True)
    args.output.write_text(result.stdout)
    print(json.dumps({'cases': len(rows), 'noTargets': len(no_targets), 'errors': sum(row['error'] is not None for row in rows), 'calls': sum(len(row['calls']) for row in rows),
                      'supraPatternSha256': output['supraPatternSha256'], 'kinds': {kind: sum(row['token']['kind'] == kind for row in rows) for kind in ['CitationToken', 'IdToken', 'SupraToken', 'SectionToken']}}))


if __name__ == '__main__':
    main()
