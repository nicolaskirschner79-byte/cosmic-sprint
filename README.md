# Cosmic Sprint: Missão LIGO 🚀

Jogo de corrida espacial da feira de ciências, com **login global** e **ranking em tempo real**, usando Supabase Auth + PostgreSQL + Realtime.

## Status

- ✅ Jogo original em `index.html`, preservando a jogabilidade.
- ✅ Interface de entrada, cadastro, saída e recuperação de senha.
- ✅ Ranking global com **um melhor recorde por conta** (até 100 resultados consultados, 50 exibidos).
- ✅ WebSocket via Supabase Realtime e atualização de contingência a cada 15 segundos.
- ✅ SQL para tabelas, validação de sessões, acesso restrito e atualizações em tempo real.
- ⏳ **Pendente de ativação**: criar um projeto Supabase separado, aplicar o SQL e inserir a URL e chave publicável em `config.js`.

## Estrutura

- `index.html`: jogo Three.js e interface de autenticação/ranking.
- `auth.js`: Supabase Auth, sincronização de recordes e atualização em tempo real.
- `config.js`: configurações públicas do projeto (atualmente com valores de exemplo).
- `supabase/schema.sql`: tabelas, políticas de acesso, RPCs e publicação Realtime.

## Ativar o backend

1. Crie um **novo** projeto Supabase, preferencialmente na região São Paulo (`sa-east-1`).
2. No **SQL Editor**, execute todo o conteúdo de `supabase/schema.sql`.
3. No menu **Project Settings → API Keys**, use a chave **publishable** (`sb_publishable_...`), nunca uma secret key.
4. Atualize `config.js`:

```js
window.COSMIC_SUPABASE = {
  url: "https://SEU-PROJECT-REF.supabase.co",
  publishableKey: "sb_publishable_SUA_CHAVE_PUBLICA"
};
```

5. Em **Authentication → Providers**, confira a opção de login por e-mail/senha. A confirmação de e-mail pode estar ativada.
6. Em **Authentication → URL Configuration**, defina a URL pública do site e permita o retorno à mesma página para recuperar senha.
7. Publique os arquivos como um site estático (GitHub Pages, Vercel ou semelhante). Para autenticação/redefinição, use HTTPS no domínio publicado.

## Funcionamento

1. O jogador entra em sua conta ou realiza cadastro, sem expor seu e-mail no ranking.
2. Ao iniciar, `start_run()` emite um identificador de sessão exclusivo no servidor.
3. Ao terminar, `finish_run()` verifica a identidade, o tempo decorrido e limites plausíveis do resultado, encerra a sessão e atualiza o recorde **se for melhor**.
4. As conexões Realtime recebem notificações de atualizações no ranking; o frontend atualiza também a cada 15 segundos como fallback.
5. A conta pode ser usada em qualquer dispositivo. A senha é gerenciada pelo Supabase Auth, não pelo HTML nem pelo repositório.

## Segurança e limites

- A tabela `leaderboard` só oferece leitura a usuários autenticados e está protegida por **RLS**.
- A tabela de sessões não oferece acesso direto a visitantes; somente funções verificadas podem abri-las ou encerrá-las.
- Credenciais de usuários e e-mails não são mostrados na lista do ranking.
- A checagem de pontuação **dificulta adulterações simples**. Como o jogo roda no navegador, **não é um anticheat completo**: partidas de alto risco competitivo exigiriam validação ou simulação do jogo no servidor.
- Antes de compartilhar com visitantes da feira, configure o domínio do site, o envio de e-mails do Supabase e teste uma partida com duas contas diferentes em dispositivos separados.
