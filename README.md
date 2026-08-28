# Notifica App

Crie um app interno de gestão de disparos de WhatsApp, em português brasileiro, visual limpo e responsivo (uso principal no celular). O app conecta a um banco Supabase já existente (tabela rascunhos) e dispara mensagens via API uazapi.

Autenticação: tela de login com senha única (variável de ambiente), sem cadastro de usuários. Só libera o app com a senha correta.

Banco Supabase — tabela rascunhos com colunas: id, criado_em, titulo, mensagem, status (pendente/aprovado/enviado/descartado), tipo (noticia/enquete/instagram/linkedin), enviado_em, poll_opcoes. Conectar com a chave anon do Supabase.

API uazapi (guardar URL, token e ID do grupo como variáveis de ambiente):

Enviar texto: POST em {URL_UAZAPI}/send/text, headers token e Content-Type: application/json, corpo: { "number": "{ID_GRUPO}", "text": "mensagem" }

Enviar enquete: POST em {URL_UAZAPI}/send/menu, mesmos headers, corpo: { "number": "{ID_GRUPO}", "type": "poll", "text": "pergunta", "choices": ["opção 1","opção 2","opção 3"] }

Interface com 4 abas:

Aba 1 — Notícias: lista os registros com status='pendente' e tipo='noticia', do mais recente ao mais antigo. Cada card mostra o título e a mensagem num textarea editável grande. Dois botões: "Aprovar e Disparar" (envia o texto editado via /send/text, marca status='enviado' e enviado_em=agora) e "Descartar" (marca status='descartado'). O card some da lista após a ação.

Aba 2 — Enquete: duas formas de criar.
(a) Manual: campo de pergunta + campos para adicionar de 2 a 5 opções.
(b) Automática: um seletor lista as notícias já enviadas (status='enviado', tipo='noticia'); ao escolher uma e clicar em "Gerar enquete", chamar a API do Google Gemini para criar uma pergunta de enquete e 3 opções baseadas naquela notícia. Usar o modelo gemini-flash-lite-latest no endpoint https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={GEMINI_KEY}. Pedir no prompt que a IA responda em português brasileiro, apenas com a pergunta e as opções, em formato JSON: {"pergunta":"...","opcoes":["...","...","..."]}. Preencher os campos com o resultado para eu revisar e editar antes de disparar.
Botão "Disparar enquete": envia via /send/menu, e grava um registro na tabela com tipo='enquete', status='enviado', enviado_em=agora, titulo=a pergunta, poll_opcoes=as opções.

Aba 3 — Post: campos para colar o link do post (Instagram ou LinkedIn), escolher a origem (Instagram ou LinkedIn), e escrever um texto de chamada. Botão "Disparar": envia via /send/text uma mensagem com o texto de chamada seguido do link. Grava registro com tipo = a origem escolhida (instagram ou linkedin), status='enviado', enviado_em=agora, titulo=o texto de chamada.

Aba 4 — Calendário: visão de calendário mensal que lê todos os registros com status='enviado'. Em cada dia, mostra etiquetas coloridas indicando o que foi disparado naquele dia por tipo (notícia, enquete, instagram, linkedin), baseando-se na coluna enviado_em. Cores distintas por tipo. Ao clicar num dia, mostrar a lista do que foi disparado.

Guardar todas as credenciais (Supabase URL e chave, uazapi URL/token/grupo, Gemini key, senha do app) como variáveis de ambiente/secrets, nunca fixas no código visível.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://disparodevant.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/aaa7c9e9-3489-4d11-8b44-9692c80d341a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
