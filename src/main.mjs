import {ID,escape,plain} from './conversion.mjs';
import {preview,apply,undo} from './adapter.mjs';
import {ensureSources,sourceFor,classify,SOURCE_SETTING} from './sources.mjs';
import {prepareBatch,applyBatch,defaultSelection} from './batch.mjs';
import {registerIntegration} from './integration.mjs';

let sources=[],loading;
async function createItemsV2(){const {createItemsV2:create}=await import('./item-automation.mjs');return create();}
const error=e=>ui.notifications.error(e.message);
const version=()=>game.modules.get(ID).version;
const attributes={str:'FOR',dex:'DES',con:'CON',int:'INT',wis:'SAB',cha:'CAR'};
const activations={action:'Ação',bonus:'Ação bônus',reaction:'Reação',passive:'Passiva'};
function dialog(title,content,buttons,width=780,bind){
  const d=new foundry.applications.api.DialogV2({classes:['qm-window'],window:{title:`QUEDAÇO - GERADOR · ${title}`},position:{width,height:Math.min(760,Math.max(300,window.innerHeight-80))},content:`<div class="qm-scroll"><div class="qm">${content}</div></div>`,buttons});
  if(bind)d.addEventListener('render',()=>bind(d.element));
  d.render({force:true});return d;
}
async function load(d){
  if(loading)return loading;
  loading=ensureSources(game,d?.element.querySelector('[name="source"]')?.files[0]);
  try{sources=await loading;return sources;}finally{loading=null;}
}
function eligible(){return Array.from(game.actors).filter(a=>a.type==='npc'&&!a.hasPlayerOwner&&a.isOwner&&classify(a,sources)!=='official').sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));}
function exportReport(reports,name='auditoria'){foundry.utils.saveDataToFile(JSON.stringify({version:version(),date:new Date().toISOString(),reports},null,2),'application/json',`quedaco-monstros-${name}.json`);}
function tuning(c,i){
  if(!c.item.system.attack?.ability)return '';
  return `<div class="qm-fields"><label>Atributo do ataque<select data-offense="${i}">${Object.entries(attributes).map(([v,l])=>`<option value="${v}" ${c.item.system.attack.ability===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Proteção do alvo<select data-protection="${i}">${Object.entries(attributes).map(([v,l])=>`<option value="${v}" ${c.item.system.attack.protection===v?'selected':''}>${l}</option>`).join('')}</select></label></div>`;
}
export function candidateCard(c,i){
  const labels={missing:'Falta na ficha',existing:c.differences?.length?'Diferenças encontradas':'Já existe',review:'Revisar',ambiguous:'Nome ambíguo'};
  const type={hierarchy:'Hierarquia',archetype:'Arquétipo',ability:activations[c.item.system.activation?.type]??'Habilidade'}[c.item.type]??c.item.type;
  return `<details><summary><label><input name="correction" type="checkbox" value="${i}" ${c.status==='missing'&&!c.blocked&&!c.reviewRequired?'checked':''} ${c.blocked||c.status==='ambiguous'?'disabled':''}><span>${escape(c.item.name)} <small>${type} · ${labels[c.status]}</small></span></label></summary><p>${escape(c.notes.join(' '))}</p><dl><dt>Dano proposto</dt><dd>${escape(c.item.system.attack?.damage||c.item.system.effect?.damage||'Sem dano direto')}</dd><dt>Alcance</dt><dd>${c.item.system.range?.value!=null?`${escape(c.item.system.range.value)} m`:'Ver descrição'}</dd><dt>Alvos</dt><dd>${escape(c.item.system.target?.quantity??c.item.system.target?.descriptive??'Ver descrição')}</dd><dt>Recarga</dt><dd>${c.item.system.activation?.recharge===1?'Por catarse':'Sem recarga'}</dd></dl><p>${escape(plain(c.item.system.effect?.descriptive??c.item.system.description?.value??''))}</p>${tuning(c,i)}</details>`;
}
function showReport(actor,report){
  const content=`<p>${escape(actor.name)} · ND ${escape(report.nd)} · ${report.boss?'Chefão':'Ameaça'} · ${report.legendary?'Origem lendária':'Sem seção lendária'}</p><ul>${report.warnings.map(w=>`<li>${escape(w)}</li>`).join('')}</ul><p>Selecione as habilidades que deseja adicionar ou atualizar. Hierarquia e passiva podem ter o mesmo nome, mas são peças distintas.</p>${report.candidates.map(candidateCard).join('')||'<p>Nenhuma habilidade reconhecida.</p>'}`;
  dialog('Prévia',content,[{action:'apply',label:'Aplicar selecionadas',callback:async(_e,_b,d)=>{
    const indices=Array.from(d.element.querySelectorAll('[name="correction"]:checked')).map(i=>Number(i.value));
    if(!indices.length)return ui.notifications.warn('Selecione pelo menos uma correção.');
    if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Confirmar correção'},content:`<p>Aplicar ${indices.length} alteração(ões) em ${escape(actor.name)} com backup?</p>`}))return;
    for(const i of indices){
      const c=report.candidates[i],offense=d.element.querySelector(`[data-offense="${i}"]`)?.value,protection=d.element.querySelector(`[data-protection="${i}"]`)?.value;
      if(offense&&protection){c.item.system.attack.ability=offense;c.item.system.attack.protection=protection;for(const r of Object.values(c.item.system.rolls??{})){r.protection=protection;if(r.type==='attack')r.terms[0].expression=`@${offense}`;}}
    }
    try{const n=await apply(game,actor,report,indices);ui.notifications.info(`${n} correção(ões) aplicada(s).`);}catch(e){error(e);}
  }},{action:'close',label:'Fechar',default:true}]);
}
function worldReport(rows){
  const pending=row=>row.error||row.report?.candidates.some(c=>c.status!=='existing'||c.differences?.length||c.blocked);
  const content=`<p>${rows.length} monstros não oficiais identificados. Fichas oficiais, de jogadores e sem origem identificada ficam fora do lote.</p><label>Buscar<input name="search" type="search" placeholder="Nome do monstro"></label><label class="qm-check"><input name="onlyProblems" type="checkbox"> Mostrar somente pendências</label><label class="qm-check"><input name="replace" type="checkbox"> Atualizar também habilidades existentes com diferenças</label><p>O lote usa a prévia calculada a partir da fonte original. Magias, nomes ambíguos e danos condicionais continuam para revisão individual. Cada ficha recebe seu próprio backup.</p><table><thead><tr><th>Selecionar</th><th>Monstro</th><th>Adicionar / atualizar</th><th>Revisar</th></tr></thead><tbody>${rows.map(row=>{
    const r=row.report,add=r?defaultSelection(r).length:0,update=r?defaultSelection(r,{replace:true}).length-add:0;
    return `<tr data-row="${escape(row.actorId)}" data-name="${escape(row.name.toLowerCase())}" data-problem="${pending(row)?'yes':'no'}"><td><input name="batchActor" value="${escape(row.actorId)}" type="checkbox" ${add||update?'checked':''} ${r&&(add||update)?'':'disabled'}></td><td>${escape(row.name)}</td><td>${add} / ${update}</td><td>${row.error?escape(row.error):r?.candidates.filter(c=>c.blocked||c.reviewRequired).length??0}</td></tr>`;
  }).join('')}</tbody></table><label>Revisar ficha<select name="reviewActor">${rows.map(r=>`<option value="${r.actorId}">${escape(r.name)}</option>`).join('')}</select></label>`;
  dialog('Lote de monstros importados',content,[{action:'applyBatch',label:'Corrigir monstros selecionados',callback:async(_e,_b,d)=>{
    const chosen=new Set(Array.from(d.element.querySelectorAll('[name="batchActor"]:checked')).map(el=>el.value));
    const replace=d.element.querySelector('[name="replace"]').checked,selections={};
    for(const row of rows)if(chosen.has(row.actorId)&&row.report)selections[row.actorId]=defaultSelection(row.report,{replace});
    const count=Object.values(selections).filter(s=>s.length).length;
    if(!count)return ui.notifications.warn('Nenhuma correção automática selecionada.');
    if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Confirmar lote'},content:`<p>Corrigir ${count} ficha(s) e ${Object.values(selections).reduce((n,s)=>n+s.length,0)} Item(ns)? ${replace?'As atualizações de habilidades existentes estão habilitadas.':''} Será salvo um backup por ficha.</p>`}))return;
    try{
      const results=await applyBatch(game,sources,rows,selections,{onProgress:progress('Corrigindo')});
      const done=results.filter(r=>r.status==='applied').length;
      ui.notifications.info(`${done} ficha(s) corrigida(s); ${results.length-done} falha(s). Relatório disponível abaixo.`);
      dialog('Resultado do lote',`<ul>${results.map(r=>`<li>${escape(r.name)}: ${r.status==='applied'?`${r.count} Item(ns) corrigido(s)`:escape(r.error)}</li>`).join('')}</ul>`,[{action:'export',label:'Exportar resultado',callback:()=>exportReport(results,'resultado')},{action:'close',label:'Fechar',default:true}]);
    }catch(e){error(e);}
  }},{action:'review',label:'Revisar uma ficha',callback:async(_e,_b,d)=>{const actor=game.actors.get(d.element.querySelector('[name="reviewActor"]').value);try{showReport(actor,await preview(game,actor,sourceFor(actor,sources)));}catch(e){error(e);}}},{action:'export',label:'Exportar relatório',callback:()=>exportReport(rows)},{action:'close',label:'Fechar',default:true}],880,root=>{
    const filter=()=>{const term=root.querySelector('[name="search"]').value.toLowerCase(),only=root.querySelector('[name="onlyProblems"]').checked;for(const tr of root.querySelectorAll('[data-row]'))tr.hidden=!tr.dataset.name.includes(term)||only&&tr.dataset.problem!=='yes';};
    root.querySelector('[name="search"]').addEventListener('input',filter);root.querySelector('[name="onlyProblems"]').addEventListener('change',filter);
  });
}
function progress(label){let last=0;return (done,total)=>{if(done===total||Date.now()-last>3000){ui.notifications.info(`${label}: ${done}/${total}`);last=Date.now();}};}

export function open(actor){
  if(!game.user.isGM||game.system.id!=='skyfall')return ui.notifications.warn('QUEDAÇO - GERADOR requer Skyfall e acesso da Mestra.');
  const actors=eligible();
  return dialog(`Versão ${version()}`,`<p>Audite e corrija os monstros importados individualmente ou em lote.</p><label>Monstro<select name="actor">${actors.map(a=>`<option value="${a.id}" ${actor?.id===a.id?'selected':''}>${escape(a.name)} · ND ${escape(a.system.level?.value)}</option>`).join('')}</select></label><p>A fonte D&D será carregada automaticamente do gist e lembrada neste mundo. Para outra fonte, selecione um arquivo abaixo.</p><label>Fonte alternativa (opcional)<input name="source" type="file" accept=".json,application/json"></label>`,[{action:'itemsV2',label:'Criar itens V2',callback:()=>createItemsV2().catch(error)},{action:'audit',label:'Revisar monstro',callback:async(_e,_b,d)=>{try{await load(d);const a=game.actors.get(d.element.querySelector('[name="actor"]').value);if(!a)throw Error('Escolha uma ficha.');showReport(a,await preview(game,a,sourceFor(a,sources)));}catch(e){error(e);}}},{action:'world',label:'Auditar todos os importados',callback:async(_e,_b,d)=>{try{await load(d);worldReport(await prepareBatch(game,sources,{onProgress:progress('Auditando')}));}catch(e){error(e);}}},{action:'undo',label:'Desfazer última correção',callback:async(_e,_b,d)=>{const a=game.actors.get(d.element.querySelector('[name="actor"]').value);if(!a)return;if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Restaurar Items'},content:`<p>Desfazer a última correção de ${escape(a.name)}?</p>`}))return;try{await undo(game,a);ui.notifications.info('Última correção desfeita.');}catch(e){error(e);}}},{action:'close',label:'Fechar',default:true}],650);
}
Hooks.once('init',()=>game.settings.register(ID,SOURCE_SETTING,{scope:'world',config:false,type:Object,default:[]}));
Hooks.once('ready',()=>{sources=game.user.isGM?game.settings.get(ID,SOURCE_SETTING)??[]:[];registerIntegration(game,Hooks,open);});
Hooks.on('getSceneControlButtons',controls=>{
  if(!game.user.isGM||game.system.id!=='skyfall')return;
  const tool={name:ID,title:'QUEDAÇO - GERADOR',icon:'fa-solid fa-dragon',button:true,order:98,onClick:()=>open()};
  if(Array.isArray(controls)){const group=controls.find(c=>c.name==='tokens');group?.tools.push(tool);}else if(controls.tokens?.tools)controls.tokens.tools[ID]=tool;
});
Hooks.on('getHeaderControlsActorSheetV2',(sheet,controls)=>{const actor=sheet.actor??sheet.document;if(game.user.isGM&&actor?.type==='npc'&&!actor.hasPlayerOwner)controls.push({action:ID,label:'QUEDAÇO - GERADOR',icon:'fa-solid fa-dragon',onClick:()=>open(actor)});});
