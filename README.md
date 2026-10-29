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

## Painel administrativo em HTML único

O arquivo [`dashboard.html`](dashboard.html) contém **HTML, CSS e JavaScript no mesmo arquivo**. Não há formulário de cadastro e nenhuma senha fica embutida no repositório. Utiliza a URL e a chave **publicável** do Supabase; requer internet para carregar a biblioteca `supabase-js`.

**Funcionalidades:** login de administrador, métricas globais, gráfico diário (14 dias), top 5, busca e ordenação de jogadores, exportação CSV, exclusão de um recorde, limpeza completa com confirmação digitada, últimas 300 sessões, auditoria das exclusões e sincronização via Supabase Realtime com consulta automática de contingência a cada 30 segundos.

**As políticas, funções e gatilhos administrativos já estão instalados no banco principal.** O banco autoriza **somente o e-mail administrativo configurado**, se a conta de autenticação possuir e-mail confirmado.

### Primeiro acesso do administrador

**ATENÇÃO: a conta administrativa ainda não foi criada no Supabase Auth.** O HTML não possui fluxo de cadastro por escolha de projeto; portanto, o administrador precisa ser provisionado fora dele:

1. Abra [Supabase Authentication → Users](https://supabase.com/dashboard/project/gvkwjlokvwezuooefrqk/auth/users).
2. Clique em **Add user** (ou **Invite user**) e crie a conta correspondente ao e-mail de administrador previamente autorizado. Ao usar convite, o administrador define a própria senha por e-mail.
3. Confirme/verifique o e-mail no Supabase Auth e defina uma senha forte e exclusiva. Não inclua senhas em HTML, SQL versionado, repositório GitHub ou histórico de commits.
4. Hospede `dashboard.html` em HTTPS (por exemplo, na mesma origem do jogo) e faça login com essa conta. A autorização para excluir ranking é verificada novamente pelo banco em cada operação.

**Segurança:** excluir um recorde ou limpar o ranking só remove linhas de `leaderboard`; o histórico `game_sessions` fica intacto. As ações ficam registradas em tabela privada. Antes de utilizar em produção, teste login e exclusões com uma conta administrativa real. O painel tem chave pública, **nunca** chave `service_role`.

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
