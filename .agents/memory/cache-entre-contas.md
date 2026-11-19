---
name: Cache entre contas
description: Ordem de preparação da conta e montagem das consultas privadas
---

Preparar e limpar o cache da conta antes de montar as consultas das telas privadas; a resolução inicial da autenticação não é uma troca de usuário anônimo já resolvido.

**Why:** limpar o cache depois que as consultas privadas já iniciaram cancelou requisições e deixou Reposição e Fornecedores presos em carregamento após acesso direto, embora os endpoints funcionassem e a navegação interna às vezes recuperasse a tela.

**How to apply:** enquanto a autenticação ou a preparação do cache não terminou, manter as rotas privadas na barreira de carregamento. Na mudança de identidade, desmontar seus consumidores e reinicializar também o estado local da nota antes de mostrar a nova conta. Não remover a limpeza entre contas apenas para eliminar cancelamentos.
