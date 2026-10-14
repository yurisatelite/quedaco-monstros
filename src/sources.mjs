import {ID,key} from './conversion.mjs';

export const SOURCE_SETTING='sourceCache';
export function validateSources(json){
  const list=Array.isArray(json)?json:json?.monsters??[json];
  if(!Array.isArray(list)||!list.length||list.some(s=>!s||typeof s!=='object'||!(s.name??s.Name)))throw Error('JSON de monstros inválido.');
  return list;
}
export function sourceFor(actor,list){
  const original=actor.flags?.quedaco?.sourceName||actor.name;
  const matches=list.filter(s=>key(s.name??s.Name)===key(original));
  return matches.length===1?matches[0]:undefined;
}
export function classify(actor,list=[]){
  if(actor.type!=='npc'||actor.hasPlayerOwner||!actor.isOwner)return 'excluded';
  const origin=actor._stats?.compendiumSource??actor.toObject?.()._stats?.compendiumSource??'';
  if(/^Compendium\.skyfall(?:-core|-fastplay)?\./i.test(origin))return 'official';
  if(['dnd5e','homebrew'].includes(actor.flags?.quedaco?.convertedFrom))return 'imported';
  return sourceFor(actor,list)?'matched':'unknown';
}
export function batchEligible(actor,list=[]){return ['imported','matched'].includes(classify(actor,list));}

/** Download only after the GM opens an audit; persist locally in the world. */
export async function loadPublicSources(fetcher=globalThis.fetch){
  const response=await fetcher('https://api.github.com/gists/9819e4ac6d529e225e9fc58b358c3479');
  if(!response.ok)throw Error(`Fonte pública indisponível (${response.status}). Carregue o arquivo JSON.`);
  const gist=await response.json();
  const file=Object.values(gist.files??{}).find(f=>f.filename==='srd_5e_monsters.json');
  if(!file)throw Error('O gist não contém o arquivo esperado.');
  let content=file.content;
  if(file.truncated){
    const url=new URL(file.raw_url);
    if(url.hostname!=='gist.githubusercontent.com')throw Error('Endereço da fonte inválido.');
    const raw=await fetcher(url.href);if(!raw.ok)throw Error('Não foi possível baixar a fonte completa.');content=await raw.text();
  }
  return validateSources(JSON.parse(content));
}
export async function ensureSources(game,file,{fetcher=globalThis.fetch,refresh=false}={}){
  if(!game.user.isGM)throw Error('Apenas a Mestra pode carregar a fonte.');
  if(file){const list=validateSources(JSON.parse(await file.text()));await game.settings.set(ID,SOURCE_SETTING,list);return list;}
  const cached=game.settings.get(ID,SOURCE_SETTING);
  if(!refresh&&Array.isArray(cached)&&cached.length)return validateSources(cached);
  const list=await loadPublicSources(fetcher);await game.settings.set(ID,SOURCE_SETTING,list);return list;
}
