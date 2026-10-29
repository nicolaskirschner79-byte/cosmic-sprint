# Cosmic Sprint: Missão LIGO 🚀

Jogo de corrida espacial da feira de ciências, com **login global** e **ranking em tempo real**, usando Supabase Auth + PostgreSQL + Realtime.

## Jogar sem cadastro

**O jogador só precisa digitar Nome e Sobrenome e clicar em INICIAR MISSÃO.** Não é necessário e-mail, login nem senha.

- Identidade aleatória criada pelo banco e guardada somente no navegador, com token aleatório longo e hash armazenado em tabela privada.
- Recorde salvo no PostgreSQL e exibido no ranking global automaticamente por Supabase Realtime (fallback periódico).
- Mesmo navegador mantém o histórico e recorde após recarregar; trocar o nome pode atualizar o nome exibido no ranking.
- **Limitação importante:** o mesmo nome em navegadores ou dispositivos diferentes **não prova que seja a mesma pessoa**. Cada navegador inicia um registro próprio. Limpar dados locais faz perder o acesso à identificação anterior; nomes repetidos são permitidos.
- O ranking recebe apenas nome, sobrenome, pontuação e métricas; nenhuma senha ou e-mail dos jogadores.
- Partidas têm validações de tempo e limites plausíveis no banco, mas o jogo no navegador não possui verificação antitrapaça completa.

Arquivos:
- `index.html`: jogo e campos Nome/Sobrenome;
- `guest.js`: criação de identificação local, partida, envio do resultado e ranking ao vivo;
- `config.js`: URL e chave **publicável** Supabase do projeto `gvkwjlokvwezuooefrqk`;
- `supabase/schema.sql`: estrutura original (com login) para instalação de base histórica;
- `supabase/guest-players.sql`: migração posterior para o jogo **sem conta**, já aplicada ao projeto;
- `dashboard.html`: painel **administrativo** separado, mantém login obrigatório e permissões exclusivas.

**Projeto ativo:** https://supabase.com/dashboard/project/gvkwjlokvwezuooefrqk

O banco e as permissões para jogadores sem conta foram configurados e testados. Já foi testada uma sessão temporária no papel `anon`, incluindo criação do jogador, início, finalização e leitura do ranking, com reversão dos dados de teste.

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

## Publicação

1. Hospede `index.html`, `guest.js` e `config.js` juntos via HTTPS. O jogo depende de Three.js, Supabase e fontes externas.
2. Publique `dashboard.html` no mesmo host e defina as URLs em Authentication → URL Configuration para recuperação de senha do **administrador**.
3. Teste uma partida no navegador e outra em um segundo dispositivo para verificar o ranking ao vivo.
4. **Não execute novamente** as migrações no banco ativo sem revisão; elas já foram aplicadas.

## Funcionamento

1. A pessoa informa nome e sobrenome, sem criar conta.
2. O banco cria um registro aleatório para o navegador, com token de acesso armazenado localmente; o servidor só armazena o hash.
3. `cosmic_guest_start_run()` abre uma sessão no servidor.
4. `cosmic_guest_finish_run()` valida a sessão e grava a melhor pontuação da identificação.
5. O ranking consulta os resultados públicos e acompanha alterações via WebSocket Supabase Realtime.

## Segurança e limites

- O ranking permite apenas leitura pública; dados privados dos jogadores não são expostos.
- RPCs validadas com token permitem registrar partidas. Usuários sem conta não conseguem inserir pontuações diretamente nas tabelas.
- O login com e-mail permanece **somente** na dashboard administrativa, protegida por lista de autorização no banco.
- Jogar somente com nome/sobrenome é intencionalmente simples, mas não assegura identidade única nem impede múltiplos registros por pessoa.
- Sem autenticação forte para jogadores não há garantia absoluta contra manipulação de pontuações. Prefira monitoramento e revisão manual para a feira.
