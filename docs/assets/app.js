import { STATUSES, TOPICS, TOPIC_NAMES, NOTE_FIELDS, NOTE_LIMIT, normalizePaper, normalizeWorkspace, initialWorkspace, addCatalogPapers, filteredPapers, toMarkdown, cacheKey, repositoryURL, pdfURL } from './library.js?v=5';
import { config } from '../config.js';
import { loadClient, readCloud, writeCloud, SyncConflict } from './cloud.js?v=5';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths = {
  notebook:'M4 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4V3M8 3v18M12 8h4M12 12h4',
  library:'M4 3v18M9 3v18M14 3v18M18 3l4 18',
  list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  table:'M3 3h18v18H3zM3 9h18M9 9v12',
  search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  plus:'M12 5v14M5 12h14', close:'m6 6 12 12M18 6 6 18',
  external:'M15 3h6v6M21 3l-9 9M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
  github:'M9 19c-4.3 1.3-4.3-2-6-2m12 5v-3.4a2.9 2.9 0 0 0-.8-2.3c2.7-.3 5.6-1.3 5.6-6A4.7 4.7 0 0 0 18.5 7a4.3 4.3 0 0 0-.1-3s-1.1-.3-3.4 1.3a11.8 11.8 0 0 0-6 0C6.7 3.7 5.6 4 5.6 4a4.3 4.3 0 0 0-.1 3 4.7 4.7 0 0 0-1.3 3.3c0 4.7 2.9 5.7 5.6 6a2.9 2.9 0 0 0-.8 2.3V22',
  cloud:'M6 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.7-1.5A5 5 0 0 1 18 18H6',
  filter:'M4 5h16M7 12h10M10 19h4', sort:'M8 4v16m-4-4 4 4 4-4M16 4h4M16 9h3M16 14h2',
  more:'M5 12h.01M12 12h.01M19 12h.01', download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  file:'M14 2H5v20h14V7l-5-5M14 2v6h5M8 13h8M8 17h6',
  'chevron-right':'m9 5 7 7-7 7', menu:'M4 6h16M4 12h16M4 18h16',
  cursor:'m4 3 7 17 3-7 7-3-17-7', spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7',
  bookmark:'M6 3h12v18l-6-4-6 4V3', tag:'M3 3h8l10 10-8 8L3 11V3M7 7h.01',
  note:'M4 3h16v14l-4 4H4V3M8 8h8M8 12h8M8 16h4', check:'m5 12 4 4L19 6',
  trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  mail:'M3 5h18v14H3V5m0 0 9 8 9-8', refresh:'M20 7a8 8 0 1 0 1 7M20 3v5h-5',
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.note}"/></svg>`; }
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
let catalog = [], workspace = initialWorkspace([]), client = null, user = null;
let revision = null, dirty = false, syncReady = false, saving = false, conflict = false, authEpoch = 0;
let syncTimer, toastTimer, drawerTimer, currentPaperId = null, drawerBaseline = '', drawerIsNew = false;
let storageOK = true, cloudError = '', authMode = 'signin', changingAccount = false;
const filters = { query: '', topic: 'All', status: 'All', sort: 'default' };
let view = 'library';
const recoveryRequested = new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';

