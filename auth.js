/* Cosmic Sprint • login global, recordes e ranking em tempo real.
   Apenas a chave PUBLICÁVEL é usada no navegador. Nunca inclua service_role aqui. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const config = window.COSMIC_SUPABASE || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url || '')
    && !!config.publishableKey && !String(config.publishableKey).includes('COLOQUE');
  const db = configured && window.supabase
    ? window.supabase.createClient(config.url, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
  let user = null;
  let authMode = 'login';
  let entries = [];
  let channel = null;
  let loading = false;
  let refreshing = false;
  let runId = null;
  let pending = null;
  let sending = false;
  const safeNick = value => (value || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 12) || 'Astronauta';
  const own = () => user && entries.find(e => e.user_id === user.id);
  const status = msg => { el('accountInfo').textContent = msg; };
  const authNotice = msg => { el('authMessage').textContent = msg; };

  function renderAccount() {
    el('baccount').textContent = user ? 'MINHA CONTA' : 'ENTRAR / CADASTRAR';
    el('blogout').hidden = !user;
    status(!db ? 'Ranking ainda não configurado pelo administrador.' :
      user ? 'Conectado: ' + (user.email || 'Jogador') :
      'Faça login para salvar seus recordes no ranking mundial.');
    el('bst').textContent = user ? 'INICIAR MISSÃO' : 'ENTRAR PARA JOGAR';
    el('mb').textContent = best;
  }

  function renderRanking() {
    const box = el('rk');
    box.replaceChildren();
    if (!db) box.textContent = 'Aguardando conexão do jogo com o Supabase.';
    else if (!user) box.textContent = 'Entre na sua conta para consultar o ranking.';
    else if (!entries.length) box.textContent = 'Nenhum recorde global registrado até agora.';
    entries.slice(0, 50).forEach((e, i) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'rw' + (i === 0 ? ' b1' : '');
      if (user && e.user_id === user.id) rowEl.style.outline = '1px solid #00e5ff';
      [i + 1, e.nickname, e.best_score, Number(e.best_time).toFixed(1) + 's', e.items, 'N' + e.level]
        .forEach(v => { const s = document.createElement('span'); s.textContent = String(v); rowEl.append(s); });
      box.append(rowEl);
    });
    el('ac').textContent = user
      ? 'Ranking global: melhor resultado por jogador • sincronização automática'
      : 'Faça login para participar.';
  }

  async function refreshRanking() {
    if (!db || !user || refreshing) return;
    refreshing = true;
    try {
      const { data, error } = await db.from('leaderboard')
        .select('user_id,nickname,best_score,best_time,items,level,updated_at')
        .order('best_score', { ascending: false })
        .order('best_time', { ascending: false })
        .limit(100);
      if (error) throw error;
      entries = data || [];
      best = Number(own()?.best_score || 0);
      renderRanking();
      renderAccount();
    } catch (err) {
      if (el('rkp').classList.contains('on')) el('ac').textContent = 'Ranking indisponível: ' + err.message;
    } finally {
      refreshing = false;
    }
  }

  function subscribeRanking() {
    if (!db || !user || channel) return;
    channel = db.channel('cosmic-sprint-global-records')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, () => { void refreshRanking(); })
      .subscribe();
  }

  async function applySession(next) {
    const changed = (next?.id || null) !== (user?.id || null);
    user = next || null;
    if (changed) {
      if (channel) { const old = channel; channel = null; await db.removeChannel(old); }
      entries = [];
      best = 0;
      rank = [];
      if (changed && (state === 'PLAYING' || state === 'PAUSED')) toMenu();
      if (user) { subscribeRanking(); await refreshRanking(); }
    }
    renderAccount();
    renderRanking();
  }

  function setMode(mode) {
    authMode = mode;
    const reg = mode === 'register', change = mode === 'change';
    el('authTitle').textContent = change ? 'DEFINIR NOVA SENHA' : reg ? 'CRIAR CONTA' : 'ENTRAR NA MISSÃO';
    el('authEmail').hidden = change;
    el('authEmail').required = !change;
    el('authPassword').autocomplete = change || reg ? 'new-password' : 'current-password';
    el('authSubmit').textContent = change ? 'SALVAR SENHA' : reg ? 'CRIAR MINHA CONTA' : 'ENTRAR';
    el('authToggle').textContent = reg ? 'JÁ TENHO CONTA' : 'CRIAR CONTA';
    el('authToggle').hidden = change;
    el('authReset').hidden = change;
    authNotice('');
  }

  function openAuth() {
    if (!db) { toast('Supabase ainda não configurado.'); return; }
    setMode('login');
    show('auth');
  }
  async function submitAuth(ev) {
    ev.preventDefault();
    if (!db || loading) return;
    loading = true;
    el('authSubmit').disabled = true;
    authNotice('Conectando...');
    try {
      const password = el('authPassword').value;
      if (authMode === 'change') {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        authNotice('Senha atualizada. Você já pode jogar.');
        setTimeout(() => show('menu'), 700);
      } else {
        const email = el('authEmail').value.trim().toLowerCase();
        if (!email || password.length < 6) throw new Error('Informe e-mail e senha de pelo menos 6 caracteres.');
        const response = authMode === 'register'
          ? await db.auth.signUp({ email, password, options: { data: { nickname: safeNick(el('nk').value) } } })
          : await db.auth.signInWithPassword({ email, password });
        if (response.error) throw response.error;
        if (authMode === 'register' && !response.data.session) {
          authNotice('Cadastro solicitado. Verifique seu e-mail para confirmar a conta e depois entre.');
          setMode('login');
          authNotice('Confirme o cadastro pelo e-mail enviado. Depois faça login.');
        } else {
          await applySession(response.data.user);
          el('authPassword').value = '';
          show('menu');
          toast('Conta conectada ao ranking global!');
        }
      }
    } catch (err) { authNotice('Não foi possível concluir: ' + err.message); }
    finally { loading = false; el('authSubmit').disabled = false; }
  }

  async function resetPassword() {
    if (!db) return;
    const email = el('authEmail').value.trim();
    if (!email) { authNotice('Informe seu e-mail no campo acima.'); return; }
    const url = location.origin + location.pathname;
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: url });
    authNotice(error ? 'Falha ao solicitar recuperação: ' + error.message
      : 'Se a conta existir, você receberá um link para redefinir a senha.');
  }

  async function globalStart() {
    if (!db) { toast('Ranking global ainda não configurado.'); return; }
    if (!user) { openAuth(); return; }
    if (loading) return;
    loading = true;
    el('bst').disabled = true;
    el('g1').disabled = true;
    try {
      const nextNick = safeNick(el('nk').value);
      el('nk').value = nextNick;
      const { data, error } = await db.rpc('start_run', { p_nickname: nextNick });
      if (error) throw error;
      runId = data;
      pending = null;
      el('gretry').hidden = true;
      nick = nextNick;
      SV('cs_nick', nick);
      reset();
      state = 'PLAYING';
      show('');
      ui();
      ia();
      sfx.start();
    } catch (err) {
      toast('Não foi possível iniciar: ' + err.message);
    } finally {
      loading = false;
      el('bst').disabled = false;
      el('g1').disabled = false;
    }
  }

  async function uploadScore() {
    if (!db || !pending || sending) return;
    sending = true;
    el('gretry').hidden = true;
    el('gp').textContent = 'Salvando no ranking global...';
    try {
      const result = pending;
      const { error } = await db.rpc('finish_run', {
        p_session_id: result.session,
        p_score: result.score,
        p_duration: result.duration,
        p_items: result.items,
        p_level: result.level
      });
      if (error) throw error;
      pending = null;
      runId = null;
      await refreshRanking();
      const position = entries.findIndex(x => x.user_id === user?.id);
      el('gp').textContent = position >= 0
        ? '🏆 Seu melhor resultado está no ranking global: #' + (position + 1)
        : 'Resultado salvo! Você ainda não está entre os 100 primeiros.';
    } catch (err) {
      el('gp').textContent = 'Não foi possível salvar: ' + err.message;
      el('gretry').hidden = false;
    } finally { sending = false; }
  }

  function globalFinish() {
    if (saved) return;
    saved = true;
    const points = Math.floor(score);
    const previous = best;
    const localRecord = points > previous && previous > 0;
    el('gs').textContent = points;
    el('gr').textContent = localRecord ? '🏆 Você superou seu recorde!' : 'Seu recorde global: ' + previous;
    el('gt').textContent = 'Tempo: ' + t.toFixed(1) + 's · Símbolos: ' + items + ' · Nível: ' + (maxLv + 1);
    el('gf').textContent = FACTS[Math.floor(R() * FACTS.length)];
    if (!runId) { el('gp').textContent = 'Sessão online indisponível. Pontuação não salva.'; return; }
    pending = { session: runId, score: points, duration: +t.toFixed(1), items, level: maxLv + 1 };
    void uploadScore();
  }

  start = globalStart;
  finish = globalFinish;
  rr = renderRanking;
  el('bst').onclick = globalStart;
  el('g1').onclick = globalStart;
  el('brk').onclick = () => { renderRanking(); show('rkp'); void refreshRanking(); };
  el('rc').onclick = () => { void refreshRanking(); };
  el('gretry').onclick = () => { void uploadScore(); };
  el('baccount').onclick = openAuth;
  el('authBack').onclick = () => show('menu');
  el('authToggle').onclick = () => setMode(authMode === 'register' ? 'login' : 'register');
  el('authReset').onclick = () => { void resetPassword(); };
  el('authForm').addEventListener('submit', submitAuth);
  el('blogout').onclick = async () => {
    if (state === 'PLAYING') pause();
    if (db) {
      const { error } = await db.auth.signOut();
      if (error) toast('Não foi possível sair: ' + error.message);
      else { await applySession(null); toMenu(); }
    }
  };
  best = 0;
  renderAccount();
  renderRanking();
  if (db) {
    db.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') queueMicrotask(() => { setMode('change'); show('auth'); });
      queueMicrotask(() => { void applySession(session?.user ?? null); });
    });
    void db.auth.getUser().then(({ data, error }) => {
      if (error) { renderAccount(); return; }
      void applySession(data.user ?? null);
    });
    setInterval(() => { if (user && !document.hidden) void refreshRanking(); }, 15000);
  }
})();
