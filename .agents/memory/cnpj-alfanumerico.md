---
name: CNPJ alfanumérico
description: Regra oficial de validação do CNPJ numérico e alfanumérico no coNFere.
---

O CNPJ aceita letras e números nas primeiras 12 posições; os dois dígitos finais continuam numéricos. No cálculo dos dígitos verificadores, use o valor ASCII de cada caractere menos 48 (A = 17, B = 18, etc.), os pesos oficiais e módulo 11. CNPJs numéricos legados continuam válidos.

**Why:** A Receita Federal passou a adotar o formato alfanumérico; validação só numérica rejeita cadastros válidos.

**How to apply:** Preserve os dois formatos em cadastro, importação e validação. A máscara mantém as posições `00.000.000/0000-00`, mas não deve converter letras em dígitos.

Fonte oficial: https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf
