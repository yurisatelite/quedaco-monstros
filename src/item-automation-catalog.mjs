// Skyfall DIGITAL 1.25 pp. 33, 232–234, 254. Homebrew is explicitly labelled.
export const ITEM_SCOPE='quedaco-monstros';
export const AUTOMATION_FLAG='itemAutomation';
export const REQUEST_FLAG='itemUseRequest';
export const DAMAGE_TYPES={acid:'Ácido',cold:'Gélido',fire:'Ígneo',energy:'Energético',lightning:'Elétrico',necrotic:'Necrótico',poison:'Venenoso',psychic:'Psíquico',radiant:'Radiante',thunder:'Trovejante'};
export const TORCH_TEMPLATE={id:'torch',name:'Tocha',type:'equipment',rule:'Luz e consumo controlados pelo interruptor do GERADOR; uma unidade por acendimento, por uma hora de jogo.'};
export const ITEM_AUTOMATIONS=[
  {id:'shield',name:'Escudo Iluminador',source:['Escudo leve'],type:'armor',action:'Ativar/apagar',rule:'Uma carga e ação bônus ativam luz de tocha até fim da cena. Apagar e reacender na mesma cena não gasta nova carga.'},
  {id:'healer',name:'Kit de curandeiro',type:'equipment',action:'Estabilizar',rule:'Uma ação e uma das dez aplicações estabilizam uma criatura a 0 PV, sem cura nem teste.'},
  ...[['heal','Poção de Cura','2d4+2'],['heal-major','Poção de Cura Maior','4d4+4'],['heal-superior','Poção de Cura Superior','8d4+8'],['heal-supreme','Poção de Cura Suprema','10d4+20']].map(([id,name,formula])=>({id,name,formula,type:'consumable',action:'Beber',rule:`Recupera ${formula} PV; uma dose por uso.`})),
  {id:'climb',name:'Poção de Escalada',type:'consumable',action:'Beber',rule:'Deslocamento de escalada igual ao terrestre até fim da cena.'},
  {id:'strength',name:'Poção de Força de Gigante',source:['Poção de Força de Gigante','Poção de Força'],type:'consumable',action:'Beber',rule:'FOR passa a +5 até fim da cena.'},
  {id:'invisible',name:'Poção de Invisibilidade',type:'consumable',action:'Beber',rule:'Invisível até fim da cena, ataque ou conjuração.'},
  {id:'see-invisible',name:'Poção de Ver o Invisível',homebrew:true,type:'consumable',action:'Beber',rule:'Criação da mesa. Ver Invisibilidade com alcance e duração configuráveis nas configurações do QUEDAÇO. Não revela tokens ocultados pela Mestra.'},
  {id:'resistance',name:'Poção de Resistência a Dano',type:'consumable',action:'Beber',rule:'Resistência a um tipo elemental escolhido pela Mestra ou sorteado em d10, até fim da cena.'},
  {id:'antitoxin',name:'Antitoxina',type:'consumable',action:'Beber',rule:'Protegido contra efeitos Venenosos ou que causem Envenenado até final do próximo descanso.'},
  {id:'speed',name:'Poção de Velocidade',type:'consumable',action:'Beber',rule:'Uma ação bônus adicional até fim da cena. Não acumula com Velocidade de Enoch; não aumenta deslocamento.'},
  ...[['poison','Veneno Básico','1d4'],['poison-snake','Veneno de Serpente','3d6'],['poison-wyvern','Veneno de Serpe Silvestre','7d6'],['poison-lotus','Veneno de Lótus Selvagem','12d6']].map(([id,name,formula])=>({id,name,formula,type:'consumable',action:'Aplicar',rule:`Uma ação aplica em uma arma ou três munições. Ataque Potente com +${formula} Venenoso até acerto ou fim da cena.`})),
  {id:'acid',name:'Ácido',formula:'2d6',damageType:'acid',type:'consumable',action:'Arremessar',rule:'Uma ação, ataque à distância a até 6 m; acerto causa 2d6 Ácido.'},
  {id:'kishi',name:'Fogo Kishi',formula:'1d4',damageType:'fire',type:'consumable',action:'Arremessar',rule:'Uma ação, ataque à distância DES contra DES a até 6 m. Acerto: 1d4 Ígneo e Em Chamas.'},
  {id:'trap',name:'Armadilha de caça',type:'equipment',action:'Preparar/acionar',rule:'Preparar usa uma ação. Ataque +3 contra DES, 1d4 Perfurante; corrente limita movimento a 3 m. Libertar: FOR 13; falha causa 1d4 Perfurante.'},
  {id:'rations',name:'Rações (1 dia)',source:['Rações (1 dia)','Rações'],type:'consumable',action:'Consumir',rule:'Desconta as rações indicadas e registra alimentação; não concede bônus de combate.'}
];
export const normalizeItemName=name=>String(name??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function automationFor(item){
  const id=item?.getFlag?.(ITEM_SCOPE,AUTOMATION_FLAG)??item?.flags?.[ITEM_SCOPE]?.[AUTOMATION_FLAG];
  return ITEM_AUTOMATIONS.find(row=>row.id===id)??null;
}
export function makeV2Data(spec,source,folder){
  const data=source?structuredClone(source):{type:spec.type,img:spec.homebrew?'icons/svg/eye.svg':'icons/svg/item-bag.svg',system:{quantity:1,capacity:1,price:0,description:{value:''},...(spec.type==='consumable'?{type:'potion'}:{})}};
  for(const key of ['_id','_stats','ownership','sort'])delete data[key];
  data.name=`${source?.name??spec.name} V2`;data.folder=folder;data.effects=[];
  data.flags={['quedaco-monstros']:{[AUTOMATION_FLAG]:spec.id,homebrew:!!spec.homebrew}};
  if(spec.id==='torch')data.flags[ITEM_SCOPE].torch=true;
  data.system.description??={value:''};
  data.system.description.value+=`<p><strong>QUEDAÇO V2${spec.homebrew?' — criação da mesa':''}:</strong> ${spec.rule}</p>`;
  if(spec.id==='healer')data.system.uses={value:10,max:10,per:null};
  if(spec.id==='shield'){
    data.system.type='shield';data.system.sigils=[];
    data.flags['quedaco-monstros'].shieldCharges=3;
  }
  return data;
}

export async function createV2Items(game){
  if(!game.user.isGM)throw Error('Só a Mestra pode criar o catálogo V2.');
  const folder=game.folders.find(f=>f.type==='Item'&&f.name==='QUEDAÇO — Itens V2')
    ??await Folder.create({name:'QUEDAÇO — Itens V2',type:'Item'});
  const packs=Array.from(game.packs).filter(p=>p.documentName==='Item'&&/^skyfall(?:-core)?\./.test(p.collection));
  const indices=await Promise.all(packs.map(async pack=>{try{return {pack,index:await pack.getIndex()};}catch{return null;}}));
  const result={created:[],existing:[],missingSource:[]};
  let illuminator=game.items.find(i=>i.getFlag?.('quedaco-monstros','itemAutomationSupport')==='illuminator');
  if(!illuminator){
    for(const entry of indices.filter(Boolean)){
      const row=entry.index.find(i=>i.type==='sigil'&&normalizeItemName(i.name)==='iluminador');
      if(!row)continue;
      const original=(await entry.pack.getDocument(row._id)).toObject();
      for(const key of ['_id','_stats','ownership','sort'])delete original[key];
      original.name+=' V2';original.folder=folder.id;original.effects=[];
      original.flags={['quedaco-monstros']:{itemAutomationSupport:'illuminator'}};
      illuminator=await Item.create(original);result.created.push(illuminator);break;
    }
  }
  for(const spec of [TORCH_TEMPLATE,...ITEM_AUTOMATIONS]){
    const existing=game.items.find(i=>i.getFlag?.(ITEM_SCOPE,AUTOMATION_FLAG)===spec.id);
    if(existing){result.existing.push(existing);continue;}
    let source;
    if(!spec.homebrew){
      const names=(spec.source??[spec.name]).map(normalizeItemName);
      for(const entry of indices.filter(Boolean)){
        const match=entry.index.find(i=>names.includes(normalizeItemName(i.name).replace(/\s*\(\d+d\d+\s*\+?\s*\d*\)\s*$/,''))
          &&(spec.id==='shield'?i.type==='armor':['equipment','consumable'].includes(i.type)));
        if(match){source=(await entry.pack.getDocument(match._id)).toObject();break;}
      }
      // Official items must come from the installed authorized compendium, not guessed schemas.
      if(!source){result.missingSource.push(spec.name);continue;}
    }
    if(spec.id==='shield'&&!illuminator){result.missingSource.push('Sigilo Iluminador');continue;}
    const data=makeV2Data(spec,source,folder.id);
    if(spec.id==='shield'){
      data.name='Escudo Iluminador V2';
      data.system.sigils=[{uuid:illuminator.uuid,parentUuid:'',infused:false}];
    }
    result.created.push(await Item.create(data));
  }
  return result;
}
