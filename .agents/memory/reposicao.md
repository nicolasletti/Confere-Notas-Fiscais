---
name: Critérios de reposição
description: Regras solicitadas e decisões sobre histórico, identidade e consumo estimado
---

A reposição é uma estimativa pelo histórico de compras, nunca um controle de estoque real ou registro de vendas. Não usar IA para calcular ou prever.

**Why:** o usuário determinou fórmulas explícitas e restringiu IA a textos e casamento de itens.

Identificar um produto por cProd + CNPJ do fornecedor; na ausência desses campos, usar a descrição normalizada. Manter unidades distintas separadas, sem supor conversões. XMLs originais das notas antigas devem permitir recuperar identificadores quando não existiam no resumo extraído.

**Why:** códigos de produto são específicos do fornecedor; misturar caixas e unidades invalida médias e estoque estimado.

Uma nota diferente é uma compra; linhas repetidas do mesmo produto na mesma nota são somadas antes das médias. Usar datas de emissão escritas nos XMLs, e “hoje” em America/Sao_Paulo. Compras exclusivamente no mesmo dia não permitem dividir por um intervalo positivo e ficam de fora com aviso. Notas futuras não representam compras já feitas.

**Why:** o usuário pediu produtos comprados ao menos duas vezes e intervalo médio em dias, preservando consistência com o Painel.

O intervalo médio é a média dos intervalos consecutivos; a quantidade média inclui todas as compras do grupo. Consumo diário = quantidade média / intervalo; estoque atual = última quantidade − consumo diário × dias desde a última compra, mínimo zero. Próxima compra = última data + intervalo médio; frações de dia são arredondadas para cima apenas na data apresentada. Comprar agora se estiver vencido ou vencer hoje, ou o estoque estimado for zero; próximo limite amarelo é três dias.

Comprado no mês considera notas emitidas no mês corrente até hoje. Consumido estimado no mês = consumo diário × dias transcorridos desde o início do mês ou a primeira compra registrada, o que for posterior; não é previsão para o mês inteiro.

**Why:** a etapa pediu comparação mensal sem definir projeção futura; apresentar o período já transcorrido evita comparar compras realizadas com consumo ainda não ocorrido.

**How to apply:** mostrar limitações na tela e preservar as fórmulas sem arredondamentos intermediários. Não compensar por vendas, perdas, estoque inicial ou quantidades recebidas sem novo pedido explícito.
