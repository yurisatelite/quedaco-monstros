import test from 'node:test';
import assert from 'node:assert/strict';
import {blocks,convertEntry,audit} from '../src/conversion.mjs';
import {preview,apply,undo} from '../src/adapter.mjs';
import {classify,batchEligible,ensureSources,loadPublicSources} from '../src/sources.mjs';
import {prepareBatch,applyBatch,defaultSelection} from '../src/batch.mjs';

test('gist HTML mantém títulos e efeitos em parágrafos sucessivos',()=>{
  const result=blocks('<p><em><strong>Bite.</strong></em> Melee Weapon Attack: +4 to hit.</p><p><em><strong>Enslave (3/Day).</strong></em> Targets one creature.</p><p>The target repeats the save.</p>');
  assert.deepEqual(result.map(e=>e.name),['Bite','Enslave (3/Day)']);
  assert.match(result[1].text,/repeats the save/);
});
test('ações lendárias de custo 1/2 viram ações; custo 3 vira recarga nativa',()=>{
  for(const cost of [1,2,3]){
    const result=convertEntry({name:`Wing Attack (Costs ${cost} Actions)`,text:'Moves away.',section:'legendary'},{boss:true,legendary:true});
    assert.equal(result.item.system.activation.type,'action');
    assert.equal(result.item.system.activation.cost,1);
    assert.equal(result.item.system.activation.recharge,cost===3?1:null);
    assert.equal(result.item.name,'Wing Attack');
  }
});
test('chefão sem ações lendárias reduz o limite; criatura comum e lendária mantêm',()=>{
  const entry={name:'Multiattack',text:'The giant makes two greatclub attacks.',section:'action'};
  assert.match(convertEntry(entry,{boss:true}).item.system.description.value,/até 1 ataque/);
  assert.match(convertEntry(entry,{boss:true,legendary:true}).item.system.description.value,/two greatclub/);
  assert.match(convertEntry(entry,{boss:false}).item.system.description.value,/two greatclub/);
});
test('ataque comum acerta DES, preserva todos os danos e efeito adicional',()=>{
  const {item}=convertEntry({name:'Bite',text:'Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage plus 4 (1d8) acid damage. The target is poisoned.',section:'action'});
  assert.equal(item.system.attack.protection,'dex');
  assert.equal(item.system.range.value,3);
  assert.equal(item.system.attack.damage,'2d10+6 + 1d8');
  assert.equal(Object.values(item.system.rolls).filter(r=>r.type==='damage').length,2);
  assert.match(item.system.description.value,/poisoned/);
});
test('sopro de chefão converte cone, proteção, recarga, metade e +2 dados',()=>{
  const {item}=convertEntry({name:'Fire Breath (Recharge 5–6)',text:'The dragon exhales in a 60-foot cone. Each creature makes a DC 18 Dexterity saving throw, taking 54 (12d8) fire damage, or half as much damage on a successful save.',section:'action'},{boss:true});
  assert.equal(item.system.activation.recharge,1);
  assert.equal(item.system.target.shape,'cone');
  assert.equal(item.system.target.length,18);
  assert.equal(item.system.attack.protection,'dex');
  assert.equal(item.system.attack.damage,'14d8');
  assert.match(item.system.attack.miss,/Metade/);
});
test('área sem recarga ganha +1; comum mantém os dados originais',()=>{
  const e={name:'Blast',section:'action',text:'A 20-foot radius. DC 15 Constitution saving throw, taking 18 (4d8) thunder damage.'};
  assert.equal(convertEntry(e,{boss:true}).item.system.attack.damage,'5d8');
  assert.equal(convertEntry(e).item.system.attack.damage,'4d8');
});
test('nome traduzido existente não duplica; ambiguidades bloqueiam',()=>{
  const actor={id:'a',name:'Dragon',system:{},items:[{id:'bite',type:'ability',name:'Mordida'}]};
  const report=audit(actor,{actions:[{name:'Bite',desc:'Melee Weapon Attack: +3 to hit, reach 5 ft. Hit: 2 (1d4) piercing damage.'}]});
  assert.equal(report.candidates[0].status,'existing');
  assert.equal(report.candidates[0].existingId,'bite');
  const duplicate=audit(actor,{actions:[{name:'Bite',desc:'x'}],legendary_actions:[{name:'Bite',desc:'x'}]});
  assert.ok(duplicate.candidates.every(c=>c.blocked));
});
test('biografia sem seções nunca habilita reparo automático nem declara ficha completa',()=>{
  const report=audit({name:'X',system:{biography:'<details><summary>Original (D&amp;D 5e) — traços e ações</summary><p>Keen Smell. Better smell.</p></details>'},items:[]});
  assert.equal(report.origin,'biography');
  assert.ok(report.candidates.every(c=>c.blocked));
  assert.ok(report.warnings.length);
});
test('magia e resistência lendária exigem adaptação manual',()=>{
  for(const name of ['Innate Spellcasting','Spellcasting','Legendary Resistance (3/Day)'])assert.equal(convertEntry({name,text:'Original effect.',section:'traits'}).blocked,true);
});
test('dano de doença tardia não entra no acerto imediato',()=>{
  const {item}=convertEntry({name:'Tentacle',section:'action',text:'Melee Weapon Attack: +9 to hit, reach 10 ft., one target. Hit: 12 (2d6 + 5) bludgeoning damage. After 1 minute, the creature takes 6 (1d12) acid damage every 10 minutes.'});
  assert.equal(item.system.attack.damage,'2d6+5');
});
test('custo após título HTML sem ponto é preservado; raio abreviado é reconhecido',()=>{
  const [entry]=blocks('<p><strong>Disrupt Life</strong> (Costs 3 Actions). Each creature within 20 ft. must make a DC 18 Constitution saving throw, taking 21 (6d6) necrotic damage.</p>');
  const {item}=convertEntry({...entry,section:'legendary'},{boss:true,legendary:true});
  assert.equal(item.system.activation.recharge,1);
  assert.equal(item.system.target.shape,'radius');
  assert.equal(item.system.attack.damage,'8d6');
});

