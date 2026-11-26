<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/confere-logo-dark.png" />
    <img src="docs/assets/confere-logo.png" alt="CoNFere" width="420" />
  </picture>

  <p><strong>Conferência de notas fiscais para pequenos comerciantes.</strong><br />
  Compare pedido, nota fiscal e mercadoria recebida e veja quanto foi cobrado a mais.</p>

  <p>
    <a href="https://confere-notas-fiscais.replit.app/">Acessar o CoNFere</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/PostgreSQL-Drizzle-336791?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  </p>
</div>

## Sobre o projeto

Pequenos comerciantes recebem mercadorias com preços diferentes do combinado, quantidades menores que as cobradas ou itens que não pediram. A conferência manual entre pedidos feitos pelo WhatsApp, notas fiscais e produtos recebidos toma tempo e deixa erros passarem despercebidos, reduzindo a margem do negócio.

**O CoNFere facilita essa comparação e mostra o valor das divergências para apoiar a cobrança ao fornecedor. Tudo em uma plataforma web, sem exigir certificado digital ou ERP.**

## Como funciona

1. **Pedido.** O comerciante cola o pedido feito pelo WhatsApp ou cadastra os itens e preços combinados.
2. **Nota fiscal.** Importa o XML da NF-e do fornecedor.
3. **Conferência.** Relaciona os produtos da nota aos do pedido e informa as quantidades recebidas.
4. **Divergências.** O CoNFere compara os dados e identifica:
   - diferenças de preço em relação ao combinado;
   - faltas, quando o item foi cobrado e não recebido;
   - itens não solicitados;
   - o valor total cobrado a mais.
5. **Cobrança.** A ferramenta gera uma mensagem com as divergências para compartilhar com o fornecedor e permite salvar a conferência no histórico.

## Funcionalidades

| Recurso | Descrição |
| --- | --- |
| Pedido por texto ou manual | Extração dos itens e preços a partir do texto colado do WhatsApp, ou cadastro manual. |
| Importação de XML da NF-e | Leitura de itens, quantidades e valores da nota, sem certificado digital. |
| Sugestão de correspondência | Sugere qual item da nota corresponde a cada item do pedido, com confirmação do usuário. |
| Cálculo exato | Valores tratados em centavos com aritmética inteira (`BigInt`), sem erros de arredondamento. |
| Mensagem de cobrança | Texto com as divergências, pronto para enviar ao fornecedor. |
| Histórico de conferências | Cada conferência pode ser salva e consultada depois. |
| Painéis semanal e mensal | Visão consolidada das conferências realizadas. |
| Reposição de estoque | Geração de pedidos de reposição a partir do histórico, com cadastro de contatos de fornecedores. |
| Dados da empresa | Cadastro de dados e logotipo da empresa. |
| Dados de demonstração | Carga e remoção de dados de exemplo. |

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Front-end | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Wouter, Framer Motion, Recharts |
| Back-end | Node.js 24, Express 5, fast-xml-parser |
| Banco de dados | PostgreSQL, Drizzle ORM |
| Contrato de API | OpenAPI, Zod, Orval |
| Inteligência artificial | OpenAI (extração de itens, sugestão de correspondência e mensagem de cobrança) |
| Autenticação | Replit Auth (OIDC) |
| Monorepo | pnpm workspaces |
| Hospedagem | Replit |

## Como executar localmente

### Pré-requisitos

- Node.js 24
- pnpm (o projeto bloqueia `npm` e `yarn`)
- PostgreSQL 16

### Instalação

```bash
git clone https://github.com/nicolasletti/Confere-Notas-Fiscais.git
cd Confere-Notas-Fiscais
pnpm install
```

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | Sim | String de conexão do PostgreSQL |
| `PORT` | Sim | Porta do servidor (API e front-end) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Recursos de IA | Chave da API da OpenAI |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Recursos de IA | URL base da API da OpenAI |
| `ISSUER_URL` | Login | Emissor OIDC da autenticação |
| `REPL_ID` | Login | Identificador do app no Replit |
| `PRIVATE_OBJECT_DIR` | Logotipo da empresa | Diretório de armazenamento de arquivos |
| `LOG_LEVEL` | Não | Nível de log da API |

As integrações de IA, autenticação e armazenamento já vêm configuradas quando o projeto é executado no Replit.

### Execução

```bash
# Cria as tabelas no banco (somente desenvolvimento)
pnpm --filter @workspace/db run push

# API (porta 5000)
PORT=5000 pnpm --filter @workspace/api-server run dev

# Front-end, em outro terminal
PORT=5173 pnpm --filter @workspace/confere run dev
```

No PowerShell, defina a porta com `$env:PORT = "5000"` antes de cada comando.

### Outros comandos

```bash
pnpm run typecheck                              # checagem de tipos em todos os pacotes
pnpm run build                                  # typecheck e build de todos os pacotes
pnpm --filter @workspace/api-spec run codegen   # regenera hooks e schemas a partir do OpenAPI
```

## Estrutura do repositório

```text
.
├── artifacts/
│   ├── confere/              # Front-end React
│   ├── api-server/           # API Express
│   └── mockup-sandbox/       # Ambiente de protótipos de interface
├── lib/
│   ├── reconciliation/       # Regras de comparação entre pedido e nota
│   ├── db/                   # Schema Drizzle e conexão com o PostgreSQL
│   ├── api-spec/             # Contrato OpenAPI e configuração do Orval
│   ├── api-zod/              # Schemas Zod gerados
│   ├── api-client-react/     # Hooks React Query gerados
│   ├── integrations-openai-ai-server/
│   └── replit-auth-web/
├── docs/assets/              # Imagens usadas na documentação
└── scripts/                  # Scripts de manutenção
```

## Contribuindo

1. Faça um fork do repositório.
2. Crie uma branch: `git checkout -b minha-melhoria`.
3. Execute `pnpm run typecheck` antes de abrir o pull request.
4. Abra um pull request descrevendo a mudança.

## Autor

Nicolas Letti, [@nicolasletti](https://github.com/nicolasletti)
