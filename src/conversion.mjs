import {buildPassiveItem,feetToMeters,originalTextFromBiography,crToNd} from './schema.mjs';

export const ID='quedaco-monstros';
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const plain=value=>String(value??'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\u00ad/g,'').replace(/[–−‑]/g,'-').trim();
export const key=value=>plain(value).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s*\((?:ataque|recharge|recarga|costs|\d+\/day)[^)]*\)/gi,'').replace(/[^a-z0-9]/g,'');
const aliases={multiattack:'ataquemultiplo',innatespellcasting:'magiainata',bite:'mordida',claw:'garras',tail:'cauda'};
const matchKey=value=>aliases[key(value)]??key(value);
const damageTypes={force:'energy'};
const abilities={Strength:'str',Dexterity:'dex',Constitution:'con',Intelligence:'int',Wisdom:'wis',Charisma:'cha'};

/** Preserve source sections: activation cannot be inferred from descriptive prose. */
export function blocks(input){
  if(!input)return [];
  if(Array.isArray(input))return input.flatMap(entry=>entry?.name?[{name:plain(entry.name),text:plain(entry.desc??entry.description??'')}]:[]);
  const html=String(input);
  const marked=[...html.matchAll(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi)].filter(m=>/^[A-Za-z]/.test(plain(m[1]))&&!/:/.test(plain(m[1])));
  if(marked.length)return marked.map((m,i)=>({name:plain(m[1]).replace(/\.$/,''),text:plain(html.slice(m.index+m[0].length,marked[i+1]?.index??html.length))}));
  // Only explicit paragraph headings are accepted; unknown prose remains a warning.
  return plain(html).split(/\n\s*\n/).flatMap(p=>{
    const m=p.trim().match(/^([A-Z][A-Za-z'’()\d/–− -]{1,90})\.\s+([\s\S]+)$/);
    return m?[{name:m[1],text:m[2].trim()}]:[];
  });
}

export function sourceSections(actor,raw){
  if(raw){
    const sections=[['traits',raw.Traits??raw.traits??raw.special_abilities],['action',raw.Actions??raw.actions],['bonus',raw['Bonus Actions']??raw.bonus_actions],['reaction',raw.Reactions??raw.reactions],['legendary',raw['Legendary Actions']??raw.legendary_actions]];
    return {entries:sections.flatMap(([section,value])=>blocks(value).map(e=>({...e,section}))),warnings:sections.filter(([,v])=>v&&blocks(v).length===0).map(([s])=>`Seção ${s} não reconhecida; revise a fonte.`),origin:'json'};
  }
  const text=originalTextFromBiography(actor?.system?.biography??'');
  return {entries:blocks(text).map(e=>({...e,section:'unknown'})),origin:'biography',warnings:[text?'A biografia antiga perdeu a separação de ações/traços/lendárias. Carregue o JSON original para converter.':'Original não encontrado. Carregue o JSON original.']};
}

function makeRolls(item,attribute,protection,components){
  item.system.attack.ability=attribute;
  item.system.attack.protection=protection;
  item.system.rolls={attackRoll000001:{label:'Ataque',type:'attack',protection,terms:[{expression:`@${attribute}`,flavor:'',data:'',source:''},{expression:'@proficiency',flavor:'',data:'',source:''}]}};
  components.forEach((c,i)=>item.system.rolls[`damageRoll${String(i).padStart(6,'0')}`]={label:`Dano (${c.type})`,type:'damage',protection,terms:[{expression:c.formula,flavor:c.type,data:'',source:''}]});
  item.system.attack.damage=components.map(c=>c.formula).join(' + ');
}

export function convertEntry(entry,{boss=false,legendary=false}={}){
  const notes=[],{text,section}=entry;
  let name=entry.name;
  let activation=section==='traits'?'passive':section==='reaction'?'reaction':section==='bonus'?'bonus':'action';
  const costMatch=`${name} ${text}`.match(/Costs?\s+(\d+)\s+Actions?/i);
  const cost=costMatch?Number(costMatch[1]):1;
  const recharge=/Recharge\s*\d/i.test(name)||section==='legendary'&&cost===3;
  if(section==='legendary'&&cost>3)notes.push('Custo lendário não coberto pelo guia.');
  name=name.replace(/\s*\((?:Recharge|Costs?)[^)]*\)/gi,'').trim();
  const safeText=escape(text);
  const item=buildPassiveItem(name,`<p>${safeText}</p>`,{activation});
  item.system.activation.cost=activation==='passive'?0:1;
  if(recharge)item.system.activation.recharge=1;
  if(section==='legendary')notes.push(`Custo D&D ${cost}: ${recharge?'recarga por catarse':'ação normal'}.`);
  if(recharge)notes.push('Recarga nativa: pronta; recuperação pela ferramenta de catarse do Skyfall.');
  if(section==='unknown')notes.push('Ativação desconhecida: consulte JSON original.');
  if(/spellcasting/i.test(name))notes.push('Escolha equivalentes das magias no compêndio Skyfall; a lista D&D é referência.');
  if(/legendary resistance/i.test(name))notes.push('Resistência lendária D&D não é equivalente à Resistência do Chefe: revisão obrigatória.');

  if(/^Multiattack$/i.test(name)){
    const count=text.match(/makes?\s+(one|two|three|four|five|six|\d+)\s+(?:[\w'-]+\s+)?attacks/i);
    const words={one:1,two:2,three:3,four:4,five:5,six:6};
    const n=count?(words[count[1]]??Number(count[1])):null;
    item.name='Ataque Múltiplo';
    if(boss&&!legendary&&n){
      const max=Math.max(1,n-1);
      item.system.effect.descriptive=`<p>Realiza até ${max} ataque(s) por turno. Escolha entre os ataques listados abaixo.</p><p>Referência original: ${safeText}</p>`;
      item.system.description.value=item.system.effect.descriptive;
      notes.push(`Chefão sem ações lendárias: ${n} → ${max} ataques; escolha a combinação na mesa.`);
    }else if(boss&&!legendary)notes.push('Quantidade de multiataques não reconhecida; redução exige revisão.');
    return {item,notes,blocked:!n&&boss&&!legendary};
  }

  const weapon=text.match(/(Melee(?: or Ranged)?|Ranged)\s+(Weapon|Spell)\s+Attack/i);
  const save=text.match(/DC\s+\d+\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i);
  // Damage from delayed disease, regeneration, etc. must not become immediate hit damage.
  const damageText=weapon?(text.match(/Hit:\s*([^.!]+[.!])/i)?.[1]??''):(text.match(/[^.!]*\b\d+\s*\(\d+d\d+[^)]*\)[^.]*?damage[^.!]*/i)?.[0]??'');
  const components=[...damageText.matchAll(/\b\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s*(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\s+damage/gi)].map(m=>({formula:m[1].replace(/\s/g,''),type:damageTypes[m[2].toLowerCase()]??m[2].toLowerCase()}));
  let shape=text.match(/(\d+)[-\s]*(?:foot|ft\.?)\s+(cone|line|radius|sphere|cube)/i);
  const radial=text.match(/(?:each|every|all)\s+creature[^.]*?within\s+(\d+)\s+(?:feet|ft\.?)/i);
  if(!shape&&radial)shape=[radial[0],radial[1],'radius'];
  if(shape){
    item.system.target.shape=shape[2].toLowerCase();
    item.system.target.length=feetToMeters(shape[1]);
    item.system.target.descriptive=`${item.system.target.shape} de ${item.system.target.length} m`;
    const width=text.match(/(\d+)[-\s]*(?:foot|feet|ft\.?)\s+wide/i);
    if(width)item.system.target.width=feetToMeters(width[1]);
    if(boss)components.forEach(c=>c.formula=c.formula.replace(/^(\d+)d/,(_,n)=>`${Number(n)+(recharge?2:1)}d`));
    if(boss)notes.push(`Dano em área: +${recharge?2:1} dado(s) por componente reconhecido.`);
  }
  const range=text.match(/(?:reach|range)\s+(\d+)(?:\/\d+)?\s*ft/i);
  if(range){item.system.range.value=feetToMeters(range[1]);item.system.range.units='m';}
  if(weapon||save&&components.length){
    const attribute=weapon?.[2]==='Spell'?'int':weapon?.[1]==='Ranged'?'dex':'str';
    const protection=save?abilities[save[1]]:'dex';
    if(save&&!weapon)notes.push('Teste de resistência D&D convertido em ataque contra a proteção correspondente. Revise o atributo ofensivo sugerido (FOR).');
    if(weapon?.[2]==='Spell')notes.push('Ataque mágico: INT sugerida; confira o atributo de conjuração.');
    if(/Melee or Ranged/.test(weapon?.[1]??''))notes.push('Ataque misto: FOR sugerida; revise alcance e modalidade.');
    makeRolls(item,attribute,protection,components);
    item.system.target.type='creature';item.system.target.quantity=shape?null:1;
    item.system.descriptors=['attack',...(weapon?.[2]==='Spell'?['magic']:[]),...new Set(components.map(c=>c.type))];
    item.system.attack.hit=components.map(c=>`<p>${escape(c.formula)} de dano ${c.type}.</p>`).join('');
    if(/half as much|half the damage/i.test(text))item.system.attack.miss='<p>Metade do dano; confira os efeitos no texto original.</p>';
    if(!components.length)notes.push('Dano não reconhecido; revisão obrigatória.');
    if(/plus|saving throw|condition|poisoned|grappled|restrained|diseas|frightened/i.test(text))notes.push('Efeitos adicionais preservados em texto; aplicação manual.');
  }else if(components.length){
    item.system.effect.damage=components.map(c=>c.formula).join(' + ');
    item.system.rolls=Object.fromEntries(components.map((c,i)=>[`effectRoll${String(i).padStart(6,'0')}`,{label:`Dano (${c.type})`,type:'damage',protection:'str',terms:[{expression:c.formula,flavor:c.type,data:'',source:''}]}]));
    notes.push('Dano direto sem ataque: confira alvo e condições de aplicação.');
  }
  const daily=name.match(/\((\d+)\/Day\)/i);
  if(daily){item.system.uses={value:Number(daily[1]),max:Number(daily[1]),per:'day',recovery:''};notes.push('Limite diário D&D preservado: confira a adaptação para Skyfall.');}
  item.system.special.descriptive=`<p>${escape(notes.join(' '))}</p>`;
  // Keep source prose as reference, with the converted mechanics first.
  item.system.description.value=`${item.system.attack.hit}${item.system.attack.miss}<p>${safeText}</p>${item.system.special.descriptive}`;
  return {item,notes,blocked:section==='unknown'||/legendary resistance|spellcasting/i.test(name)||section==='legendary'&&cost>3};
}

export function audit(actor,raw){
  const source=sourceSections(actor,raw),legendary=source.entries.some(e=>e.section==='legendary');
  const boss=actor?.system?.hierarchy==='boss'||Array.from(actor?.items??[]).some(i=>i.type==='hierarchy'&&i.system?.identifier==='boss')||legendary;
  const current=Array.from(actor?.items??[]);
  const candidates=source.entries.map(entry=>{
    const result=convertEntry(entry,{boss,legendary});
    const found=current.filter(i=>i.type==='ability'&&matchKey(i.name)===matchKey(result.item.name));
    result.item.flags={[ID]:{sourceKey:`${entry.section}:${key(entry.name)}`,version:1}};
    const fields=['activation.type','activation.recharge','attack.ability','attack.protection','attack.damage','target.shape','target.length'];
    const read=(object,path)=>path.split('.').reduce((v,p)=>v?.[p],object)??null;
    const differences=found.length===1?fields.filter(path=>read(found[0].system,path)!==read(result.item.system,path)):[];
    return {...result,differences,source:entry,status:found.length>1?'ambiguous':found.length?'existing':result.blocked?'review':'missing',existingId:found[0]?.id??found[0]?._id};
  });
  const names=new Map();
  candidates.forEach(c=>{const k=matchKey(c.item.name);names.set(k,(names.get(k)??0)+1);});
  candidates.forEach(c=>{if(names.get(matchKey(c.item.name))>1){c.status='ambiguous';c.blocked=true;c.notes.push('Mesmo nome em mais de uma seção; escolha manual necessária.');}});
  return {actorId:actor.id??actor._id,name:actor.name,boss,legendary,origin:source.origin,nd:actor.system?.level?.value??(raw?crToNd(raw.Challenge??raw.challenge_rating):null),warnings:[...source.warnings,'Prévia de adaptação: equilíbrio e equivalência de efeitos exigem teste na mesa.'],candidates};
}

export function snapshot(actor){return JSON.stringify({system:actor.toObject?.().system??actor.system,items:Array.from(actor.items??[]).map(i=>i.toObject?.()??i)});}
