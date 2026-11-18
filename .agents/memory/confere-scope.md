---
name: Escopo atual do Confere
description: Telas, regras de conferência e limites de uso de IA no app
---

coNFere é uma aplicação em português do Brasil para pequenos comércios. O produto já inclui Pedido, Nota fiscal, Conferência e Fornecedores. O roadmap explicitamente aprovado também inclui landing page; cadastro/login por e-mail/senha e Google; perfil da empresa; banco de dados por usuário; dashboard com relatórios mensais e semanais; resumo de IBS/CBS das compras; pacote mensal para o contador; previsão de recompra por item; e geração de pedido para o fornecedor via WhatsApp.

O pedido permite cadastrar, editar e remover itens (descrição, quantidade, unidade e preço unitário combinado) e salvar esses dados em localStorage. A opção de importar do WhatsApp envia o texto colado à OpenAI pela integração gerenciada do Replit para extrair itens. Campos que a IA não identificar ficam vazios; o usuário revisa e edita antes de confirmar o salvamento no navegador. Não guardar o texto original.

A nota fiscal lê XML de NF-e localmente, sem IA, e exibe os campos básicos e os produtos. Na Conferência, a IA pode sugerir itens correspondentes do pedido com base somente nas descrições. Aplicar apenas sugestões com confiança de pelo menos 0.82; deixar as demais sem seleção e manter o dropdown editável. Evitar chamadas repetidas para a mesma combinação de nota e pedido durante a sessão.

Na Conferência, o usuário relaciona itens da nota ao pedido, informa a quantidade recebida e vê as diferenças de quantidade e preço. Os resultados não são salvos automaticamente. Após concluir todos os itens, o usuário pode salvar um resumo da conferência em localStorage: fornecedor, número/data da nota, total cobrado a mais e estado do selo IBS/CBS. A tela Fornecedores agrupa esses resumos por fornecedor, conta notas únicas, soma os totais e mostra o selo da nota de emissão mais recente. Regravar a mesma NF-e atualiza o registro existente. Não salvar os detalhes dos itens da conferência.

As telas da nota e da conferência exibem um selo verde quando todos os itens têm IBSCBS com CST e cClassTrib preenchidos, e amarelo nos demais casos, com uma explicação sobre o possível impacto em créditos a partir de 2027. O selo verifica apenas presença de campos, sem calcular tributos.

Quando há cobrança a mais positiva, o usuário pode solicitar uma mensagem em estilo WhatsApp. A IA recebe o número da nota, descrições e valores já calculados pelo app, mas redige apenas a saudação curta. O app insere as divergências, partes e total sem deixar a IA calcular ou alterar valores. A mensagem pode ser editada e copiada, mas não é salva.

Trabalhar em etapas e implementar somente o que a etapa atual pedir, preservando o que já funciona. A existência de uma funcionalidade no roadmap não autoriza antecipar sua implementação. Até a etapa de banco de dados por usuário, manter o pedido e o histórico atual no navegador; não persistir mensagens, texto do WhatsApp ou detalhes por item.

**Why:** o usuário definiu um roadmap amplo, mas quer entregas incrementais e preservação do comportamento existente.

**Regras permanentes:** ler XML de NF-e no código, sem IA. Cálculos de divergência e previsões/recompras são feitos no código, nunca pela IA. A IA fica restrita à geração e transformação de textos e ao casamento/sugestão de itens.

**How to apply:** confirmar a etapa pedida e implementar somente aquele escopo. Para casamento de itens, enviar apenas descrições, usar limite conservador de confiança e manter edição manual. Salvar histórico local apenas após ação explícita, deduplicar por fornecedor/nota/data e usar a emissão mais recente para o selo.

A identidade visual pedida é “coNFere”, com “NF” em destaque. A navegação deve deixar visíveis as três etapas na ordem: “1. Pedido”, “2. Nota fiscal” e “3. Conferência”. O total cobrado a mais precisa ter forte hierarquia visual e boa leitura no celular, sem alterar regras de cálculo.

**Why:** o usuário explicitou a identidade e a prioridade de leitura do resultado como requisitos visuais permanentes do produto.

**How to apply:** preservar essas convenções em futuras melhorias visuais do cabeçalho e da Conferência; alterar apresentação sem mudar comportamento, salvo novo pedido.
