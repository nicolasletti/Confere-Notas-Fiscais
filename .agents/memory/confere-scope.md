---
name: Escopo atual do Confere
description: Telas, regras de conferência e limites de uso de IA no app
---

Confere é uma aplicação em português do Brasil para pequenos comércios conferirem notas fiscais de fornecedores. O escopo atual tem as telas “Pedido”, “Nota fiscal” e “Conferência”.

O pedido permite cadastrar, editar e remover itens (descrição, quantidade, unidade e preço unitário combinado) e salvar esses dados em localStorage. A opção de importar do WhatsApp envia o texto colado à OpenAI pela integração gerenciada do Replit para extrair itens. Campos que a IA não identificar ficam vazios; o usuário revisa e edita antes de confirmar o salvamento no navegador. Não guardar o texto original.

A nota fiscal lê XML de NF-e localmente, sem IA, e exibe os campos básicos e os produtos. Na Conferência, a IA pode sugerir itens correspondentes do pedido com base somente nas descrições. Aplicar apenas sugestões com confiança de pelo menos 0.82; deixar as demais sem seleção e manter o dropdown editável. Evitar chamadas repetidas para a mesma combinação de nota e pedido durante a sessão.

A conferência relaciona itens da nota ao pedido, permite informar quantidade recebida e calcula diferenças de quantidade e preço; os resultados não são persistidos. As telas da nota e da conferência exibem um selo verde quando todos os itens têm IBSCBS com CST e cClassTrib preenchidos, e amarelo nos demais casos, com uma explicação sobre o possível impacto em créditos a partir de 2027. O selo verifica apenas presença de campos, sem calcular tributos.

Quando há cobrança a mais positiva, o usuário pode solicitar uma mensagem em estilo WhatsApp. A IA recebe o número da nota, descrições e valores já calculados pelo app, mas redige apenas a saudação curta. O app insere as divergências, partes e total sem deixar a IA calcular ou alterar valores. A mensagem pode ser editada e copiada, mas não é salva.

Não criar login nem banco de dados. Manter os dados do pedido no navegador e não persistir mensagens, texto do WhatsApp ou resultados da conferência.

**Why:** o usuário pediu correspondências automáticas por IA, mas exige que escolhas incertas permaneçam sem seleção para evitar associação errada.

**How to apply:** enviar apenas descrições para o pareamento, usar um limite conservador de confiança, preservar a edição manual e não enviar valores monetários para esse recurso.
