# alinhamento-dna

Site interativo e didático sobre os algoritmos de alinhamento de sequências de DNA: **Global** (Needleman–Wunsch), **Semi-Global** e **Local** (Smith–Waterman).

**Site:** https://lucas7ramos.github.io/alinhamento-dna/

Feito para o seminário de **Biologia Computacional**. Serve como roteiro da apresentação (conduzido com as setas do teclado ou um clicador) e, depois da aula, para explorar sozinho: é só rolar a página ou usar o menu.

## O que tem no site

1. **Início**: o que é alinhar duas sequências, visto pela biologia e pelo algoritmo.
2. **Global**, 3. **Semi-Global**, 4. **Local**: quando cada um é usado, a regra (bordas e traceback) e uma matriz ilustrativa animada, que começa a tocar sozinha, em velocidade rápida, quando você chega nela.
5. **Comparador**: as três matrizes lado a lado, preenchidas em sincronia, célula por célula, seguidas do traceback. Você pode digitar suas próprias sequências (A, C, G, T; de 3 a 10 letras), sortear sequências ou mudar o tamanho. No fim, os resultados dos três algoritmos e uma tabela comparativa.
6. **Fechamento**: QR code e link do site.

## Sistema de pontuação (fixo)

| Situação | Pontos |
|---|---|
| Match (letras iguais) | **+1** |
| Mismatch (letras diferentes) | **−1** |
| Gap (letra contra “−”) | **−2** |

Nos empates vale a prioridade **diagonal > cima > esquerda**. No Local, qualquer valor negativo vira 0.

## Atalhos

| Ação | Teclado |
|---|---|
| Próxima parada | → · PageDown · Enter |
| Parada anterior | ← · PageUp |
| Play / pausa da matriz | Espaço |
| Velocidade | + / − |
| Reiniciar a fase atual | R |
| Tela cheia | F |
| Abrir/recolher o menu de seções | M |
| Mostrar/ocultar notas didáticas | N |

No Comparador, → e ← avançam um passo de cada vez. O menu lateral pula direto para o começo de cada seção. No celular, deslize para os lados.

Em telas de 1280 px com sequências grandes (8 a 10 letras), recolher o menu (M) libera espaço para as três matrizes.

## Como rodar offline

O site não tem dependências (sem CDN e sem fontes externas). Baixe o repositório e abra `index.html` no navegador, com os outros arquivos na mesma pasta. Funciona sem internet.

## Para quem for editar

| Arquivo | Conteúdo |
|---|---|
| `index.html` | estrutura e textos das paradas |
| `estilo.css` | todo o visual |
| `motor.js` | motor de programação dinâmica (`computeDP`) |
| `app.js` | configuração, QR code, matrizes animadas, navegação |

- O motor serve aos três modos e calcula a matriz, os empates, as células grampeadas, o início e o fim do traceback e o alinhamento, para qualquer par de sequências.
- As configurações ficam no objeto `CONFIG`, no começo de `app.js`. O endereço do site (`SITE_URL`), a partir do qual o QR code é gerado, e a faixa do slider “confortável para projetor” (`PROJECTOR_RANGE`) estão marcados como `[ABERTO]`. Ali também ficam a velocidade padrão do play (`SPEED_MS`) e a do play automático das matrizes ilustrativas (`AUTOPLAY_MS`).

## Autor

Lucas Cavalcanti, seminário de Biologia Computacional (2026).

## Licença

[MIT](LICENSE)
