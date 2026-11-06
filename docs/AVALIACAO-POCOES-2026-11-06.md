# Avaliação de poções e venenos V2

Solicitação do Yuri em 06/11/2026. Auditoria de código, sem alteração de receitas,
Actor, estoque ou efeitos do mundo hospedado.

Automação depende de flags.quedaco-monstros.itemAutomation em um Item V2.
O nome de uma poção comum ou personalizada, sozinho, não ativa o mecanismo.
automationFor só reconhece os IDs do catálogo em item-automation-catalog.mjs.

Não foi encontrada entrada chamada Veneno Escuro no catálogo ou fontes locais
consultadas. Não atribuir a esse nome a fórmula de outro veneno sem conhecer sua
ficha/descrição. Catálogo atual contém venenos Básico, Serpente, Serpe Silvestre
e Lótus Selvagem. Revestem arma ou munições; dano exige confirmação explícita de
acerto pela Mestra. Não aplicam condição Envenenado automaticamente.

Poções de cura chamam aplicação nativa de cura e consomem uma dose. Força,
Escalada, Invisibilidade, Resistência e Antitoxina criam ActiveEffects. Velocidade
controla uma ação bônus adicional por turno, sem alterar deslocamento. Ver o
Invisível é receita caseira explícita, modifica detectionModes e restaura o modo
preexistente; não revela tokens ocultos pela Mestra nem permite atravessar paredes.

Requisitos: Gerador ativo; Item V2 no inventário do Actor; token portador selecionado
na cena; usuário proprietário; Mestra conectada para processar solicitações.
Os controles V2 são adicionados no inventário. Usar somente o botão nativo do
sistema pode não executar a automação adicional. Efeitos de cena acabam no
encerramento da cena Skyfall; Antitoxina no descanso; receita de visão no tempo de jogo.

Verificação: 24 testes específicos passaram em item-automation.test.mjs e
item-automation-ui.test.mjs, incluindo dose, efeito, veneno, expiração, duplicação,
inventário e devolução de dose após falha. Aplicação nativa de dano é simulada nos
testes; valores recalculados pelo Skyfall e percepção do jogador precisam ser
conferidos na mesa. Não foi comprovado defeito novo que justificasse trocar a
mecânica existente ou criar Veneno Escuro com regra inventada.
