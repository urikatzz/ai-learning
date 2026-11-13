#!/usr/bin/env python3
"""Validate glossary references; optionally check external source URLs with curl."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from html import unescape
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text()

def data(name):
    match = re.search(r'const ' + re.escape(name) + r' = (.*?);\n', HTML, re.S)
    return json.loads(match.group(1))

def validate():
    notes, sources = data('notes'), data('sources')
    slugs = {n['slug'] for n in notes}
    titles = {n['title'] for n in notes}
    assert len(slugs) == len(notes) == len(titles), 'Duplicate title or slug'
    for note in notes:
        assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', note['slug']), note['slug']
        assert note['category'] in {'agents', 'rag', 'models', 'ml', 'platforms', 'systems'}
        assert set(note['related']) <= titles, note['title'] + ': unknown related term'
        assert set(note['sources']) <= sources.keys(), note['title'] + ': unknown source'
        if not note.get('pending'):
            for key in ('what', 'detail', 'how', 'example', 'watch', 'sources'):
                assert note.get(key), note['title'] + ': missing ' + key
    assert set(data('diagrams')) <= slugs
    assert set(data('studyQuestions')) <= slugs
    for path in data('learningPaths'):
        assert set(path['terms']) <= slugs, path['title']
    for label, url in sources.values():
        assert label and url.startswith('https://'), url
    # Parse the actual script with Node, without executing browser code.
    with tempfile.NamedTemporaryFile(suffix='.js', mode='w') as script:
        script.write(re.search(r'<script>(.*?)</script>', HTML, re.S).group(1))
        script.flush()
        subprocess.run(['node', '--check', script.name], check=True)
    print(f"PASS: {len(notes)} unique terms, {sum(not n.get('pending', False) for n in notes)} explanations, "
          f"{len(sources)} source references; learning paths, related links, diagrams, JavaScript syntax.")
    return sources

def check_link(item):
    key, (label, url) = item
    with tempfile.NamedTemporaryFile() as body:
        result = subprocess.run(['curl', '-L', '-sS', '--max-time', '35', '--retry', '1',
                                 '-o', body.name, '-w', '%{http_code}\t%{url_effective}', url],
                                capture_output=True, text=True)
        content = Path(body.name).read_text(errors='replace')
    status, _, final_url = result.stdout.partition('\t')
    title = re.search(r'<title[^>]*>(.*?)</title>', content, re.S | re.I)
    title = unescape(re.sub('<.*?>', '', title.group(1))).strip() if title else ''
    soft_error = "The documentation page" in content[:500] and "doesn't exist" in content[:500]
    ok = result.returncode == 0 and status.startswith('2') and not soft_error and bool(content)
    return dict(key=key, label=label, url=url, status=status, final_url=final_url,
                title=title, ok=ok, error=result.stderr.strip())

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--links', action='store_true', help='Check HTTP reachability (requires network and curl).')
    parser.add_argument('--report', type=Path, help='Write link results as JSON; use with --links.')
    args = parser.parse_args()
    sources = validate()
    if args.links:
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(check_link, sources.items()))
        if args.report:
            args.report.write_text(json.dumps(results, indent=2, ensure_ascii=False) + '\n')
        failures = [r for r in results if not r['ok']]
        for r in failures:
            print('FAIL:', r['key'], r['status'], r['url'], r['error'])
        print(f"Links: {len(results)-len(failures)}/{len(results)} reachable. HTTP success does not establish factual accuracy.")
        raise SystemExit(bool(failures))
