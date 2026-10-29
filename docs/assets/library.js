export const STATUSES = ['To read', 'Reading', 'Read', 'Reproducing', 'Reproduced'];
export const TOPICS = ['MTL', 'CL', 'Multimodal', 'DG', 'FL', 'Other'];
export const TOPIC_NAMES = { MTL: 'Multi-task learning', CL: 'Continual learning', Multimodal: 'Multimodal learning', DG: 'Domain generalization', FL: 'Federated learning', Other: 'Other research' };
export const NOTE_FIELDS = { notes: 'Notes' };
export const NOTE_LIMIT = 300000;
const LEGACY_NOTE_FIELDS = { issues: 'Recent issues', motivation: 'Motivations', contributions: 'Contributions', ideas: 'Ideas & next steps' };
const ID = /^[a-z0-9][a-z0-9_-]{0,159}$/;
const text = (value, name, max = 50000) => {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error(`${name} must be text (up to ${max.toLocaleString()} characters).`);
  return value;
};
export function safeURL(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    return url.href;
  } catch { return ''; }
}
// Newly verified author links also appear for previously saved workspaces.
export function repositoryURL(paper, catalog = []) {
  return safeURL(paper.code || catalog.find(item => item.id === paper.id)?.code || '');
}
// Keep older local/cloud libraries working without rewriting the reader's data.
export function pdfURL(paper) {
  const value = safeURL(paper.pdf);
  if (!value) return '';
  const url = new URL(value);
  const prefix = '/kongwoang/Gradient-Based-Learning/blob/main/';
  if (url.origin === 'https://github.com' && url.pathname.startsWith(prefix + 'papers/') && url.pathname.endsWith('.pdf')) {
    return 'https://kongwoang.github.io/Gradient-Based-Learning/' + url.pathname.slice(prefix.length) + url.hash;
  }
  return value;
}
export function normalizePaper(input) {
  if (!input || typeof input !== 'object' || !ID.test(input.id)) throw new Error('A paper has an invalid ID.');
  const result = { id: input.id };
  for (const field of ['method', 'title', 'focus']) result[field] = text(input[field], field, 2000);
  if (!result.title.trim()) throw new Error('Every paper needs a title.');
  result.topic = TOPICS.includes(input.topic) ? input.topic : 'Other';
  result.venue = text(input.venue, 'venue', 100);
  result.year = input.year === '' || input.year == null ? null : Number(input.year);
  if (result.year !== null && (!Number.isInteger(result.year) || result.year < 1900 || result.year > 2100)) throw new Error('Year must be between 1900 and 2100.');
  result.status = input.status || 'To read';
  if (!STATUSES.includes(result.status)) throw new Error(`Unknown reading status: ${result.status}`);
  for (const field of ['categories', 'types']) {
    const values = input[field] || [];
    if (!Array.isArray(values) || values.length > 20) throw new Error(`${field} must contain at most 20 tags.`);
    result[field] = [...new Set(values.map(value => text(value, field, 120).trim()).filter(Boolean))];
  }
  // Fold the old columns into Notes once, including backups and cloud workspaces.
  const sections = [text(input.notes, 'notes', NOTE_LIMIT)];
  if (result.types.length) sections.push(`Type\n${result.types.join(', ')}`);
  for (const [field, label] of Object.entries(LEGACY_NOTE_FIELDS)) {
    const value = text(input[field], field);
    if (value.trim()) sections.push(`${label}\n${value}`);
    result[field] = '';
  }
  result.notes = text(sections.filter(value => value.trim()).join('\n\n'), 'notes', NOTE_LIMIT);
  result.types = [];
  for (const field of ['source', 'pdf', 'code', 'folder']) {
    const value = text(input[field], field, 4000).trim();
    if (value && !safeURL(value)) throw new Error(`${field} needs a valid http or https link.`);
    result[field] = safeURL(value);
  }
  result.updatedAt = typeof input.updatedAt === 'string' && !Number.isNaN(Date.parse(input.updatedAt)) ? input.updatedAt : null;
  return result;
}
export function normalizeWorkspace(input) {
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.papers) || input.papers.length > 5000) throw new Error('Choose a Gradient JSON backup (version 1, up to 5,000 papers).');
  const papers = input.papers.map(normalizePaper);
  if (new Set(papers.map(paper => paper.id)).size !== papers.length) throw new Error('The backup contains duplicate paper IDs.');
  const deletedIds = input.deletedIds || [];
  if (!Array.isArray(deletedIds) || deletedIds.length > 5000 || deletedIds.some(id => typeof id !== 'string' || !ID.test(id))) throw new Error('The backup contains invalid deleted paper IDs.');
  return { schemaVersion: 1, papers, deletedIds: [...new Set(deletedIds)], updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null };
}
export function initialWorkspace(papers) {
  return normalizeWorkspace({ schemaVersion: 1, papers, deletedIds: [], updatedAt: null });
}
export function addCatalogPapers(workspace, catalog) {
  const known = new Set([...workspace.papers.map(paper => paper.id), ...workspace.deletedIds]);
  return { ...workspace, papers: [...workspace.papers, ...catalog.filter(paper => !known.has(paper.id)).map(normalizePaper)] };
}
export function filteredPapers(papers, { query = '', topic = 'All', status = 'All', sort = 'default' } = {}) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const result = papers.filter(paper => {
    if (topic !== 'All' && paper.topic !== topic) return false;
    if (status === 'Read' ? !['Read', 'Reproduced'].includes(paper.status) : status !== 'All' && paper.status !== status) return false;
    const haystack = [paper.method, paper.title, paper.topic, paper.venue, paper.year, paper.focus, ...paper.categories, paper.notes].join(' ').toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  });
  if (sort === 'newest') result.sort((a, b) => (b.year || 0) - (a.year || 0) || a.method.localeCompare(b.method));
  if (sort === 'oldest') result.sort((a, b) => (a.year || 0) - (b.year || 0) || a.method.localeCompare(b.method));
  if (sort === 'name') result.sort((a, b) => (a.method || a.title).localeCompare(b.method || b.title));
  if (sort === 'updated') result.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  return result;
}
export function toMarkdown(workspace) {
  const cell = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('|','\\|').replace(/\r?\n/g,'<br>');
  const columns = ['Paper', 'Topic', 'Venue', 'Status', 'Categories', 'Notes'];
  const rows = workspace.papers.map(p => [p.method || p.title, p.topic, [p.venue,p.year].filter(Boolean).join(' '), p.status, p.categories.join(', '), p.notes]);
  return '# Reading Notes\n\n| ' + columns.join(' | ') + ' |\n|' + columns.map(()=>'---').join('|') + '|\n' + rows.map(row=>'| '+row.map(cell).join(' | ')+' |').join('\n') + '\n';
}
export const cacheKey = userId => `gradient.workspace.v1.${userId || 'guest'}`;
