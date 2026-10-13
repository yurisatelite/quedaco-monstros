/** Templates verified against Skyfall 1.0.1 Ability.defineSchema. */
export function buildPassiveItem(name,descriptionHtml,{activation='passive'}={}){
  return {name,type:'ability',img:'icons/svg/aura.svg',effects:[],system:{
    description:{value:descriptionHtml,flavor:''},origin:[''],descriptors:[],
    activation:{type:activation,cost:activation==='passive'?0:1,repeatable:false,recharge:null},
    trigger:{descriptive:''},duration:{descriptive:'',value:null,units:'',event:'',concentration:false},
    target:{descriptive:'',type:'',quantity:null,shape:'',length:null,width:null,units:'m'},
    range:{descriptive:'',value:null,units:''},
    attack:{descriptive:'',hit:'',miss:'',type:null,ability:'',protection:'',damage:''},
    effect:{descriptive:descriptionHtml,damage:''},special:{descriptive:''},
    uses:{value:null,max:null,per:null,recovery:''},consume:{type:'',target:null,amount:null,scale:false},
    identifier:'',rolls:{},wip:{rolls:{},description:''}
  }};
}
export function feetToMeters(feet){return Number(feet)*0.3;}
export function crToNd(input){
  const raw=String(input??'').split(/[ (]/)[0];const fraction=raw.split('/').map(Number);
  const cr=fraction.length===2?fraction[0]/fraction[1]:Number(raw);
  if(!Number.isFinite(cr))return null;
  if(cr<=1)return 1;
  if(cr<=4)return Math.round(cr);
  return Math.min(12,Math.ceil(cr/2)+2);
}
export function originalTextFromBiography(biography=''){
  const match=String(biography).match(/<details[^>]*>\s*<summary[^>]*>Original \(D(?:&amp;|&)D 5e\)[\s\S]*?<\/summary>([\s\S]*?)<\/details>/i);
  return match?match[1].replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>\s*<p[^>]*>/gi,'\n\n').replace(/<[^>]+>/g,' ').replace(/[ \t]+\n/g,'\n').trim():'';
}
