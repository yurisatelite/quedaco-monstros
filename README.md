# QUEDAÇO Monstros

Módulo independente para Foundry VTT 13 e Skyfall 1.0.1. Versão **0.1.0 experimental**, destinada a testar auditoria e correção das habilidades de fichas existentes.

Instale pelo manifesto da versão de teste:

https://github.com/yurisatelite/quedaco-monstros/releases/download/v0.1.0/module.json

Ative no mundo Skyfall. A Mestra abre pelo botão de dragão nos controles de tokens, pelo menu da ficha de ameaça ou pela macro:

```js
game.modules.get('quedaco-monstros').api.open()
```

## Teste inicial

1. Faça uma cópia do mundo ou duplique uma ficha para teste. Abra QUEDAÇO Monstros.
2. Baixe o JSON pela opção Raw do [gist fornecido](https://gist.github.com/tkfu/9819e4ac6d529e225e9fc58b358c3479) e selecione esse arquivo no campo Fonte original. O módulo também lê listas Open5e; não baixa fontes automaticamente.
3. Escolha a ficha e clique em **Auditar e revisar**, ou em **Conferir todas as fichas** para ver e exportar o relatório do mundo.
4. Confira os Items propostos. Ausentes reconhecidos ficam marcados; substituições de Items existentes precisam ser marcadas individualmente. Magias, resistência lendária, nomes ambíguos e originais sem seções são pendências de revisão manual.
5. Clique em **Aplicar selecionadas** e confirme. Abra a ficha, confira as ações e role os ataques. Um backup dos Items alterados fica na flag `quedaco-monstros.backup` do Actor.
6. Para retornar, escolha a mesma ficha e clique em **Desfazer última correção**. Se a ficha foi alterada depois, a restauração automática é bloqueada para preservar essas mudanças; o backup continua disponível para revisão.

O JSON fica apenas na memória da sessão; recarregue a fonte ao recarregar o navegador. O vínculo usa `flags.quedaco.sourceName` ou o nome da ficha. Monstros renomeados sem essa flag precisam da correspondência corrigida. A equivalência de nomes traduzidos é conservadora (Mordida, Garras e Cauda); outras traduções exigem revisão. A biografia antiga perdeu a distinção entre ações, traços e ações lendárias, portanto serve somente à auditoria preliminar.

## Conversões nesta versão

- Ações lendárias com custo 1/2 → uma ação; custo 3 → uma ação com recarga nativa. Custos diferentes exigem revisão.
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

O ZIP e o manifesto são gerados em `dist`. Testes automatizados cobrem as regras, duplicações, invalidação de prévia, permissões, backup e recuperação. O teste visual e de rolagens em um Foundry ativo continua pendente.
