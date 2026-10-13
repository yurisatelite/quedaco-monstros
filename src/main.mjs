import {ID,escape,key,audit} from './conversion.mjs';
import {preview,apply,undo} from './adapter.mjs';

let sourceList=[],active;
const error=e=>ui.notifications.error(e.message);
function eligible(){return Array.from(game.actors).filter(a=>a.type==='npc'&&!a.hasPlayerOwner&&a.isOwner).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));}
function sourceFor(actor){
  const original=actor.flags?.quedaco?.sourceName??actor.name;
  const found=sourceList.filter(s=>key(s.name??s.Name)===key(original));
  return found.length===1?found[0]:undefined;
}
async function loadSource(dialog){
  const file=dialog.element.querySelector('[name="source"]').files[0];
  if(!file)return;
  const json=JSON.parse(await file.text());
  const list=Array.isArray(json)?json:json.monsters??[json];
  if(!Array.isArray(list)||list.some(s=>!s||typeof s!=='object'||!(s.name??s.Name)))throw Error('JSON de monstros inválido.');
  sourceList=list;
}
function worldReport(){
  const reports=eligible().map(a=>audit(a,sourceFor(a)));
  const rows=reports.map(r=>({...r,issues:r.candidates.filter(c=>c.status!=='existing'||c.differences?.length||c.blocked).length}));
  new foundry.applications.api.DialogV2({window:{title:'QUEDAÇO Monstros · Conferência do mundo'},position:{width:740},content:`<div class="qm"><p>${rows.length} fichas conferidas. Pendências incluem diferenças de mecânica e equivalências que exigem revisão. Itens nativos de hierarquia são conferidos na prévia individual.</p><label>Ficha para revisar<select name="reviewActor">${rows.map(r=>`<option value="${r.actorId}">${escape(r.name)} · ${r.origin==='json'?`${r.issues} pendência(s)`:'sem fonte estruturada'}</option>`).join('')}</select></label><table><thead><tr><th>Monstro</th><th>Fonte</th><th>Pendências</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escape(r.name)}</td><td>${r.origin==='json'?'JSON':'Biografia'}</td><td>${r.origin==='json'?r.issues:'Carregar fonte'}</td></tr>`).join('')}</tbody></table></div>`,buttons:[{action:'review',label:'Revisar ficha',callback:async(_e,_b,d)=>{const a=game.actors.get(d.element.querySelector('[name="reviewActor"]').value);try{showReport(a,await preview(game,a,sourceFor(a)));}catch(e){error(e);}}},{action:'export',label:'Exportar relatório',callback:()=>foundry.utils.saveDataToFile(JSON.stringify({version:'0.1.0',date:new Date().toISOString(),reports:rows},null,2),'application/json','quedaco-monstros-auditoria.json')},{action:'close',label:'Fechar',default:true}]}).render({force:true});
}
function showReport(actor,report){
  const labels={missing:'Ausente',existing:'Já existe — substituição opcional',review:'Revisão necessária',ambiguous:'Nome ambíguo'};
  const content=`<div class="qm"><p>${escape(actor.name)} · ND ${escape(report.nd)} · ${report.boss?'Chefão':'Ameaça'} · ${report.legendary?'Origem lendária':'Sem seção lendária'}</p><ul>${report.warnings.map(w=>`<li>${escape(w)}</li>`).join('')}</ul><p>Itens ausentes ficam selecionados. Marque uma substituição somente após conferir os dados atuais. A descrição original continua disponível na biografia.</p>${report.candidates.map((c,i)=>`<details><summary><label><input name="correction" type="checkbox" value="${i}" ${c.status==='missing'&&!c.blocked?'checked':''} ${c.blocked||c.status==='ambiguous'?'disabled':''}> ${escape(c.item.name)} — ${labels[c.status]}</label></summary><p>Ativação: ${escape(c.item.system.activation?.type??c.item.type)} · Recarga: ${c.item.system.activation?.recharge===1?'pronta':'não'} · Dano: ${escape(c.item.system.attack?.damage??'—')} · Proteção: ${escape(c.item.system.attack?.protection??'—')}</p>${c.existingId?`<p>Atual: ${escape(JSON.stringify(actor.items.get(c.existingId)?.system?.activation??{}))} · Dano ${escape(actor.items.get(c.existingId)?.system?.attack?.damage??'—')}</p>`:''}<p>${escape(c.notes.join(' '))}</p><pre>${escape(JSON.stringify(c.item.system,null,2))}</pre></details>`).join('')||'<p>Nenhuma habilidade reconhecida. Carregue a fonte original.</p>'}</div>`;
  const attributes=[['str','FOR'],['dex','DES'],['con','CON'],['int','INT'],['wis','SAB'],['cha','CAR']];
  const tuning=`<div class="qm"><p>Ajuste os atributos sugeridos antes de aplicar:</p>${report.candidates.map((c,i)=>c.item.system.attack?.ability?`<details><summary>${escape(c.item.name)}</summary><label>Atributo ofensivo<select data-offense="${i}">${attributes.map(([v,l])=>`<option value="${v}" ${c.item.system.attack.ability===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Proteção do alvo<select data-protection="${i}">${attributes.map(([v,l])=>`<option value="${v}" ${c.item.system.attack.protection===v?'selected':''}>${l}</option>`).join('')}</select></label></details>`:'').join('')}</div>`;
  new foundry.applications.api.DialogV2({window:{title:'QUEDAÇO Monstros · Prévia'},position:{width:800},content:content+tuning,buttons:[{action:'apply',label:'Aplicar selecionadas',callback:async(_event,_button,dialog)=>{
    const indices=Array.from(dialog.element.querySelectorAll('[name="correction"]:checked')).map(i=>Number(i.value));
    if(!indices.length){ui.notifications.warn('Selecione pelo menos uma correção.');return;}
    const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:'Confirmar correção'},content:`<p>Aplicar ${indices.length} alteração(ões) em ${escape(actor.name)}? O módulo salvará um backup dos Items alterados.</p>`});
    if(!confirmed)return;
    for(const i of indices){
      const candidate=report.candidates[i];
      const offense=dialog.element.querySelector(`[data-offense="${i}"]`)?.value;
      const protection=dialog.element.querySelector(`[data-protection="${i}"]`)?.value;
      if(offense&&protection){
        candidate.item.system.attack.ability=offense;candidate.item.system.attack.protection=protection;
        for(const roll of Object.values(candidate.item.system.rolls??{})){
          roll.protection=protection;
          if(roll.type==='attack')roll.terms[0].expression=`@${offense}`;
        }
      }
    }
    try{const n=await apply(game,actor,report,indices);ui.notifications.info(`${n} correção(ões) aplicada(s). Abra a ficha e teste os ataques e recargas.`);}catch(e){error(e);}
  }},{action:'close',label:'Fechar',default:true}]}).render({force:true});
}

