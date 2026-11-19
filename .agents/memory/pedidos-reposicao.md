---
name: Pedidos de reposição
description: Limites da IA, referência de preço e proteção do pedido ativo ao gerar compras pelo histórico
---

Itens vermelhos e amarelos começam selecionados para reposição. A quantidade sugerida vem da média de compra e pode ser revisada. O último preço pago é só referência, não um novo preço combinado.

**Why:** o usuário pediu sugestões baseadas no histórico, mas a conferência compara a nota com preços acordados. Não tratar automaticamente uma referência histórica como um acordo confirmado.

Pedidos gerados são separados por fornecedor, mantendo a identidade por CNPJ quando disponível. Quando a previsão pela descrição juntou compras de fornecedores diferentes, sugerir o fornecedor da compra mais recente e deixar essa aproximação explícita.

**Why:** a descrição normalizada pode representar compras de várias origens; escolher o último fornecedor evita inventar uma negociação ou repartir arbitrariamente a quantidade.

A IA redige somente a introdução da mensagem; o código acrescenta a lista exata revisada, sem preços de referência. O texto pede confirmação de disponibilidade, preços e prazo, sem assumir compra fechada.

**Why:** números não podem ser inventados ou recalculados pela IA; o preço histórico ainda não foi confirmado pelo fornecedor.

Gerar um pedido não substitui o pedido ativo. Enquanto a Conferência usar um único pedido ativo, o usuário escolhe qual pedido carregar. A troca exige confirmação, guarda uma cópia do ativo salvo e recusa sobrescrita se ele tiver mudado desde a confirmação.

**Why:** pedidos de vários fornecedores precisam continuar disponíveis quando suas notas chegarem, sem perder um pedido manual já preparado.

O WhatsApp pertence ao cadastro do fornecedor dentro da conta do comerciante. Abrir wa.me apenas prepara a conversa com o texto; não envia automaticamente nem marca o pedido como enviado.

**How to apply:** manter seleção, agrupamento e números no código; persistir pedidos e telefones por usuário; preservar pedidos salvos em falhas da IA e impedir duplicação em novas tentativas da mesma geração.