function notify(message, action, label) {
  const el = $('#toast'); clearTimeout(toastTimer);
  el.innerHTML = `<span>${escape(message)}</span>${action ? `<button>${escape(label || 'Undo')}</button>` : ''}`;
  el.hidden = false; if (action) el.querySelector('button').onclick = () => { action(); el.hidden = true; };
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 9000 : 4200);
}
function notice(message, action = null, label = '') {
  const el = $('#notice'); el.hidden = !message;
  el.innerHTML = escape(message || '') + (action ? ` <button>${escape(label)}</button>` : '');
  if (action) el.querySelector('button').onclick = action;
}
function loadCache(id) {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { workspace: normalizeWorkspace(parsed.workspace), revision: Number.isInteger(parsed.revision) ? parsed.revision : null, dirty: !!parsed.dirty };
  } catch {
    storageOK = false;
    notice('Saved data could not be opened on this device. Export a backup before clearing browser storage.');
    return null;
  }
}
function persist() {
  if (!storageOK) return false;
  try {
    localStorage.setItem(cacheKey(user?.id), JSON.stringify({ workspace, revision, dirty }));
    return true;
  } catch {
    storageOK = false;
    notice('Browser storage is unavailable or full. Keep this tab open and export a backup.', () => downloadBackup(), 'Export backup');
    return false;
  }
}
function setSaveState() {
  let label = 'Saved on this device', sidebar = 'Saved on this device';
  if (!storageOK) label = user && syncReady && !dirty ? 'Synced · local backup unavailable' : 'Not saved locally — export a backup';
  else if (user) {
    sidebar = conflict ? 'Sync needs attention' : cloudError ? 'Saved locally · retry sync' : saving ? 'Syncing your workspace' : dirty ? 'Saved locally · waiting to sync' : syncReady ? 'Synced to your account' : 'Connecting to your workspace';
    label = sidebar;
  }
  $('#save-state').innerHTML = `<span class="tiny-dot"></span>${escape(label)}`;
  $('#account-label').textContent = user ? (user.email?.split('@')[0] || 'My account') : 'Sign in to sync';
  $('#account-button').title = user?.email || 'Sign in to sync your notes across devices';
}
function changed() {
  workspace.updatedAt = new Date().toISOString(); dirty = true;
  persist(); render(); setSaveState();
  clearTimeout(syncTimer);
  if (user && syncReady && !conflict) syncTimer = setTimeout(() => syncNow(), 700);
}
function updatePaper(id, values) {
  if (changingAccount) return notify('Your account is still loading. Please try again in a moment.');
  const index = workspace.papers.findIndex(p => p.id === id);
  if (index < 0) return;
  workspace.papers[index] = normalizePaper({ ...workspace.papers[index], ...values, updatedAt: new Date().toISOString() });
  changed();
}
function statusClass(value) { return value.toLowerCase().replaceAll(' ', '-'); }
function statusOptions(selected) { return STATUSES.map(status=>`<option${selected === status ? ' selected' : ''}>${escape(status)}</option>`).join(''); }
function topicTag(topic) { return `<span class="topic-tag ${topic.toLowerCase()}">${escape(topic)}</span>`; }
function tags(values, type = false) { return `<span class="tags">${values.map(value=>`<span class="tag${type ? ' type-tag' : ''}">${escape(value)}</span>`).join('')}</span>`; }
function noteCell(paper, field) {
  const value = paper[field];
  const content = Array.isArray(value) ? (value.length ? tags(value) : '<span class="placeholder">Add tags…</span>') : value ? `<span class="cell-text">${escape(value)}</span>` : '<span class="placeholder">Add a note…</span>';
  return `<td class="editable-cell"><button class="cell-button" data-edit="${field}" data-id="${paper.id}" aria-label="Edit ${escape(NOTE_FIELDS[field] || field)} for ${escape(paper.method || paper.title)}">${content}</button></td>`;
}
function resourceLinks(paper, compact = false) {
  const resources = [['pdf','PDF','file'], ...(!compact ? [['source','Paper','external']] : []), ['code','Repository','github']];
  return resources.map(([key,label,name]) => {
    const url = key === 'code' ? repositoryURL(paper,catalog) : key === 'pdf' ? pdfURL(paper) : paper[key];
    return url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer" aria-label="${label} for ${escape(paper.method || paper.title)}">${icon(name)}${label}</a>` : '';
  }).join('');
}
function render() {
  const topics = ['All', ...TOPICS.filter(topic => topic !== 'Other' || workspace.papers.some(p=>p.topic === topic))];
  $('#topic-nav').innerHTML = topics.map(topic=>`<button class="nav-item${filters.topic === topic ? ' active' : ''}" data-topic="${topic}" aria-pressed="${filters.topic === topic}" title="${topic === 'All' ? 'All papers' : TOPIC_NAMES[topic]}">${topic === 'All' ? 'All papers' : topic === 'MTL' ? 'Multi-task' : topic === 'CL' ? 'Continual' : topic === 'DG' ? 'Generalization' : topic === 'FL' ? 'Federated' : topic}<span class="nav-count">${topic === 'All' ? workspace.papers.length : workspace.papers.filter(p=>p.topic === topic).length}</span></button>`).join('');
  const papers = filteredPapers(workspace.papers, filters);
  const columns = view === 'library' ? ['Paper','Venue','Status','Notes','Links'] : ['Paper','Categories','Notes'];
  $('#paper-table').className = view === 'research' ? 'research-table' : '';
  $('#table-head').innerHTML = '<tr>'+columns.map(label=>`<th scope="col">${label}</th>`).join('')+'</tr>';
  $('#table-body').innerHTML = papers.map(paper=>`<tr><td><button class="paper-open" data-open="${paper.id}"><span class="paper-method">${escape(paper.method || paper.title)}</span><span class="paper-title">${escape(paper.title)}</span></button><div class="paper-meta">${topicTag(paper.topic)}</div></td>${view === 'library' ? `<td><div class="venue-name">${escape(paper.venue || '—')}</div><div class="venue-year">${paper.year || ''}</div></td><td><span class="status-wrap ${statusClass(paper.status)}"><select class="status-select" data-paper-status="${paper.id}" aria-label="Status for ${escape(paper.method || paper.title)}">${statusOptions(paper.status)}</select></span></td>${noteCell(paper,'notes')}<td><div class="row-links">${resourceLinks(paper,true) || '<span class="placeholder">—</span>'}</div></td>` : ['categories','notes'].map(field=>noteCell(paper,field)).join('')}</tr>`).join('');
  $('#empty-state').hidden = papers.length > 0;
  $('#paper-table').hidden = papers.length === 0;
  $('#results-count').textContent = papers.length === workspace.papers.length ? `${papers.length} papers` : `${papers.length} of ${workspace.papers.length} papers`;
  $('#status-filter').value = filters.status;
  $('#sort-order').value = filters.sort;
  setSaveState();
}
function resetFilters() { Object.assign(filters,{query:'',topic:'All',status:'All',sort:'default'}); $('#search').value = ''; render(); }
function selectView(nextView) {
  view = nextView;
  document.querySelectorAll('[data-view]').forEach(button=>{ button.classList.toggle('active',button.dataset.view === view); button.setAttribute('aria-selected',button.dataset.view === view ? 'true' : 'false'); });
  $('#table-scroll').scrollLeft = 0; render();
}
function field(name,label,value='',options={}) {
  const attributes = `name="${name}" id="field-${name}"${options.required ? ' required' : ''}${options.max ? ` maxlength="${options.max}"` : ''}`;
  let control = options.options ? `<select ${attributes}>${options.options.map(v=>`<option${v === value ? ' selected' : ''}>${escape(v)}</option>`).join('')}</select>` : options.area ? `<textarea ${attributes} rows="${options.rows || 3}" placeholder="${escape(options.placeholder || '')}">${escape(value)}</textarea>` : `<input ${attributes} type="${options.type || 'text'}" value="${escape(value)}" placeholder="${escape(options.placeholder || '')}"${name === 'year' ? ' min="1900" max="2100"' : ''}>`;
  return `<label class="form-field"><span>${label}</span>${control}${options.hint ? `<small>${options.hint}</small>` : ''}</label>`;
}
function formPaper(form, base) {
  const values = Object.fromEntries(new FormData(form));
  for (const name of ['categories']) if (name in values) values[name] = values[name].split(',').map(s=>s.trim()).filter(Boolean);
  return normalizePaper({ ...base, ...values, updatedAt: new Date().toISOString() });
}
function saveDrawer(quiet = false) {
  const form = $('#paper-form'); if (!form) return true;
  if (!form.checkValidity()) { if (!quiet) form.reportValidity(); return false; }
  const base = workspace.papers.find(p=>p.id === currentPaperId) || {id:currentPaperId};
  try {
    const paper = formPaper(form,base);
    const comparison = JSON.stringify({...paper,updatedAt:null});
    if (comparison !== drawerBaseline) {
      const index = workspace.papers.findIndex(p=>p.id === paper.id);
      if (index < 0) workspace.papers.push(paper); else workspace.papers[index] = paper;
      drawerBaseline = comparison; drawerIsNew = false; changed();
    }
    $('#drawer-save-label').textContent = storageOK ? 'Saved on this device' : 'Local backup unavailable'; $('#drawer-error').hidden = true;
    return true;
  } catch(error) { $('#drawer-error').textContent = error.message; $('#drawer-error').hidden = false; return false; }
}
function closePaper() {
  clearTimeout(drawerTimer);
  if (!drawerIsNew && !saveDrawer()) return;
  $('#paper-dialog').close(); currentPaperId = null;
}
function openPaper(id = null) {
  if (changingAccount) return notify('Your account is still loading. Please try again in a moment.');
  const paper = id ? workspace.papers.find(p=>p.id === id) : {id:`custom-${crypto.randomUUID()}`,method:'',title:'',topic:filters.topic === 'All' ? 'Other' : filters.topic,venue:'',year:'',focus:'',categories:[],status:'To read',notes:'',source:'',pdf:'',code:'',folder:''};
  if (!paper) return;
  currentPaperId = paper.id; drawerIsNew = !id; drawerBaseline = id ? JSON.stringify({...normalizePaper(paper),updatedAt:null}) : ''; 
  const dialog = $('#paper-dialog');
  const links = resourceLinks(paper);
  dialog.innerHTML = `<div class="drawer-header"><span class="drawer-kicker">${id ? 'PAPER DETAILS' : 'NEW PAPER'}</span><button class="icon-button" id="close-paper" aria-label="Close paper">${icon('close')}</button></div><form id="paper-form"><div class="drawer-content">${id ? topicTag(paper.topic) : ''}<h2 id="drawer-title">${escape(id ? paper.method || paper.title : 'New paper')}</h2>${id ? `<p class="drawer-paper-title">${escape(paper.title)}</p><div class="resource-links">${links}</div>` : '<p class="drawer-paper-title">Add a title and any links you have.</p>'}<details${id ? '' : ' open'}><summary class="field-label">Paper details</summary>${field('title','Paper title',paper.title,{required:true,area:true,rows:2,max:2000})}${field('method','Method / short name',paper.method,{max:2000,placeholder:'e.g. GradNorm'})}<div class="form-row triple">${field('topic','Topic',paper.topic,{options:TOPICS})}${field('venue','Venue',paper.venue,{max:100,placeholder:'e.g. ICML'})}${field('year','Year',paper.year,{type:'number'})}</div>${field('focus','Research focus',paper.focus,{max:2000})}${field('source','Paper URL',paper.source,{type:'url'})}<div class="form-row">${field('pdf','PDF URL',pdfURL(paper),{type:'url'})}${field('code','Repository URL',repositoryURL(paper,catalog),{type:'url'})}</div></details><div class="section-heading">READING & ORGANIZATION</div><div class="form-row">${field('status','Reading status',paper.status,{options:STATUSES})}${field('categories','Categories',paper.categories.join(', '),{placeholder:'Gradient matching, Loss design…',hint:'Separate tags with commas.'})}</div>${field('notes','Notes',paper.notes,{area:true,rows:8,max:NOTE_LIMIT,placeholder:'Write a note…'})}<p class="field-error" id="drawer-error" hidden></p></div><div class="drawer-actions">${id ? `<button class="delete-button" type="button" id="delete-paper">${icon('trash')}Remove paper</button>` : '<span></span>'}<div><small id="drawer-save-label">${id ? 'Edits save automatically' : ''}</small><button class="button primary" type="submit">${id ? 'Done' : 'Add paper'}</button></div></div></form>`;
  $('#close-paper').onclick = closePaper;
  dialog.oncancel = event=>{event.preventDefault();closePaper();};
  $('#paper-form').onsubmit = event=>{event.preventDefault();if(saveDrawer()){dialog.close();currentPaperId=null;notify(id ? 'Paper updated' : 'Paper added to your library');}};
  $('#paper-form').oninput = () => {
    $('#drawer-save-label').textContent = drawerIsNew ? '' : 'Saving…';
    clearTimeout(drawerTimer);
    if (!drawerIsNew) drawerTimer = setTimeout(()=>saveDrawer(true),500);
  };
  if (id) $('#delete-paper').onclick = () => removePaper(id);
  dialog.showModal();
  if (id) $('#close-paper').focus(); else $('#field-title').focus();
}
function editCell(id, name) {
  const paper = workspace.papers.find(p=>p.id === id); if (!paper || changingAccount) return;
  const isTags = name === 'categories', label = NOTE_FIELDS[name] || 'Categories';
  const dialog = $('#cell-dialog');
  dialog.innerHTML = `<form id="cell-form"><div class="modal-header"><div><h2 id="cell-title">${label}</h2><p>${escape(paper.method || paper.title)}</p></div><button type="button" class="icon-button" id="close-cell" aria-label="Close note">${icon('close')}</button></div>${field('value',isTags ? 'Tags, separated by commas' : 'Your notes',isTags ? paper[name].join(', ') : paper[name],{area:!isTags,rows:8,max:isTags ? 2400 : NOTE_LIMIT,placeholder:isTags ? 'Add a tag…' : 'Write a note…'})}<p id="cell-error" class="field-error" hidden></p><div class="modal-actions"><button type="button" class="button secondary" id="cancel-cell">Cancel</button><button type="submit" class="button primary">Save note</button></div></form>`;
  $('#close-cell').onclick = $('#cancel-cell').onclick = ()=>dialog.close();
  $('#cell-form').onsubmit = event=>{event.preventDefault();try{const value=$('#field-value').value;updatePaper(id,{[name]:isTags ? value.split(',').map(s=>s.trim()).filter(Boolean) : value});dialog.close();notify('Note saved');}catch(error){$('#cell-error').hidden=false;$('#cell-error').textContent=error.message;}};
  dialog.showModal(); $('#field-value').focus();
}
async function confirmAction(title, description, accept = 'Continue', danger = false) {
  const dialog = $('#confirm-dialog');
  dialog.innerHTML = `<div class="modal-header"><div><h2 id="confirm-title">${escape(title)}</h2><p>${escape(description)}</p></div></div><div class="modal-actions"><button class="button secondary" data-choice="cancel">Cancel</button><button class="button ${danger ? 'danger' : 'primary'}" data-choice="accept">${escape(accept)}</button></div>`;
  return new Promise(resolve=>{
    dialog.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>{dialog.close();resolve(button.dataset.choice==='accept');});
    dialog.oncancel=()=>resolve(false); dialog.showModal();
  });
}
async function removePaper(id) {
  const index=workspace.papers.findIndex(p=>p.id===id), paper=workspace.papers[index];
  if(!await confirmAction('Remove this paper?',`“${paper.method || paper.title}” and its notes will be removed from your workspace. You can undo this immediately.`, 'Remove paper',true)) return;
  clearTimeout(drawerTimer); $('#paper-dialog').close(); currentPaperId=null;
  workspace.papers.splice(index,1); workspace.deletedIds=[...new Set([...workspace.deletedIds,id])]; changed();
  notify('Paper removed',()=>{workspace.deletedIds=workspace.deletedIds.filter(value=>value!==id);workspace.papers.splice(Math.min(index,workspace.papers.length),0,paper);changed();},'Undo');
}
function downloadFile(name,content,type) {
  const url=URL.createObjectURL(new Blob([content],{type})), link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadBackup() { downloadFile(`gradient-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(workspace,null,2),'application/json'); }

async function switchUser(nextUser, force = false) {
  if (!force && (user?.id || null) === (nextUser?.id || null)) return;
  clearTimeout(syncTimer); clearTimeout(drawerTimer);
  if ($('#paper-dialog').open && !drawerIsNew) saveDrawer(true);
  for(const selector of ['#paper-dialog','#cell-dialog']) $(selector).close();
  currentPaperId = null;
  if (user) persist();
  const epoch = ++authEpoch; user = nextUser; changingAccount = true; saving = false;
  conflict = false; cloudError = ''; syncReady = false;
  const cached = loadCache(user?.id);
  workspace = addCatalogPapers(cached?.workspace || initialWorkspace(catalog),catalog);
  revision = cached?.revision ?? null; dirty = cached?.dirty || false;
  render();
  if (!user) { changingAccount = false; notice(''); return; }
  const id = user.id;
  try {
    const remote = await readCloud(client,id);
    if(epoch !== authEpoch) return;
    if (remote) {
      if (cached?.dirty) {
        if (cached.revision !== remote.revision) conflict = true;
      } else {
        workspace = addCatalogPapers(remote.data,catalog);
        dirty = workspace.papers.length !== remote.data.papers.length;
        revision = remote.revision;
      }
    } else {
      workspace = cached?.workspace || loadCache(null)?.workspace || initialWorkspace(catalog);
      revision = null; dirty = true;
    }
    syncReady = true;
    if(conflict) notice('You have changes here and on another device.',()=>showConflict(),'Review changes');
    else notice('');
    persist(); render();
    if (dirty && !conflict) syncTimer = setTimeout(()=>syncNow(),50);
  } catch(error) {
    if(epoch !== authEpoch) return;
    cloudError = error.message || 'Unable to connect.';
    notice('Could not load your account. Your edits stay on this device until it reconnects.',()=>refreshCloud(),'Retry');
    setSaveState();
  } finally { if(epoch === authEpoch) changingAccount = false; }
}
async function syncNow() {
  clearTimeout(syncTimer);
  if (!client || !user || !syncReady || !dirty || saving || conflict) return;
  const epoch = authEpoch, id = user.id;
  const snapshot = JSON.stringify(workspace);
  const version = revision;
  saving = true; setSaveState();
  try {
    const result = await writeCloud(client,id,JSON.parse(snapshot),version);
    if(epoch !== authEpoch) return;
    revision = result.revision;
    dirty = JSON.stringify(workspace) !== snapshot;
    cloudError = ''; notice(''); persist();
  } catch(error) {
    if(epoch !== authEpoch) return;
    if(error instanceof SyncConflict) {
      conflict = true;
      notice('This workspace was updated on another device. Your edits are saved here.',()=>showConflict(),'Review changes');
    } else {
      cloudError = error.message || 'Unable to connect.';
      notice('Saved on this device. Cloud sync will retry when you reconnect.',()=>refreshCloud(),'Retry now');
    }
    persist();
  } finally {
    if(epoch === authEpoch) {
      saving = false; setSaveState();
      if(dirty && !conflict && !cloudError) syncTimer=setTimeout(()=>syncNow(),100);
    }
  }
}
async function refreshCloud() {
  if(!client || !user || saving || changingAccount || $('#paper-dialog').open || $('#cell-dialog').open) return;
  if(!syncReady) return switchUser(user,true);
  if(conflict) return showConflict();
  if(dirty) return syncNow();
  const epoch=authEpoch;
  try {
    const remote=await readCloud(client,user.id);
    if(epoch !== authEpoch || dirty || $('#paper-dialog').open || $('#cell-dialog').open) return;
    if(remote && remote.revision !== revision) {
      workspace=addCatalogPapers(remote.data,catalog);revision=remote.revision;
      dirty=workspace.papers.length!==remote.data.papers.length;persist();render();
      if(dirty) syncNow();
    }
    cloudError='';notice('');setSaveState();
  } catch(error) { if(epoch===authEpoch){cloudError=error.message;setSaveState();} }
}
async function showConflict() {
  $('#account-dialog').close();
  const dialog=$('#confirm-dialog');
  dialog.innerHTML=`<div class="modal-header"><div><h2 id="confirm-title">Two versions of your workspace</h2><p>Another device saved changes while you were editing here. Download a copy first, then choose the version you want to keep.</p></div></div><p id="conflict-error" class="field-error" hidden></p><div class="account-options"><button class="button secondary" id="conflict-export">${icon('download')}Download this device’s backup</button><button class="button secondary" id="use-cloud">Use the cloud version</button><button class="button primary" id="use-local">Keep this device’s version</button><button class="button text" id="later-conflict">Decide later</button></div>`;
  dialog.showModal();
  $('#conflict-export').onclick=downloadBackup;
  $('#later-conflict').onclick=()=>dialog.close();
  for(const choice of ['cloud','local']) $(`#use-${choice}`).onclick=async()=>{
    const buttons=[...dialog.querySelectorAll('button')]; buttons.forEach(button=>button.disabled=true);
    const epoch=authEpoch;
    try {
      const remote=await readCloud(client,user.id);
      if(epoch!==authEpoch) return dialog.close();
      if(choice==='cloud') {
        if(!remote) throw new Error('There is no cloud copy yet. Keep this device’s version instead.');
        workspace=addCatalogPapers(remote.data,catalog);revision=remote.revision;dirty=workspace.papers.length!==remote.data.papers.length;
      } else {
        const result=await writeCloud(client,user.id,workspace,remote?.revision ?? null);
        if(epoch!==authEpoch) return dialog.close();
        revision=result.revision;dirty=false;
      }
      conflict=false;cloudError='';persist();render();notice('');dialog.close();notify('Workspace synchronized');
      if(dirty) syncNow();
    } catch(error){$('#conflict-error').hidden=false;$('#conflict-error').textContent=error.message;}
    finally{buttons.forEach(button=>button.disabled=false);}
  };
}
function accountError(message) { const el=$('#auth-error'); if(el){el.hidden=false;el.textContent=message;} }
function showAccount() {
  const dialog=$('#account-dialog');
  if(user) {
    dialog.innerHTML=`<div class="modal-header"><div><h2 id="account-title">Your workspace</h2><p>Papers and notes saved to your account.</p></div><button class="icon-button" data-close-account aria-label="Close account">${icon('close')}</button></div><div class="account-badge"><strong>${escape(user.email || 'Signed in')}</strong>${escape(conflict ? 'Changes need your attention' : cloudError ? 'Saved locally · not synced yet' : dirty ? 'Local changes waiting to sync' : syncReady ? 'Your notes are synced' : 'Connecting…')}</div><div class="account-options"><button class="button primary" id="sync-account">${icon('refresh')}${conflict?'Review changes':'Sync now'}</button><button class="button secondary" id="backup-account">${icon('download')}Download a backup</button><button class="button text" id="signout">Sign out</button></div><p id="auth-error" class="field-error" hidden></p><div class="account-info">Only your account can access your notes. A backup is also kept in this browser.</div>`;
    $('#sync-account').onclick=async()=>{if(conflict)return showConflict();await refreshCloud();if(!conflict)showAccount();};
    $('#backup-account').onclick=downloadBackup;
    $('#signout').onclick=async()=>{
      if(dirty && !await confirmAction('Sign out with unsynced changes?','Your changes will stay on this device. Sign in here again to finish syncing.','Sign out')) return;
      const {error}=await client.auth.signOut({scope:'local'});
      if(error)return accountError(error.message);
      dialog.close(); await switchUser(null); notify('Signed out. Showing your local workspace.');
    };
  } else if(!client) {
    dialog.innerHTML=`<div class="modal-header"><div><h2 id="account-title">Your notes, everywhere</h2><p>Your local workspace is ready. Cloud sign-in is temporarily unavailable.</p></div><button class="icon-button" data-close-account aria-label="Close account">${icon('close')}</button></div><p>You can keep reading and export a backup. Reload to try connecting again.</p><div class="modal-actions"><button class="button secondary" id="backup-account">Export backup</button><button class="button primary" data-close-account>Keep reading</button></div>`;
    $('#backup-account').onclick=downloadBackup;
  } else {
    const registering=authMode==='signup';
    dialog.innerHTML=`<div class="modal-header"><div><div class="modal-icon">${icon('cloud')}</div><h2 id="account-title">${registering?'Create account':'Sign in'}</h2><p>${registering?'Create an account to sync your papers and notes.':'Sync papers and notes across devices.'}</p></div><button class="icon-button" data-close-account aria-label="Close sign in">${icon('close')}</button></div><form id="auth-form">${field('email','Email','',{type:'email',required:true,placeholder:'you@example.com'})}${field('password','Password','',{type:'password',required:true})}<p id="auth-error" class="field-error" hidden></p><div class="account-options"><button class="button primary" type="submit" id="auth-submit">${registering?'Create account':'Sign in'}</button><button class="button text" type="button" id="auth-switch">${registering?'Already have an account? Sign in':'New here? Create an account'}</button></div>${registering?'':'<button type="button" class="button text small" id="forgot-password">Forgot your password?</button>'}</form><div class="account-info">${registering?'Use at least 8 characters. Your notes are private to your account.':'Not ready to sign in? Your local notes stay in this browser.'}</div>`;
    $('#field-email').autocomplete='email';$('#field-password').autocomplete=registering?'new-password':'current-password';
    if(registering)$('#field-password').minLength=8;
    $('#auth-switch').onclick=()=>{authMode=registering?'signin':'signup';showAccount();};
    $('#auth-form').onsubmit=async event=>{
      event.preventDefault();const button=$('#auth-submit');button.disabled=true;button.textContent=registering?'Creating account…':'Signing in…';
      const email=$('#field-email').value.trim(),password=$('#field-password').value;
      try{
        const result=registering?await client.auth.signUp({email,password,options:{emailRedirectTo:new URL('./',location.href).href}}):await client.auth.signInWithPassword({email,password});
        if(result.error)throw result.error;
        if(registering&&!result.data.session){accountError('Check your email to confirm your account, then return here to sign in.');button.textContent='Check your email';}
        else{dialog.close();notify('Signed in. Loading your workspace…');}
      }catch(error){accountError(error.message);button.textContent=registering?'Create account':'Sign in';}
      finally{button.disabled=false;}
    };
    if(!registering)$('#forgot-password').onclick=async()=>{
      const email=$('#field-email');if(!email.value||!email.checkValidity())return email.reportValidity();
      const button=$('#forgot-password');button.disabled=true;
      const {error}=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:new URL('./',location.href).href});
      accountError(error?error.message:'Check your email for a password reset link.');button.disabled=false;
    };
  }
  dialog.querySelectorAll('[data-close-account]').forEach(button=>button.onclick=()=>dialog.close());
  if(!dialog.open)dialog.showModal();
}
function showPasswordReset() {
  const dialog=$('#account-dialog');
  dialog.innerHTML=`<div class="modal-header"><div><h2 id="account-title">Choose a new password</h2><p>Use at least 8 characters.</p></div></div><form id="reset-form">${field('new-password','New password','',{type:'password',required:true})}<p id="auth-error" class="field-error" hidden></p><div class="modal-actions"><button class="button primary">Update password</button></div></form>`;
  $('#field-new-password').minLength=8;$('#field-new-password').autocomplete='new-password';
  $('#reset-form').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;const{error}=await client.auth.updateUser({password:$('#field-new-password').value});button.disabled=false;if(error)return accountError(error.message);dialog.close();notify('Password updated');};
  if(!dialog.open)dialog.showModal();
}

