# Itens V2: uso e validação no FoundryServer

Versão 0.2.0 do QUEDAÇO - GERADOR (ID técnico quedaco-monstros). Alvo: Foundry 13.351 / Skyfall 1.0.1. Originais ficam intactos. Atualizar o módulo no FoundryServer não cria documentos por conta própria.

## Criar as cópias

Com o módulo atualizado, a Mestra usa **QUEDAÇO — Criar itens V2** na aba Itens ou **Criar itens V2** na janela do GERADOR. Alternativa para criar os documentos uma vez (uso diário não exige console):

```js
await game.modules.get('quedaco-monstros').api.createItemsV2();
```

São 21 entradas solicitadas, Tocha V2 e Iluminador V2 de apoio ao escudo: até 23 documentos, na pasta **QUEDAÇO — Itens V2**. Copiam fontes oficiais dos compêndios autorizados instalados. Cada nome original recebe ` V2`; o escudo composto chama-se Escudo Iluminador V2. Rodar novamente não duplica os documentos identificados pelas flags do gerador. Efeitos embutidos na cópia são substituídos pelo fluxo V2, sem editar os originais. Se faltar fonte oficial, informa e não inventa substituto. Só Ver o Invisível é criação da mesa, sem preço oficial presumido. Arraste os V2 do diretório para a ficha normalmente.

## Comportamento

| Item | Automação |
| --- | --- |
| Escudo Iluminador + Iluminador V2 | Usa carga do sigilo nativo vinculado. Uma carga na primeira ativação da cena; reacender não gasta. Luz oficial 6 m plena / 12 m total. Botão de recarga confirmado pela Mestra. Use Luz no escudo, não a ativação avulsa do sigilo. |
| Kit de curandeiro V2 | Dez aplicações por kit, alvo adjacente. Estabiliza com três sucessos, sem cura e sem apagar falhas de morte. Rejeita mortos e já estabilizados; ao esgotar kit empilhado passa ao próximo. |
| Cura V2 / Maior V2 / Superior V2 / Suprema V2 | Uma dose; 2d4+2 / 4d4+4 / 8d4+8 / 10d4+20. Usa o motor nativo para cura mágica e limites de PV, sem ressuscitar mortos. Uso pelo portador. |
| Escalada V2 | Efeito Ativo com escalada igual ao terrestre ao ativar. Acrescenta o campo de escalada ausente no schema local, sem editar arquivos do sistema. |
| Força de Gigante V2 | FOR +5 até fim da cena; não sobrescreve permanentemente o atributo. |
| Invisibilidade V2 | Condição Invisível, não Oculto. Encerra na cena ou em ataque/conjuração posterior publicado no chat do sistema. Ações fora do chat exigem remover o efeito manualmente. |
| Ver o Invisível V2 | `seeInvisibility` temporário, preserva detecção preexistente. Defaults da mesa: 12 unidades da cena e 3600 segundos de jogo, configuráveis no QUEDAÇO - GERADOR. Não revela tokens Ocultos nem dá visão no escuro. |
| Resistência a Dano V2 | Tipo escolhido pela Mestra ou d10; para jogador o sorteio é processado pela Mestra. Efeito nativo até fim da cena, sem substituir imunidade por resistência. |
| Antitoxina V2 | Protegido contra Venenoso/Envenenado até descanso; não é imunidade nem resistência a dano venenoso. Conferir Protegido na resolução de ataques externos, que continuam no motor nativo. |
| Velocidade V2 | Uma ação bônus extra, não bônus de deslocamento. Botão de uso uma vez por turno em combate. Recusa acúmulo com efeito ativo chamado Velocidade de Enoch. Ações fora do botão continuam sob controle da mesa. |
| Quatro venenos V2 | Aplicação em arma ou três munições; registra Potente e 1d4 / 3d6 / 7d6 / 12d6 Venenoso. Mestra confirma acerto na arma para aplicar dano e retirar cobertura. Ataque nativo precisa ser resolvido como FOR contra CON. Munições perdidas em erros continuam sob controle da mesa: as três aplicações V2 contam acertos confirmados, não identificam unidades de uma pilha disparadas pelo sistema. |
| Ácido e Fogo Kishi V2 | Dose por arremesso, 6 m de alcance, ataque DES contra DES, ajustes de vantagem/modificador e confirmação da Mestra após catarse/reação. Acerto aplica dano nativo; crítico dobra dados. Kishi aplica Em Chamas. Cancelar devolve frasco; errar o consome. |
| Armadilha de caça V2 | Preparar no espaço do portador; Mestra aciona ao confirmar que alvo pisou ali. Não dispara automaticamente ao mover Token. Ataque +3 contra DES, 1d4 e corrente que limita movimento a 3 m. Libertar: FOR 13; falha causa 1d4. Não é consumida ao preparar. |
| Rações V2 | Desconto explícito de quantidade inteira positiva e mensagem. Não debita inventários automaticamente ao avançar dias; não concede bônus. |

## Duração e autoridade

Um único GM processa solicitações autenticadas do Item, valida proprietário/Token/estoque e serializa a execução. Pedidos possuem recibos persistidos. Falhas na aplicação restituem o recurso consumido. Efeitos temporários usam ActiveEffects, sem substituir permanentemente os atributos.

Fim da cena: encerramento nativo `skyfall.sceneConfig.started: true → false` ou **Encerrar efeitos da cena**. Trocar mapa não encerra a cena. Antitoxina: **Concluir descanso deste personagem** ou hook `quedaco:restFinished`; o sistema local não fornece evento confiável de conclusão de todos os descansos. Duração da poção caseira acompanha tempo de jogo, reconciliado no login e avanço do relógio.

## Testes e pendências

Testes de serviço/fábrica cobrem cópias, idempotência, recursos, dono e alvo, cura nativa, kit/falhas de morte, efeitos/expiração, invisibilidade, Protegido distinto de imunidade, Velocidade/Enoch, venenos, dano, armadilha e rações. Teste de navegador em ficha simulada verifica botão único, convivência com controles nativos e consumo de duas rações.

Pendente no FoundryServer: fontes reais dos compêndios, ficha real e dois clientes, sigilo embutido/cargas, valores derivados/resistências, Protegido nas rolagens nativas, invisibilidade/detecção pela conta do jogador, catarse/críticos/condições e movimento pela corrente. Mocks não comprovam essa integração real.

Fontes conferidas: Livro Básico DIGITAL 1.25 local, p.33, p.230, pp.232–234 e p.254; código instalado Skyfall 1.0.1. Não redistribuir livro nem fontes licenciadas no pacote.
