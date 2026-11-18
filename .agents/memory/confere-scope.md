---
name: Escopo inicial do Confere
description: Objetivo do produto e limites explícitos da primeira etapa
---

Confere é uma aplicação em português do Brasil para pequenos comércios conferirem notas fiscais de fornecedores.

O escopo atual tem as telas “Pedido”, “Nota fiscal” e “Conferência”. O pedido permite cadastrar, editar e remover itens (descrição, quantidade, unidade e preço unitário combinado) e salvar esses dados em localStorage. A nota fiscal lê XML de NF-e localmente, sem IA, e exibe os campos básicos e os produtos. A conferência relaciona itens da nota ao pedido, permite informar quantidade recebida e calcula diferenças de quantidade e preço; ainda não persistir os resultados da conferência. Não criar login ou banco de dados. O usuário pediu visual simples e moderno com fundo claro.

**Why:** o usuário definiu o escopo em etapas e agora solicitou a tela de conferência com regras explícitas de cálculo e apresentação.

**How to apply:** preservar a navegação simples entre as três telas; manter os dados do pedido somente no navegador; não acrescentar autenticação, banco de dados ou IA por iniciativa própria.
