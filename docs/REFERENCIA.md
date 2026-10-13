# Contrato e limites — 13/10/2026

Skyfall 1.0.1 local, Foundry 13. Consulta somente de código; não é resultado de sessão integrada.

- `Ability.defineSchema`: activation.type = action, bonus, reaction, passive etc.; activation.cost numérico; activation.recharge nullable, máximo 1. Recarga pronta 1, gasta 0.
- `NPC.isBoss` consulta o Item hierarchy com identifier boss; system.hierarchy sozinho não basta. A proficiência é recalculada pelo sistema, conforme ND, e pode diferir da proficiência do CR original.
- `SceneSetting.rechargeAbility` busca habilidades gastas dos inimigos em combate; recuperação faz update para 1. O próprio sistema aplica catarse no uso.
- Itens hierarchy/archetype herdam Identity e abrem BenefitsDialog ao criar. O adaptador suprime esse diálogo somente para o Item exato da correção, pois seus benefícios foram incluídos na prévia. A função original é restaurada em finally.
- Atributo ofensivo e proteção são campos distintos. Um ataque físico costuma usar FOR/DES ofensiva contra DES; saves D&D não devem virar automaticamente saves com DC D&D no Skyfall.
- attack.damage é StringField, rolls contém expressions: aceita fórmulas de dados. O conversor anterior usava dano fixo; esta versão propõe fórmulas e não sobrescreve um ataque existente sem seleção explícita. Validação de rolagem integrada pendente.
- Benefits de ability são resolvidos por UUID no compêndio autorizado; dados e effects são preservados. Grants/escolhas não são inventados.

## Mapa do código

- schema.mjs: template ability e leitura preliminar de biografia.
- conversion.mjs: seções da fonte, regras de chefão, campos de ataques e comparação.
- adapter.mjs: prévia com compêndios, permissões, aplicação serial por ficha e backup/restauração.
- main.mjs: diálogo da Mestra, upload local de JSON, conferência do mundo, prévia e desfazer.

## Pendências explícitas

O guia é comunitário, não um algoritmo que garante equilíbrio. RD depende do papel no encontro. O guia comum sugere treinar uma quantidade de proteções relacionada à proficiência; o conversor anterior treinava dois atributos ou preservava saves D&D. Este módulo não altera esses valores na primeira versão.

Magias, saves sem dano, efeitos condicionais, áreas em formatos não reconhecidos e combinações alternativas de multiataque exigem revisão. A prévia só propõe o que reconhece e bloqueia origens sem seção. O relatório não declara uma ficha equilibrada ou completa.

Foi executada conferência em sete exemplos do catálogo Open5e fornecido pela mesa e do gist indicado: Wolf, Ogre, Cloud Giant, Aboleth, Adult Red Dragon, Ancient Red Dragon e Lich. O catálogo local tinha 322 entradas; o gist consultado tinha 327. Nenhum catálogo foi incluído no pacote. A conferência encontrou e corrigiu a inclusão indevida de dano de doença tardia no ataque imediato do Aboleth. Formatos diferentes de fonte seguem exigindo testes.
