# 0.2.0 — QUEDAÇO - GERADOR e itens V2

- Nome exibido alterado para QUEDAÇO - GERADOR. ID `quedaco-monstros`, repositório e manifesto permanente preservados para atualizar instalações existentes.
- Itens V2 e iluminação transferidos do desenvolvimento do QUEDAÇO principal para este módulo independente.
- Criação idempotente das cópias V2 dos compêndios autorizados, incluindo escudo com sigilo Iluminador, kit, quatro curas, Escalada, Força, Invisibilidade, Resistência, Antitoxina, Velocidade, quatro venenos, Ácido, Fogo Kishi, armadilha e rações. Ver o Invisível é criação da mesa, com alcance/duração configuráveis.
- Tocha com interruptor no inventário, consumo e expiração por tempo de jogo; luz anterior restaurada ao apagar.
- Um GM processa os pedidos dos jogadores, com validação de proprietário, estoque e alvo; recibos evitam repetir o mesmo consumo.
- Ataques, venenos, armadilhas e fim de descanso têm passos assistidos documentados. Mocks e navegador simulam os fluxos; testes com compêndios reais e dois clientes no FoundryServer ainda são necessários.
- As ferramentas anteriores de auditoria, conversão, lote, backup e desfazer permanecem disponíveis.

# 0.1.1 — correção em lote e integração QUEDAÇO

- Auditoria e correção dos monstros importados selecionados em um único fluxo, com backup por ficha e relatório de resultado. Atualizações de habilidades existentes dependem da opção explícita na tela.
- Fonte SRD carregada automaticamente do gist e lembrada no mundo. Arquivos alternativos continuam disponíveis; biografias com títulos antigos e seções explícitas passam a ser reconhecidas.
- Janelas com rolagem interna e botões acessíveis; prévia legível sem JSON técnico, busca por nome e filtro de pendências.
- Kraken: referências lendárias à mesma habilidade deixam de bloquear Lightning Storm; alvos e alcance reconhecidos; dano de digestão permanece separado do dano imediato da mordida. Danos condicionais continuam para revisão individual.
- Bruto: o dado extra do dano principal é calculado a partir da fonte original. Fichas oficiais identificadas e Actors com dono jogador são protegidos.
- Protocolo QUEDAÇO: id `quedaco-monstros`, título `QUEDAÇO - Monstros`, `family: quedaco`, `contractVersion: 1`. Capabilities publicadas: `monsterAudit`, `monsterConversion`, `batchRepair`. Métodos públicos: `open()` e `getStatus()` (somente leitura). Registro via `quedaco:register`.
- Integrações opcionais reconhecidas: nenhuma com outros módulos QUEDAÇO; o principal pode consumir o descriptor. Auditoria, conversão assistida, lote, exportação e desfazer continuam disponíveis sem ele. Compêndios autorizados Skyfall são consultados quando instalados.
- Verificação: 26 testes, incluindo integração sem módulo principal, proteção do lote, backup e uma lista de 340 monstros em navegador. Rolagens e equilíbrio ainda precisam de validação na mesa.

# 0.1.0 — versão de teste

Módulo independente QUEDAÇO Monstros, auditoria das fichas existentes, carregamento local da fonte JSON, relatório exportável, prévia por Item, conversão assistida de ações lendárias e chefões, correção selecionada com backup e desfazer. Equilíbrio e rolagens aguardam validação integrada na mesa.
