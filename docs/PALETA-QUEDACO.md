# Identidade visual QUEDAÇO — paleta comum

Definição do Yuri em 06/11/2026. Todos os módulos mantêm esta identidade mesmo
instalados separadamente. Não criar dependência obrigatória do núcleo.

| Papel | Token | Cor |
|---|---|---|
| Fundo | --qd-bg | #11151C |
| Caixas | --qd-panel | #1C232D |
| Superfície elevada | --qd-raised | #272F3A |
| Bordas | --qd-line | #46505E |
| Texto | --qd-text | #EDF1F6 |
| Texto secundário | --qd-muted | #B3BDCA |
| Ações, seleção e foco | --qd-accent | #35CEE9 |
| Descobertas, símbolos e detalhes | --qd-copper | #CD806F |
| Fundo discreto de destaque | --qd-copper-soft | #30252A |

Carregar styles/quedaco-palette.css por último no manifesto. O arquivo é uma
cópia idêntica nos nove módulos encontrados no registro do Control Center.
Não substituir o ciano por cobre nos botões principais. O cobre é um acento
pequeno, levemente avermelhado. Verde deixa de ser identidade de interface;
cores semânticas de sucesso/erro, classificações de regiões/biomas, imagens,
mapas e páginas impressas preservam seus significados.

Manter caixas com bordas discretas, raio 8–12px, espaçamentos 4/8/12/16/24/32px,
campos com gap explícito de rótulo e controles que caibam na janela. Preservar
layouts já resolvidos; em mudanças de paleta, mexer só nas cores. Escopar
seletores às aplicações QUEDAÇO. Não usar !important sem necessidade comprovada.

Este lote alterou manifestos e adicionou a paleta local; o empacotador do Criador
também passou a copiar o CSS. Não muda regras, dados, Actors ou permissões.
Próximas alterações devem manter as cópias sincronizadas.

Validação de 06/11/2026: 637 testes dos nove projetos passaram; oito rotinas de
empacotamento passaram. Calendário não possui script package no package.json.
CSS validado por Stylelint do núcleo. Conferência de tokens computados em nove
fixtures e 27 capturas representativas (1180, 760, 360px); não equivale a revisão
de todas as telas no Foundry hospedado. Versões preservadas e nenhuma publicação.