export function open(actor){
  if(!game.user.isGM||game.system.id!=='skyfall'){ui.notifications.warn('QUEDAÇO Monstros requer Skyfall e acesso da Mestra.');return;}
  const actors=eligible();
  const content=`<div class="qm"><p>Audite uma ficha existente e revise as correções antes de aplicar.</p><label>Monstro<select name="actor">${actors.map(a=>`<option value="${a.id}" ${actor?.id===a.id?'selected':''}>${escape(a.name)} · ND ${escape(a.system.level?.value)}</option>`).join('')}</select></label><label>Fonte original (JSON do gist ou Open5e)<input name="source" type="file" accept=".json,application/json"></label><p>${sourceList.length?`${sourceList.length} fontes carregadas nesta sessão.`:'Carregue o JSON original para distinguir traços, ações e ações lendárias. A biografia sozinha permite apenas uma conferência preliminar.'}</p><p><a href="https://gist.github.com/tkfu/9819e4ac6d529e225e9fc58b358c3479" target="_blank" rel="noopener">Abrir fonte fornecida</a></p></div>`;
  active=new foundry.applications.api.DialogV2({window:{title:'QUEDAÇO Monstros · Teste 0.1.0'},position:{width:620},content,buttons:[{action:'audit',label:'Auditar e revisar',callback:async(_event,_button,dialog)=>{
    try{
      await loadSource(dialog);
      const selected=game.actors.get(dialog.element.querySelector('[name="actor"]').value);
      if(!selected)throw Error('Escolha uma ficha.');
      showReport(selected,await preview(game,selected,sourceFor(selected)));
    }catch(e){error(e);}
  }},{action:'world',label:'Conferir todas as fichas',callback:async(_e,_b,d)=>{try{await loadSource(d);worldReport();}catch(e){error(e);}}},{action:'undo',label:'Desfazer última correção',callback:async(_event,_button,dialog)=>{
    const selected=game.actors.get(dialog.element.querySelector('[name="actor"]').value);
    if(!selected)return;
    if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Restaurar Items'},content:`<p>Desfazer a última correção de ${escape(selected.name)}?</p>`}))return;
    try{await undo(game,selected);ui.notifications.info('Última correção desfeita.');}catch(e){error(e);}
  }},{action:'close',label:'Fechar',default:true}]}).render({force:true});
  return active;
}
Hooks.once('ready',()=>{game.modules.get(ID).api={open,preview:actor=>preview(game,actor,sourceFor(actor))};});
Hooks.on('getSceneControlButtons',controls=>{
  if(!game.user.isGM||game.system.id!=='skyfall')return;
  const tool={name:ID,title:'QUEDAÇO Monstros',icon:'fa-solid fa-dragon',button:true,order:98,onClick:()=>open()};
  if(Array.isArray(controls)){const group=controls.find(c=>c.name==='tokens');group?.tools.push(tool);}
  else if(controls.tokens?.tools)controls.tokens.tools[ID]=tool;
});
Hooks.on('getHeaderControlsActorSheetV2',(sheet,controls)=>{
  const actor=sheet.actor??sheet.document;
  if(game.user.isGM&&actor?.type==='npc'&&!actor.hasPlayerOwner)controls.push({action:ID,label:'QUEDAÇO Monstros',icon:'fa-solid fa-dragon',onClick:()=>open(actor)});
});
