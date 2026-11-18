---
name: Escopo inicial do Confere
description: Objetivo do produto e limites explícitos da primeira etapa
---

Confere é uma aplicação em português do Brasil para pequenos comércios conferirem notas fiscais de fornecedores.

O escopo atual tem as telas “Pedido”, “Nota fiscal” e “Conferência”. O pedido permite cadastrar, editar e remover itens (descrição, quantidade, unidade e preço unitário combinado) e salvar esses dados em localStorage. A nota fiscal lê XML de NF-e localmente, sem IA, e exibe os campos básicos e os produtos. A conferência relaciona itens da nota ao pedido, permite informar quantidade recebida e calcula diferenças de quantidade e preço; ainda não persistir os resultados da conferência. As telas da nota e da conferência exibem um selo verde quando todos os itens têm IBSCBS com CST e cClassTrib preenchidos, e amarelo nos demais casos, com uma explicação sobre o possível impacto em créditos a partir de 2027. Não criar login ou banco de dados. O usuário pediu visual simples e moderno com fundo claro.

**Why:** o usuário definiu o escopo em etapas e agora solicitou a conferência e a verificação visual dos campos IBS/CBS da NF-e.

**How to apply:** preservar a navegação simples entre as três telas; manter os dados do pedido somente no navegador; tratar o selo como presença dos campos exigidos, sem calcular tributos; não acrescentar autenticação, banco de dados ou IA por iniciativa própria.
