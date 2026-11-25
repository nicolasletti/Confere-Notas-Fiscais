<div align="center">
  <img src="https://raw.githubusercontent.com/nicolasletti/Confere-Notas-Fiscais/main/artifacts/confere/public/favicon.svg" alt="Logo do CoNFere" width="88" />
  <h1>CoNFere</h1>
  <p><strong>Confira a nota fiscal do fornecedor antes de guardar a mercadoria e saiba exatamente quanto foi cobrado a mais.</strong></p>

  <p>
    <a href="https://confere-notas-fiscais.replit.app/"><strong>🌐 Acessar o CoNFere</strong></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/PostgreSQL-Drizzle-336791?logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Feito%20no-Replit-F26207?logo=replit&logoColor=white" alt="Replit" />
  </p>
</div>

---

## Sumário

- [O problema](#-o-problema)
- [A solução](#-a-solução)
- [Como funciona](#-como-funciona)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Como executar localmente](#-como-executar-localmente)
- [Estrutura do repositório](#-estrutura-do-repositório)
- [Contexto do projeto](#-contexto-do-projeto)
- [Contribuindo](#-contribuindo)

## 🎯 O problema

Pequenos comerciantes recebem mercadorias com **preços diferentes do combinado**, **quantidades menores que as cobradas** ou **itens que nem pediram**.

A conferência manual entre o pedido feito pelo WhatsApp, a nota fiscal e os produtos que realmente chegaram toma tempo, e os erros passam despercebidos. Cada divergência não percebida reduz a margem do negócio.

## 💡 A solução

O **CoNFere** automatiza essa comparação e mostra **o valor em reais das divergências**, para que o comerciante tenha números concretos na hora de cobrar o fornecedor.

Tudo roda em uma plataforma web, **sem exigir certificado digital nem ERP**.

## 🔄 Como funciona

1. **Informe o pedido.** Cole o pedido feito pelo WhatsApp ou cadastre manualmente os itens e preços combinados.
2. **Importe a nota fiscal.** Envie o XML da NF-e do fornecedor.
3. **Relacione os itens.** Ligue os produtos da nota aos do pedido e informe as quantidades que realmente chegaram.
4. **Veja as divergências.** O CoNFere compara tudo e aponta:
   - diferenças de **preço** em relação ao combinado;
   - **faltas** (cobrado, mas não recebido);
   - **itens não solicitados**;
   - o **valor total cobrado a mais**.
5. **Cobre o fornecedor.** A ferramenta gera uma mensagem com as divergências, pronta para compartilhar, e você pode salvar a conferência no histórico.

## ✨ Funcionalidades

| Recurso | Descrição |
| --- | --- |
| **Pedido por texto ou manual** | Cole a conversa do WhatsApp e a IA extrai itens e preços, ou cadastre à mão. |
| **Importação de XML da NF-e** | Leitura dos itens, quantidades e valores da nota, sem certificado digital. |
| **Sugestão de correspondência** | A IA sugere qual item da nota corresponde a qual item do pedido; você confirma. |
| **Conferência com cálculo exato** | Diferenças de preço, faltas e itens não solicitados, com valores em centavos (aritmética com `BigInt`, sem erro de arredondamento). |
| **Mensagem de cobrança** | Texto pronto com as divergências para enviar ao fornecedor. |
| **Histórico de conferências** | Salve cada conferência e consulte depois. |
| **Painéis semanal e mensal** | Visão consolidada do que foi conferido e recuperado. |
| **Reposição de estoque** | Sugestão de pedidos de reposição a partir do histórico, com contatos de fornecedores. |
| **Minha empresa** | Dados e logotipo da empresa. |
| **Dados de demonstração** | Carregue e remova dados de exemplo para conhecer a ferramenta. |

> 📸 **Screenshots:** adicione aqui imagens das telas principais (conferência, mensagem de cobrança e painel) em `docs/screenshots/`.

## 🧰 Tecnologias

- **Front-end:** React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Wouter, Framer Motion, Recharts
- **Back-end:** Node.js 24, Express 5, `fast-xml-parser` para leitura da NF-e
- **Banco de dados:** PostgreSQL com Drizzle ORM
- **Validação e contrato de API:** Zod e OpenAPI, com geração de hooks e schemas via Orval
- **IA:** OpenAI (extração de itens do pedido, sugestão de correspondência e mensagem de cobrança)
- **Autenticação:** login via Replit Auth (OIDC)
- **Monorepo:** pnpm workspaces
- **Desenvolvimento e hospedagem:** [Replit](https://replit.com/)

## 🚀 Como executar localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) 24
- [pnpm](https://pnpm.io/) (o projeto bloqueia `npm` e `yarn`)
- Um banco PostgreSQL 16

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/nicolasletti/Confere-Notas-Fiscais.git
cd Confere-Notas-Fiscais

# 2. Instale as dependências
pnpm install

# 3. Configure as variáveis de ambiente (veja a tabela abaixo)

# 4. Crie as tabelas no banco (apenas desenvolvimento)
pnpm --filter @workspace/db run push

# 5. Inicie a API (porta 5000)
PORT=5000 pnpm --filter @workspace/api-server run dev

# 6. Em outro terminal, inicie o front-end
PORT=5173 pnpm --filter @workspace/confere run dev
```

> No Windows (PowerShell), defina a porta com `$env:PORT = "5000"` antes do comando.

### Variáveis de ambiente

| Variável | Obrigatória | Para que serve |
| --- | --- | --- |
| `DATABASE_URL` | Sim | String de conexão do PostgreSQL |
| `PORT` | Sim | Porta do servidor (API e front-end) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Para recursos de IA | Chave da OpenAI |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Para recursos de IA | URL base da API da OpenAI |
| `ISSUER_URL` | Para login | Emissor OIDC da autenticação |
| `REPL_ID` | Para login | Identificador do app no Replit |
| `PRIVATE_OBJECT_DIR` | Para logotipo da empresa | Diretório de armazenamento de arquivos |
| `LOG_LEVEL` | Não | Nível de log da API |

> Rodar no próprio Replit é o caminho mais simples: as integrações de IA, autenticação e armazenamento já vêm configuradas.

### Outros comandos úteis

```bash
pnpm run typecheck                                # checagem de tipos em todos os pacotes
pnpm run build                                    # typecheck + build de tudo
pnpm --filter @workspace/api-spec run codegen     # regenera hooks e schemas a partir do OpenAPI
```

## 🗂️ Estrutura do repositório

```text
.
├── artifacts/
│   ├── confere/            # Front-end React (landing, pedido, nota fiscal, conferência, painel, reposição)
│   ├── api-server/         # API Express (conferências, dashboards, IA, autenticação)
│   └── mockup-sandbox/     # Ambiente de protótipos de interface
├── lib/
│   ├── reconciliation/     # Regras de comparação pedido × nota (cálculo exato em centavos)
│   ├── db/                 # Schema Drizzle e conexão com o PostgreSQL
│   ├── api-spec/           # Contrato OpenAPI e configuração do Orval
│   ├── api-zod/            # Schemas Zod gerados
│   ├── api-client-react/   # Hooks React Query gerados
│   ├── integrations-openai-ai-server/
│   └── replit-auth-web/
└── scripts/                # Scripts de manutenção
```

## 🏆 Contexto do projeto

O CoNFere nasceu no **Desafio Replit PUCPR 2026 – "Da ideia ao software"**, uma imersão de três dias (17, 18 e 19 de novembro) promovida pela Área de Empreendedorismo da PUCPR em parceria com o Curso de Administração e a Replit. O formato é de hackathon *vibe coding*: o participante chega com uma ideia de negócio e, em três dias, a transforma em uma aplicação web funcional, apresentada em um pitch no último dia.

## 🤝 Contribuindo

Sugestões e correções são bem-vindas:

1. Faça um fork do repositório.
2. Crie uma branch: `git checkout -b minha-melhoria`.
3. Rode `pnpm run typecheck` antes de abrir o pull request.
4. Abra um pull request descrevendo a mudança.

## 👤 Autor

**Nicolas Letti**, [@nicolasletti](https://github.com/nicolasletti)

---

<div align="center">
  <sub>Feito para quem compra de fornecedor todo dia e não quer pagar nem um centavo a mais.</sub>
</div>
