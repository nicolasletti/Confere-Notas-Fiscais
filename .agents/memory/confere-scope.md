---
name: Escopo atual do Confere
description: Telas, regras de conferência e limites de uso de IA no app
---

Confere é uma aplicação em português do Brasil para pequenos comércios conferirem notas fiscais de fornecedores. O escopo atual tem as telas “Pedido”, “Nota fiscal” e “Conferência”.

O pedido permite cadastrar, editar e remover itens (descrição, quantidade, unidade e preço unitário combinado) e salvar esses dados em localStorage. A nota fiscal lê XML de NF-e localmente, sem IA, e exibe os campos básicos e os produtos. A conferência relaciona itens da nota ao pedido, permite informar quantidade recebida e calcula diferenças de quantidade e preço; os resultados não são persistidos.

As telas da nota e da conferência exibem um selo verde quando todos os itens têm IBSCBS com CST e cClassTrib preenchidos, e amarelo nos demais casos, com uma explicação sobre o possível impacto em créditos a partir de 2027. O selo verifica apenas presença de campos, sem calcular tributos.

Quando há cobrança a mais positiva, o usuário pode solicitar uma mensagem em estilo WhatsApp. A integração de IA recebe o número da nota, descrições e valores já calculados pelo app; ela redige apenas a saudação curta. O app insere as divergências, as partes e o total usando os textos formatados previamente, sem deixar a IA calcular ou alterar valores. A mensagem pode ser editada e copiada, mas não é salva.

Não criar login nem banco de dados. Manter os dados do pedido no navegador e não persistir mensagens ou resultados da conferência.

**Why:** o usuário definiu explicitamente o uso de IA apenas para redigir uma mensagem de cobrança, preservando os cálculos exatos do Confere.

**How to apply:** enviar à IA apenas fatos necessários para o tom da mensagem; manter número da NF-e, divergências, valores, total e pedido de abatimento/devolução montados pelo app, sem cálculo tributário ou persistência.
