import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initialWorkspace, normalizeWorkspace, normalizePaper, filteredPapers, addCatalogPapers, toMarkdown, safeURL, cacheKey, repositoryURL } from '../docs/assets/library.js';
import { writeCloud, readCloud, SyncConflict } from '../docs/assets/cloud.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../docs/data/papers.json',import.meta.url)));

test('all 19 starter papers have a unique ID and valid PDF/source URLs',()=>{
  const state=initialWorkspace(catalog);assert.equal(state.papers.length,19);assert.equal(new Set(state.papers.map(p=>p.id)).size,19);
  for(const paper of state.papers){assert.ok(paper.pdf.startsWith('https://github.com/kongwoang/'));assert.ok(paper.source.startsWith('https://'));}
});
test('backups preserve multiline notes and validate before replacing anything',()=>{
  const original=initialWorkspace(catalog);original.papers[0].notes='Question?\nTry α = 0.5 | compare with β.';
  assert.equal(normalizeWorkspace(JSON.parse(JSON.stringify(original))).papers[0].notes,original.papers[0].notes);
  for(const invalid of [{},{schemaVersion:2,papers:[]},{schemaVersion:1,papers:[original.papers[0],original.papers[0]]}])assert.throws(()=>normalizeWorkspace(invalid));
  assert.throws(()=>normalizeWorkspace({...original,papers:[{...original.papers[0],notes:{html:'bad'}}]}));
});
test('active content, credential-bearing URLs, invalid years and statuses are rejected',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,test','https://name:secret@example.com']){assert.equal(safeURL(url),'');assert.throws(()=>normalizePaper({...catalog[0],source:url}));}
  assert.throws(()=>normalizePaper({...catalog[0],year:2}));assert.throws(()=>normalizePaper({...catalog[0],status:'invented'}));
});
test('search combines topic/status filters and matches research notes',()=>{
  const papers=initialWorkspace(catalog).papers;const fishr=papers.find(p=>p.method==='Fishr');fishr.notes='Compare covariance across domains';fishr.status='Reading';
  assert.equal(filteredPapers(papers,{query:'COVARIANCE domains',topic:'DG',status:'Reading'}).length,1);
  assert.equal(filteredPapers(papers,{query:'covariance',topic:'CL'}).length,0);
  assert.equal(filteredPapers(papers,{sort:'newest'})[0].method,'KeepLoRA');
});
test('Read view includes papers that have also been reproduced',()=>{
  const paper={...catalog[0],status:'Reproduced'};assert.equal(filteredPapers([paper],{status:'Read'}).length,1);
});
test('catalog refresh keeps edited notes and does not restore removed papers',()=>{
  const state=initialWorkspace(catalog.slice(0,2));state.papers[0].notes='Personal note';state.deletedIds.push(catalog[2].id);
  const merged=addCatalogPapers(state,catalog);assert.equal(merged.papers[0].notes,'Personal note');assert.equal(merged.papers.length,18);assert.ok(!merged.papers.some(p=>p.id===catalog[2].id));
});
test('account caches are isolated from each other and guest notes',()=>{assert.notEqual(cacheKey('alice'),cacheKey('bob'));assert.notEqual(cacheKey(),cacheKey('alice'));});
test('Markdown export safely preserves table cells and multiline text',()=>{
  const state=initialWorkspace([catalog[0]]);state.papers[0].notes='<script>x</script> | hello\nnext';
  const result=toMarkdown(state);assert.ok(result.includes('&lt;script&gt;'));assert.ok(result.includes('\\| hello<br>next'));assert.ok(!result.includes('<script>'));
});
function mockClient(response){
  const calls=[];const query={insert(value){calls.push(['insert',value]);return query;},update(value){calls.push(['update',value]);return query;},eq(...args){calls.push(['eq',...args]);return query;},select(...args){calls.push(['select',...args]);return query;},async maybeSingle(){return response;}};
  return {calls,from(name){calls.push(['from',name]);return query;}};
}
test('cloud saves compare both owner and revision before updating',async()=>{
  const client=mockClient({data:{revision:4,updated_at:'2026-10-26'},error:null});
  const result=await writeCloud(client,'reader',initialWorkspace(catalog),3);
  assert.equal(result.revision,4);assert.ok(client.calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='reader'));assert.ok(client.calls.some(c=>c[0]==='eq'&&c[1]==='revision'&&c[2]===3));
});
test('new workspaces insert; conflicting saves never silently overwrite',async()=>{
  const first=mockClient({data:{revision:1},error:null});await writeCloud(first,'reader',initialWorkspace(catalog),null);assert.equal(first.calls[1][0],'insert');
  await assert.rejects(()=>writeCloud(mockClient({data:null,error:null}),'reader',initialWorkspace(catalog),2),SyncConflict);
  await assert.rejects(()=>writeCloud(mockClient({data:null,error:{code:'23505'}}),'reader',initialWorkspace(catalog),null),SyncConflict);
});
test('network errors are surfaced and invalid cloud data is rejected',async()=>{
  const offline=new Error('offline');await assert.rejects(()=>writeCloud(mockClient({data:null,error:offline}),'reader',initialWorkspace(catalog),1),/offline/);
  await assert.rejects(()=>readCloud(mockClient({data:{data:{schemaVersion:999},revision:1},error:null}),'reader'));
});

test('author repositories appear in saved libraries without replacing notes or using the library folder',()=>{
  const seed=catalog.find(p=>p.method==='AGM');
  const saved={...seed,code:'',notes:'Keep my notes',status:'Reading'};
  assert.equal(repositoryURL(saved,catalog),'https://github.com/lihongcs/AGM');
  assert.equal(saved.notes,'Keep my notes');assert.equal(saved.status,'Reading');assert.equal(saved.code,'');
  assert.equal(repositoryURL({...saved,id:'custom-paper'},catalog),'');
  assert.equal(repositoryURL({...saved,code:'https://example.com/author-code'},catalog),'https://example.com/author-code');
  assert.equal(repositoryURL({...saved,code:'javascript:alert(1)'},catalog),'');
});
