"""Build the website's starter catalog from the repository's paper READMEs."""
from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://github.com/kongwoang/Gradient-Based-Learning/blob/main/'
SITE = 'https://kongwoang.github.io/Gradient-Based-Learning/'
papers = []
for line in (ROOT / 'README.md').read_text().splitlines():
    if not re.match(r'\| \d+ \|', line):
        continue
    columns = [value.strip() for value in line.strip('|').split('|')]
    _, topic, venue_year, method_link, focus = columns
    match = re.fullmatch(r'\[([^]]+)\]\(([^)]+)\)', method_link)
    method, folder = match.groups()
    paper_dir = ROOT / folder
    readme = (paper_dir / 'README.md').read_text()
    links = dict(re.findall(r'\[([^]]+)\]\(([^)]+)\)', readme))
    venue, year = venue_year.rsplit(' ', 1)
    papers.append({
        'id': paper_dir.name.lower(), 'method': method,
        'title': readme.splitlines()[2], 'topic': topic,
        'venue': venue, 'year': int(year), 'focus': focus,
        'categories': [focus], 'types': [], 'status': 'To read',
        'issues': '', 'motivation': '', 'contributions': '', 'ideas': '', 'notes': '',
        'source': links.get('Source', ''), 'code': links.get('Official code', ''),
        'pdf': SITE + folder + links['PDF'], 'folder': BASE + folder,
        'updatedAt': None,
    })
assert len(papers) == len(list((ROOT / 'papers').rglob('*.pdf')))
target = ROOT / 'docs/data/papers.json'
target.write_text(json.dumps(papers, ensure_ascii=False, indent=2) + '\n')
print(f'Catalog: {len(papers)} papers')
