import {ID} from './conversion.mjs';
import {createV2Items} from './item-automation-catalog.mjs';

/** QUEDAÇO integration contract v1; exposes no Actors, sources or private data. */
export function registerIntegration(game,hooks,openInterface){
  const module=game.modules.get(ID);
  const descriptor=Object.freeze({
    family:'quedaco',contractVersion:1,id:ID,title:module.title,version:module.version,
    capabilities:Object.freeze({monsterAudit:true,monsterConversion:true,batchRepair:true,itemEffects:true,torchLights:true}),
    open(){return openInterface();},
    createItemsV2(){return createV2Items(game);},
    getStatus(){return {ready:true,systemCompatible:game.system?.id==='skyfall',canManage:Boolean(game.user?.isGM)};}
  });
  module.api=descriptor;
  hooks.callAll('quedaco:register',descriptor);
  return descriptor;
}
