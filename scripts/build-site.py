"""Package the website and paper PDFs for GitHub Pages."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / '_site'
if target.exists():
    shutil.rmtree(target)
shutil.copytree(ROOT / 'docs', target)

# Copy only PDFs; reproduction code, datasets, and notes stay outside the site.
pdfs = sorted((ROOT / 'papers').rglob('*.pdf'))
for source in pdfs:
    destination = target / source.relative_to(ROOT)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
print(f'Site: {len(pdfs)} PDFs included')
