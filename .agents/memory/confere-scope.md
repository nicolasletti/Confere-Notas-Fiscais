---
name: Escopo inicial do Confere
description: Objetivo do produto e limites explícitos da primeira etapa
---

Confere é uma aplicação em português do Brasil para pequenos comércios conferirem notas fiscais de fornecedores.

O escopo atual tem as telas “Pedido” e “Nota fiscal”. O pedido permite cadastrar, editar e remover itens (descrição, quantidade, unidade e preço unitário combinado) e salvar esses dados em localStorage. A nota fiscal continua lendo XML de NF-e localmente, sem IA, e exibindo os campos básicos e os produtos. Ainda não implementar conferência entre pedido e nota fiscal. Não criar login ou banco de dados. O usuário pediu visual simples e moderno com fundo claro.

**Why:** o usuário definiu os limites atuais do produto e adiou explicitamente a conferência entre o pedido e a nota.

**How to apply:** preservar a navegação simples entre as duas telas; manter os dados do pedido somente no navegador; aguardar pedido explícito antes de implementar conferência, autenticação, banco de dados ou IA.