function bindEvents() {
  $('#topic-nav').onclick=event=>{const button=event.target.closest('[data-topic]');if(button){filters.topic=button.dataset.topic;render();}};
  $('#search').oninput=event=>{filters.query=event.target.value;render();};
  $('#status-filter').onchange=event=>{filters.status=event.target.value;render();};
  $('#sort-order').onchange=event=>{filters.sort=event.target.value;render();};
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>selectView(button.dataset.view));
  $('.view-tabs').onkeydown=event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const next=view==='library'?'research':'library';selectView(next);$(`#view-${next}`).focus();}};
  $('#table-body').onclick=event=>{const open=event.target.closest('[data-open]'), edit=event.target.closest('[data-edit]');if(open)openPaper(open.dataset.open);else if(edit)editCell(edit.dataset.id,edit.dataset.edit);};
  $('#table-body').onchange=event=>{const id=event.target.dataset.paperStatus;if(id)updatePaper(id,{status:event.target.value});};
  $('#new-paper').onclick=()=>openPaper();$('#clear-filters').onclick=resetFilters;
  $('#account-button').onclick=showAccount;
  $('#more-button').onclick=()=>{const menu=$('#more-menu');menu.hidden=!menu.hidden;$('#more-button').setAttribute('aria-expanded',String(!menu.hidden));};
  document.addEventListener('click',event=>{if(!event.target.closest('.more-container')){$('#more-menu').hidden=true;$('#more-button').setAttribute('aria-expanded','false');}});
  $('#export-json').onclick=()=>{downloadBackup();$('#more-menu').hidden=true;};
  $('#export-markdown').onclick=()=>{downloadFile('gradient-reading-notes.md',toMarkdown(workspace),'text/markdown');$('#more-menu').hidden=true;};
  $('#import-json').onclick=()=>{$('#import-file').click();$('#more-menu').hidden=true;};
  $('#import-file').onchange=async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    if(changingAccount)return notify('Wait for your account to finish loading before importing.');
    if(file.size>10*1024*1024)return notify('Choose a backup smaller than 10 MB.');
    try{
      const imported=normalizeWorkspace(JSON.parse(await file.text()));
      if(!await confirmAction('Import this backup?',`Replace the current workspace with ${imported.papers.length} papers from this file? A backup of your current workspace will download first.`,'Import backup'))return;
      downloadBackup();workspace=imported;changed();notify('Backup imported');
    }catch(error){notify(error.message || 'This backup could not be opened.');}
  };
  document.addEventListener('keydown',event=>{
    if(event.key==='/'&&!event.metaKey&&!event.ctrlKey&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('#search').focus();}
    if(event.key==='Escape'){$('#more-menu').hidden=true;}
    if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&$('#cell-dialog').open){event.preventDefault();$('#cell-form').requestSubmit();}
  });
  window.addEventListener('online',()=>refreshCloud());
  window.addEventListener('focus',()=>refreshCloud());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCloud();});
  window.addEventListener('beforeunload',event=>{
    if(!storageOK&&dirty || drawerIsNew&&$('#paper-dialog').open&&$('#field-title')?.value.trim()){event.preventDefault();event.returnValue='';}
    else if($('#paper-dialog').open&&!drawerIsNew)saveDrawer(true);
  });
  window.addEventListener('storage',event=>{
    if(event.key!==cacheKey(user?.id)||!event.newValue)return;
    if(dirty||saving||$('#paper-dialog').open||$('#cell-dialog').open)return;
    const cached=loadCache(user?.id);if(cached){workspace=cached.workspace;revision=cached.revision;dirty=cached.dirty;render();}
  });
}
async function start() {
  hydrateIcons();bindEvents();
  try{
    const response=await fetch(new URL('../data/papers.json?v=3',import.meta.url));if(!response.ok)throw new Error('The starter catalog could not be loaded.');
    catalog=(await response.json()).map(normalizePaper);
    const cached=loadCache(null);workspace=addCatalogPapers(cached?.workspace||initialWorkspace(catalog),catalog);dirty=cached?.dirty||false;
    $('#loading').hidden=true;render();
  }catch(error){$('#loading').innerHTML=`${escape(error.message)} <button class="button secondary" id="reload">Retry</button>`;$('#reload').onclick=()=>location.reload();return;}
  try{
    client=await loadClient(config);
    if(client){
      const {data,error}=await client.auth.getSession();if(error)throw error;
      await switchUser(data.session?.user||null);
      if(recoveryRequested && data.session) showPasswordReset();
      client.auth.onAuthStateChange((event,session)=>{
        setTimeout(async()=>{await switchUser(session?.user||null);if(event==='PASSWORD_RECOVERY')showPasswordReset();},0);
      });
    }
  }catch(error){cloudError=error.message;notice('Sign-in is temporarily unavailable. You can keep working on this device.');}
}
start();
