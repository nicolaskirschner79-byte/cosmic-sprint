# Cosmic Sprint: Missão LIGO 🚀

Jogo de corrida espacial da feira de ciências, com **login global** e **ranking em tempo real**, usando Supabase Auth + PostgreSQL + Realtime.

## Status

- ✅ Jogo original em `index.html`, preservando a jogabilidade.
- ✅ Interface de entrada, cadastro, saída e recuperação de senha.
- ✅ Ranking global com **um melhor recorde por conta** (até 100 resultados consultados, 50 exibidos).
- ✅ WebSocket via Supabase Realtime e atualização de contingência a cada 15 segundos.
- ✅ SQL para tabelas, validação de sessões, acesso restrito e atualizações em tempo real.
- ✅ **Supabase ativo**: projeto próprio criado em São Paulo; migrações SQL e publicação Realtime aplicadas.
- ✅ `config.js` conectado à URL e chave **publicável** do projeto.
- ⚠️ Ainda é necessário testar ponta a ponta cadastro, login e duas partidas em navegadores diferentes, além de publicar o site e ajustar URLs de recuperação de senha.

## Estrutura

- `index.html`: jogo Three.js e interface de autenticação/ranking.
- `auth.js`: Supabase Auth, sincronização de recordes e atualização em tempo real.
- `config.js`: URL e chave publicável configuradas para `gvkwjlokvwezuooefrqk`.
- `supabase/schema.sql`: tabelas, políticas de acesso, RPCs e publicação Realtime.

## Supabase conectado

- Projeto: **Cosmic Sprint - Ranking Global**
- ID: `gvkwjlokvwezuooefrqk`
- Região: `sa-east-1` (São Paulo)
- Painel: https://supabase.com/dashboard/project/gvkwjlokvwezuooefrqk
- URL do banco: `https://gvkwjlokvwezuooefrqk.supabase.co`
- Migrações: tabelas, RLS, RPCs `start_run`/`finish_run` e publicação Realtime aplicadas.
- Confirmação SQL: 2 tabelas, 2 com RLS, 2 funções e 1 tabela publicada no Realtime.

### Antes de disponibilizar aos jogadores

1. Publique o site `index.html` com `auth.js` e `config.js` no mesmo diretório, via HTTPS, e configure **Authentication → URL Configuration** com o endereço público definitivo e o redirecionamento de recuperação de senha.
2. Confirme o provedor de e-mail em **Authentication → Providers** e configure um serviço de envio de e-mails confiável, se o público ultrapassar os limites de e-mail padrão do Supabase.
3. Teste cadastro com confirmação de e-mail, login, uma partida e atualização do ranking com duas contas em navegadores separados.
4. O SQL versionado em `supabase/schema.sql` é um registro para reconstruir a estrutura em outro ambiente; **não o execute de novo** no projeto ativo sem avaliar as alterações.

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