function mock(){
  let seq=0;
  const documents=new Map();
  const actor={id:'a',name:'Test',type:'npc',isOwner:true,hasPlayerOwner:false,system:{hierarchy:'complex',archetype:[],level:{value:2}},flags:{},
    items:{[Symbol.iterator]:()=>documents.values(),get:id=>documents.get(id)},
    setFlag:async(module,k,v)=>{actor.flags[module]??={};actor.flags[module][k]=structuredClone(v);},
    createEmbeddedDocuments:async(_type,data)=>data.map(source=>{const doc={...structuredClone(source),id:`new${++seq}`,toObject(){const {toObject,...data}=this;return structuredClone(data);}};documents.set(doc.id,doc);return doc;}),
    updateEmbeddedDocuments:async(_type,data)=>{for(const source of data){const id=source._id??source.id;Object.assign(documents.get(id),structuredClone(source));}},
    deleteEmbeddedDocuments:async(_type,ids)=>{ids.forEach(id=>documents.delete(id));}
  };
  return {actor,game:{system:{id:'skyfall'},user:{isGM:true},packs:{get:()=>null}},documents};
}
const raw={actions:[{name:'Club',desc:'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) bludgeoning damage.'}]};
test('prévia somente leitura, correção, nova auditoria sem duplicar, desfazer',async()=>{
  const {actor,game,documents}=mock();
  const report=await preview(game,actor,raw);
  assert.equal(documents.size,0);
  assert.equal(await apply(game,actor,report,[0]),1);
  assert.equal(documents.size,1);
  assert.equal((await preview(game,actor,raw)).candidates[0].status,'existing');
  await undo(game,actor);
  assert.equal(documents.size,0);
});
test('mudança posterior invalida prévia e protege desfazer',async()=>{
  const {actor,game}=mock();const report=await preview(game,actor,raw);
  actor.system.level.value=3;
  await assert.rejects(apply(game,actor,report,[0]),/mudou/);
  await apply(game,actor,await preview(game,actor,raw),[0]);
  actor.system.level.value=4;
  await assert.rejects(undo(game,actor),/mudou/);
});
test('falha no segundo Item recupera o primeiro e mantém backup',async()=>{
  const {actor,game,documents}=mock();let count=0;const original=actor.createEmbeddedDocuments;
  actor.createEmbeddedDocuments=async(...args)=>{if(++count===2)throw Error('falha simulada');return original(...args);};
  const report=await preview(game,actor,{actions:[...raw.actions,{name:'Rock',desc:'Ranged Weapon Attack: +4 to hit, range 30 ft. Hit: 7 (2d6) bludgeoning damage.'}]});
  await assert.rejects(apply(game,actor,report,[0,1]),/falha simulada/);
  assert.equal(documents.size,0);
  assert.equal(actor.flags['quedaco-monstros'].backup.failed,true);
});
test('bloqueia jogador e ficha de jogador',async()=>{
  const {actor,game}=mock();game.user.isGM=false;
  await assert.rejects(preview(game,actor,raw),/Mestra/);
  game.user.isGM=true;actor.hasPlayerOwner=true;
  await assert.rejects(preview(game,actor,raw),/dono jogador/);
});
test('hierarquia e benefícios vêm do compêndio autorizado e preservam efeitos',async()=>{
  const {actor,game}=mock();
  const role={type:'hierarchy',name:'Chefão',system:{identifier:'boss',benefits:[{type:'ability',uuid:'Compendium.test.Item.boss'}]}};
  game.packs.get=()=>({getIndex:async()=>[{_id:'boss',type:'hierarchy',system:{identifier:'boss'}}],getDocument:async()=>({toObject:()=>structuredClone(role)})});
  const benefit={type:'ability',name:'Chefão',system:{activation:{type:'passive'}},effects:[{name:'Efeito nativo'}]};
  const report=await preview(game,actor,{legendary_actions:[{name:'Move',desc:'Moves away.'}]},async()=>({toObject:()=>structuredClone(benefit)}));
  assert.ok(report.candidates.some(c=>c.item.type==='hierarchy'&&c.item.system.identifier==='boss'));
  assert.deepEqual(report.candidates.find(c=>c.item.name==='Chefão'&&c.item.type==='ability').item.effects,benefit.effects);
});

