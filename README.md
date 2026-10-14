# QUEDAÇO - Monstros

Módulo independente para Foundry VTT 13 e Skyfall 1.0.1. Versão **0.1.1**, com auditoria e correção de habilidades em lote. A adaptação das regras ainda requer conferência na mesa.

Manifesto permanente para instalar e atualizar:

https://github.com/yurisatelite/quedaco-monstros/releases/latest/download/module.json

Se você instalou a 0.1.0 pelo endereço fixo daquela versão, use este novo manifesto para vincular as próximas atualizações. O ZIP da 0.1.0 continua preservado.

Ative no mundo Skyfall. A Mestra abre pelo botão de dragão nos controles de tokens, pelo menu da ficha de ameaça ou pela macro:

```js
game.modules.get('quedaco-monstros').api.open()
```

## Teste inicial

1. Faça uma cópia do mundo ou duplique uma ficha para teste. Abra QUEDAÇO Monstros.
2. Clique em **Revisar monstro** para uma ficha ou em **Auditar todos os importados** para o lote. A fonte do [gist fornecido](https://gist.github.com/tkfu/9819e4ac6d529e225e9fc58b358c3479) é carregada automaticamente e lembrada neste mundo. O campo de arquivo permite usar uma lista Open5e ou outro JSON compatível no lugar dela.
3. No lote, confira os monstros marcados e os totais **Adicionar / atualizar**. A identificação usa a origem de importação ou uma correspondência única com a fonte; Actors de origem oficial Skyfall, fichas de jogadores e origens não identificadas ficam fora do lote.
4. Para corrigir ataques antigos que já existem, marque **Atualizar também habilidades existentes com diferenças**. Sem essa opção, o lote adiciona somente Items ausentes reconhecidos. Magias, resistência lendária, nomes ambíguos, originais sem seções e danos condicionais ficam para revisão individual pelo botão **Revisar uma ficha**.
5. Clique em **Corrigir monstros selecionados** no lote, ou em **Aplicar selecionadas** na prévia individual, e confirme. Abra as fichas, confira as ações e role os ataques. Cada ficha recebe um backup próprio na flag `quedaco-monstros.backup`. O resultado do lote informa sucessos e falhas e pode ser exportado.
6. Para retornar, escolha a mesma ficha e clique em **Desfazer última correção**. Se a ficha foi alterada depois, a restauração automática é bloqueada para preservar essas mudanças; o backup continua disponível para revisão.

O JSON fica no cache local do mundo, sem upload das fichas a serviços externos. O vínculo usa `flags.quedaco.sourceName` ou o nome da ficha. Monstros renomeados sem essa flag precisam da correspondência corrigida. A equivalência de nomes traduzidos é conservadora (Mordida, Garras e Cauda); outras traduções exigem revisão. Biografias antigas com seções explícitas também são lidas. Sem uma fonte que distinga ações de passivas e lendárias, a análise permanece preliminar.

## Conversões nesta versão

- Ações lendárias com custo 1/2 → uma ação; custo 3 → uma ação com recarga nativa. Custos diferentes exigem revisão.
- Referências lendárias que apenas chamam uma ação existente são unificadas. Isso evita bloquear ou duplicar Lightning Storm do Kraken.
- O dado extra do arquétipo Bruto é calculado uma vez a partir do dano principal da fonte original. Saves posteriores do próprio monstro, como regurgitar, não trocam a proteção do ataque de mordida.
- Chefão sem seção de ações lendárias: reduz em um o máximo de multiataques reconhecido, com mínimo de um. A combinação fica a cargo da Mestra. Ameaças comuns mantêm o limite original.
- Áreas reconhecidas de chefões: +1 dado; áreas com recarga: +2 dados. Recarga pronta é `1`, gasta é `0`; o sistema Skyfall controla seu uso e recuperação por catarse.
- Ataques usam atributo + proficiência contra DES; testes de resistência com dano usam a proteção correspondente. FOR/INT ofensivas sugeridas exigem conferência, particularmente em ataques mágicos.
- Alcance, cone/linha/raio reconhecidos, dados de dano e metade do dano no erro entram nos campos nativos. Condições, cura, doenças e demais efeitos permanecem descritos para aplicação manual.
- Hierarquia, arquétipos e benefícios são copiados do compêndio autorizado `skyfall-core.npc-creation`, quando disponível. Sem o compêndio, a prévia informa a pendência.

A versão não cria novos Actors nem altera PV, ND, RD, atributos, imagens, tokens ou biografia. Não é uma certificação de equilíbrio: a adaptação segue o guia comunitário e precisa de validação no Foundry e na mesa. A criação de monstros novos e a adaptação individual de magias ficam para a próxima etapa.

## Fontes e verificação

- [Guia de ameaças do Movimento RPG](https://movimentorpg.com.br/guia-para-adaptar-ameacas-de-dd5e-para-skyfallrpg/).
- [Guia de chefões do mesmo autor](https://movimentorpg.com.br/guia-para-adaptar-chefoes-boss-de-dd5e-para-skyfallrpg/).
- Código instalado Skyfall 1.0.1: `Ability.defineSchema`, `NPC.isBoss`, `Identity._onCreate` e recuperação nativa de recarga. Ver [referência técnica](docs/REFERENCIA.md).

Não são redistribuídos bestiários, textos do livro, compêndios, retratos nem tokens. Os fontes carregados pertencem à mesa e são processados localmente.

```sh
npm test
npm run package
```

O ZIP e o manifesto são gerados em `dist`. Testes automatizados cobrem regras, lote, duplicações, invalidação de prévia, permissões, backup e recuperação. Um teste de navegador com 340 monstros verifica rolagem nos dois sentidos e botões acessíveis usando a estrutura/CSS do Foundry 13; o teste de rolagens em um Foundry ativo continua pendente. O teste de navegador usa Edge no Windows e é pulado em outros sistemas.

## Integração QUEDAÇO

Contrato `family: "quedaco"`, `contractVersion: 1`, id `quedaco-monstros`. A API é registrada no `ready` e emite `quedaco:register` com um descriptor imutável.

- Capabilities: `monsterAudit`, `monsterConversion`, `batchRepair` (booleanas).
- Métodos públicos: `open()` e `getStatus()`.
- `getStatus()` é somente leitura e informa disponibilidade e permissão de gerenciamento; não retorna fichas nem fontes.
- Integrações opcionais com outros módulos QUEDAÇO: nenhuma nesta versão. O principal pode reconhecer o descriptor e abrir esta interface.
- Auditoria, prévia, correção individual/em lote, exportação e desfazer funcionam sem o QUEDAÇO principal. Os benefícios nativos usam o compêndio autorizado `skyfall-core.npc-creation`, quando disponível; sua ausência é informada na prévia.
