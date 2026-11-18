---
name: Escopo atual do Confere
description: Telas, regras de conferência e limites de uso de IA no app
---

Confere é uma aplicação em português do Brasil para pequenos comércios conferirem notas fiscais de fornecedores. O escopo atual tem as telas “Pedido”, “Nota fiscal” e “Conferência”.

O pedido permite cadastrar, editar e remover itens (descrição, quantidade, unidade e preço unitário combinado) e salvar esses dados em localStorage. A opção de importar do WhatsApp envia o texto colado à OpenAI pela integração gerenciada do Replit para extrair itens. Campos que a IA não identificar ficam vazios; o usuário revisa e edita antes de confirmar o salvamento no navegador. Não guardar o texto original.

A nota fiscal lê XML de NF-e localmente, sem IA, e exibe os campos básicos e os produtos. A conferência relaciona itens da nota ao pedido, permite informar quantidade recebida e calcula diferenças de quantidade e preço; os resultados não são persistidos.

As telas da nota e da conferência exibem um selo verde quando todos os itens têm IBSCBS com CST e cClassTrib preenchidos, e amarelo nos demais casos, com uma explicação sobre o possível impacto em créditos a partir de 2027. O selo verifica apenas presença de campos, sem calcular tributos.

Quando há cobrança a mais positiva, o usuário pode solicitar uma mensagem em estilo WhatsApp. A IA recebe o número da nota, descrições e valores já calculados pelo app, mas redige apenas a saudação curta. O app insere as divergências, partes e total sem deixar a IA calcular ou alterar valores. A mensagem pode ser editada e copiada, mas não é salva.

Não criar login nem banco de dados. Manter os dados do pedido no navegador e não persistir mensagens, texto do WhatsApp ou resultados da conferência.

**Why:** o usuário definiu que a IA deve extrair itens de texto livre, deixar dados ausentes para preenchimento e aguardar revisão antes de salvar; também exige que a IA não calcule valores na cobrança.

**How to apply:** tratar o texto colado como entrada não confiável, não inventar quantidades ou preços, destacar campos ausentes e salvar somente após confirmação. Preservar os cálculos e valores de cobrança no app.