test('Kraken: referência lendária reutiliza Lightning Storm sem bloquear nem duplicar',()=>{
  const report=audit({name:'Kraken',system:{archetype:['brute']},items:[]},{actions:[{name:'Lightning Storm',desc:'The kraken creates three bolts of lightning within 120 feet. A target makes a DC 23 Dexterity saving throw, taking 22 (4d10) lightning damage, or half as much damage.'}],legendary_actions:[{name:'Lightning Storm (Costs 2 Actions)',desc:'The kraken uses Lightning Storm.'}]});
  assert.equal(report.candidates.length,1);
  const c=report.candidates[0];assert.equal(c.blocked,false);
  assert.equal(c.item.system.attack.damage,'5d10');
  assert.equal(c.item.system.range.value,36);
  assert.equal(c.item.system.target.quantity,3);
});
test('Kraken: save de regurgitar não troca a proteção da mordida; digestão permanece descrita',()=>{
  const {item,reviewRequired}=convertEntry({name:'Bite',section:'action',text:'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 23 (3d8 + 10) piercing damage. The target is swallowed and takes 42 (12d6) acid damage at the start of each turn. The kraken makes a DC 25 Constitution saving throw to regurgitate.'},{boss:true,brute:true});
  assert.equal(item.system.attack.protection,'dex');
  assert.equal(item.system.attack.damage,'4d8+10');
  assert.match(item.system.effect.descriptive,/12d6/);
  assert.equal(reviewRequired,true);
});
test('Bruto conta seu dado uma vez a partir da fonte original',()=>{
  const entry={name:'Claw',section:'action',text:'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d6) slashing damage.'};
  assert.equal(convertEntry(entry,{brute:true}).item.system.attack.damage,'3d6');
  assert.equal(convertEntry(entry,{brute:true}).item.system.attack.damage,'3d6');
});
test('biografia antiga com título alternativo e seções HTML vira fonte estruturada',()=>{
  const report=audit({name:'X',system:{biography:'<details><summary><strong>Original D&amp;D</strong></summary><h3>Traits</h3><p><strong>Amphibious.</strong> Breathes air.</p><h3>Actions</h3><p><strong>Bite.</strong> Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 3 (1d6) piercing damage.</p><h3>Legendary Actions</h3><p><strong>Move.</strong> Moves away.</p></details>'},items:[]});
  assert.equal(report.origin,'biography-sections');
  assert.equal(report.legendary,true);
  assert.deepEqual(report.candidates.map(c=>c.item.system.activation.type),['passive','action','action']);
});
test('origem oficial prevalece sobre nome igual ao SRD e flag antiga',()=>{
  const actor={name:'Kraken',type:'npc',isOwner:true,flags:{quedaco:{convertedFrom:'dnd5e'}},_stats:{compendiumSource:'Compendium.skyfall-core.enemies.Actor.kraken'}};
  assert.equal(classify(actor,[{name:'Kraken'}]),'official');
  assert.equal(batchEligible(actor,[{name:'Kraken'}]),false);
  assert.equal(classify({...actor,_stats:{},flags:{}},[{name:'Kraken'}]),'matched');
  assert.equal(classify({...actor,name:'Lodo Arcano',_stats:{},flags:{}},[{name:'Kraken'}]),'unknown');
});
test('fonte carrega do gist uma vez e persiste entre sessões',async()=>{
  let calls=0,cached=[];
  const game={user:{isGM:true},settings:{get:()=>cached,set:async(_id,_k,v)=>cached=v}};
  const fetcher=async()=>{calls++;return {ok:true,json:async()=>({files:{data:{filename:'srd_5e_monsters.json',content:JSON.stringify([{name:'Kraken',actions:[]}])}}})};};
  assert.equal((await ensureSources(game,null,{fetcher}))[0].name,'Kraken');
  assert.equal((await ensureSources(game,null,{fetcher}))[0].name,'Kraken');
  assert.equal(calls,1);
  await assert.rejects(loadPublicSources(async()=>({ok:false,status:429})),/429/);
});
test('lote protege oficiais, ignora ambíguos, preserva backup individual e continua após falha',async()=>{
  const first=mock(),second=mock();
  first.actor.name='Clubster';first.actor.flags={quedaco:{convertedFrom:'dnd5e'}};
  second.actor.id='b';second.actor.name='Clubster';second.actor.flags={quedaco:{convertedFrom:'dnd5e'}};
  const official={...mock().actor,id:'official',name:'Clubster',_stats:{compendiumSource:'Compendium.skyfall-core.enemies.Actor.o'}};
  const actors=new Map([['a',first.actor],['b',second.actor],['official',official]]);
  first.game.actors={get:id=>actors.get(id),[Symbol.iterator]:()=>actors.values()};
  const sources=[{name:'Clubster',...raw}];
  const rows=await prepareBatch(first.game,sources);
  assert.equal(rows.length,2);
  const selected=Object.fromEntries(rows.map(r=>[r.actorId,defaultSelection(r.report)]));
  second.actor.system.level.value=8;
  const results=await applyBatch(first.game,sources,rows,selected);
  assert.deepEqual(results.map(r=>r.status),['applied','failed']);
  assert.equal(first.documents.size,1);assert.equal(second.documents.size,0);
  assert.ok(first.actor.flags['quedaco-monstros'].backup);
});
test('atualizações no lote exigem opção explícita e dano condicional fica de fora',()=>{
  const report={origin:'json',candidates:[{source:{},status:'existing',differences:['attack.damage']},{source:{},status:'missing',reviewRequired:true},{source:{},status:'ambiguous',blocked:true}]};
  assert.deepEqual(defaultSelection(report),[]);
  assert.deepEqual(defaultSelection(report,{replace:true}),[0]);
});
