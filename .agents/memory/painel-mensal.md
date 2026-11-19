---
name: Critérios do Painel mensal
description: Definições de compras, preço médio, mês de referência e dados incompletos no Painel
---

O mês de referência é o mês da emissão escrito no XML, não o mês do upload nem a data de salvamento da conferência. O selo do fornecedor considera sua nota de emissão mais recente dentro do mês selecionado.

**Why:** o usuário pediu comparações mensais das compras; enviar XML antigo hoje não deve inflar as compras deste mês.

Compras são a soma dos valores dos produtos (vProd), sem frete e demais acréscimos, conforme explicado na tela e no CSV. O preço médio é ponderado pela quantidade: valor total dividido pela quantidade total. Descrições equivalentes só são agrupadas quando a unidade também coincide; não converter caixas em unidades por suposição.

**Why:** a etapa original extrai os produtos, mas não define um total financeiro com frete e tributos nem fatores de conversão de embalagens. Não inventar cálculos tributários ou conversões.

Notas sem conferência salva entram nas compras, mas não representam divergência zero confirmada. Somente resultados salvos entram nas cobranças a mais; totais favoráveis nunca compensam os positivos. No Painel, a contagem de notas com divergência significa notas com cobrança a mais positiva, explicitada na interface. Resumos antigos sem XML correspondente ficam fora dos indicadores e geram aviso, em vez de inventar valores de compra.

**Why:** compras conhecidas e cobranças efetivamente encontradas são indicadores diferentes; histórico incompleto não deve parecer completo.

**How to apply:** preservar as mesmas definições no Painel e em sua exportação. Se o usuário pedir um conceito mais amplo de compra ou divergência, mudar a definição explicitamente e de forma consistente.
