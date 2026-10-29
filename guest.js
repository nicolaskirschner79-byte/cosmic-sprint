/* Cosmic Sprint • entrada apenas com nome e sobrenome.
   A identificação aleatória fica somente neste navegador; não há conta nem senha. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const cfg = window.COSMIC_SUPABASE || {};
  const client = window.supabase && cfg.url && cfg.publishableKey
    ? window.supabase.createClient(cfg.url, cfg.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      }) : null;

  const PROFILE_KEY = 'cosmic_player_v1';
  const PENDING_KEY = 'cosmic_pending_run_v1';
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const erase = k => { try { localStorage.removeItem(k); } catch {} };
  const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
  const validName = v => v.length >= 2 && v.length <= 32 &&
    /\p{L}/u.test(v) && !/[\p{N}\p{Cc}]/u.test(v);
  const msg = text => { el('playerStatus').textContent = text; };
  const label = 'Cosmic Sprint';

  let player = read(PROFILE_KEY);
  if (!player || !/^[0-9a-f-]{36}$/i.test(player.id || '') || !/^[a-f0-9]{64}$/i.test(player.token || '')) player = null;
  let results = [];
  let channel = null;
  let loading = false;
  let saving = false;
  let refreshBusy = false;
  let refreshAgain = false;
  let runId = null;
  let pending = read(PENDING_KEY);

  if (player) {
    el('fn').value = player.first_name || '';
    el('ln').value = player.last_name || '';
  }

  function drawRanking() {
    const box = el('rk');
    box.replaceChildren();
    if (!client) box.textContent = 'Conexão indisponível. Verifique sua internet.';
    else if (!results.length) box.textContent = 'Nenhuma partida registrada. Seja o primeiro!';
    results.slice(0, 100).forEach((item, index) => {
      const line = document.createElement('div');
      line.className = 'rw' + (index === 0 ? ' b1' : '');
      if (player && item.user_id === player.id) line.style.outline = '1px solid #00e5ff';
      [index + 1, item.nickname, item.best_score, Number(item.best_time).toFixed(1) + 's', item.items, 'N' + item.level]
        .forEach(value => {
          const span = document.createElement('span');
          span.textContent = String(value);
          line.appendChild(span);
        });
      box.appendChild(line);
    });
    el('ac').textContent = 'Ranking global • melhor recorde de cada jogador • atualização automática';
  }

  async function loadRanking() {
    if (!client) return;
    if (refreshBusy) { refreshAgain = true; return; }
    refreshBusy = true;
    try {
      const { data, error } = await client.from('leaderboard')
        .select('user_id,nickname,best_score,best_time,items,level')
        .order('best_score', { ascending: false })
        .order('best_time', { ascending: false })
        .limit(100);
      if (error) throw error;
      results = data || [];
      drawRanking();
      if (player) {
        const own = results.find(x => x.user_id === player.id);
        if (own) best = Number(own.best_score || 0);
        else {
          const { data: record, error: recordError } = await client.from('leaderboard')
            .select('best_score').eq('user_id', player.id).maybeSingle();
          if (recordError) throw recordError;
          best = Number(record?.best_score || 0);
        }
        el('mb').textContent = best;
      }
    } catch (error) {
      if (el('rkp').classList.contains('on')) el('ac').textContent = 'Não foi possível sincronizar: ' + error.message;
    } finally {
      refreshBusy = false;
      if (refreshAgain) { refreshAgain = false; void loadRanking(); }
    }
  }

  async function profile() {
    if (!player || !client) return;
    const { data, error } = await client.rpc('cosmic_guest_profile', {
      p_player_id: player.id, p_token: player.token
    });
    if (error) throw error;
    best = Number(data.best_score || 0);
    el('mb').textContent = best;
    return data;
  }

  async function ensurePlayer(firstName, lastName) {
    if (player) {
      const info = await profile();
      if (info.first_name !== firstName || info.last_name !== lastName) {
        const { error } = await client.rpc('cosmic_guest_update_name', {
          p_player_id: player.id, p_token: player.token,
          p_first_name: firstName, p_last_name: lastName
        });
        if (error) throw error;
        player.first_name = firstName;
        player.last_name = lastName;
        write(PROFILE_KEY, player);
      }
    } else {
      const { data, error } = await client.rpc('cosmic_guest_register', {
        p_first_name: firstName, p_last_name: lastName
      });
      if (error) throw error;
      player = {
        id: data.id,
        token: data.token,
        first_name: data.first_name,
        last_name: data.last_name
      };
      if (!write(PROFILE_KEY, player)) throw new Error('Ative o armazenamento local do navegador para preservar seu recorde.');
      best = 0;
      el('mb').textContent = 0;
    }
  }

  async function startGuest() {
    if (!client) { toast('Não foi possível conectar ao banco.'); return; }
    if (loading) return;
    const firstName = normalized(el('fn').value);
    const lastName = normalized(el('ln').value);
    if (!validName(firstName) || !validName(lastName)) {
      msg('Digite um nome e um sobrenome válidos (2 a 32 letras/caracteres cada).');
      el(!validName(firstName) ? 'fn' : 'ln').focus();
      return;
    }
    loading = true;
    el('bst').disabled = true;
    el('g1').disabled = true;
    msg('Preparando sua missão...');
    try {
      await ensurePlayer(firstName, lastName);
      const { data, error } = await client.rpc('cosmic_guest_start_run', {
        p_player_id: player.id, p_token: player.token
      });
      if (error) throw error;
      runId = data;
      nick = firstName + ' ' + lastName;
      SV('cs_nick', nick);
      document.activeElement?.blur();
      reset();
      state = 'PLAYING';
      show('');
      ui();
      ia();
      sfx.start();
      msg('Jogando como ' + nick + ' • recorde salvo neste navegador.');
      void loadRanking();
    } catch (error) {
      msg('Erro ao iniciar: ' + error.message);
      toast('Não foi possível iniciar a missão.');
    } finally {
      loading = false;
      el('bst').disabled = false;
      el('g1').disabled = false;
    }
  }

  async function saveResult() {
    if (!client || !pending || !player || saving) return;
    if (pending.player_id !== player.id) return;
    saving = true;
    el('gretry').hidden = true;
    el('gp').textContent = 'Salvando resultado global...';
    try {
      const { error } = await client.rpc('cosmic_guest_finish_run', {
        p_player_id: player.id,
        p_token: player.token,
        p_session_id: pending.session,
        p_score: pending.score,
        p_duration: pending.duration,
        p_items: pending.items,
        p_level: pending.level
      });
      if (error) throw error;
      pending = null;
      erase(PENDING_KEY);
      await loadRanking();
      const position = results.findIndex(x => x.user_id === player.id);
      el('gp').textContent = position >= 0
        ? '🏆 Seu recorde está no ranking global! Posição: #' + (position + 1)
        : 'Resultado salvo. Você está fora dos 100 primeiros.';
    } catch (error) {
      el('gp').textContent = 'Não foi possível salvar: ' + error.message;
      el('gretry').hidden = false;
    } finally { saving = false; }
  }

  function finishGuest() {
    if (saved) return;
    saved = true;
    const points = Math.floor(score);
    const prev = best;
    el('gs').textContent = points;
    el('gr').textContent = points > prev ? '🏆 Novo recorde nesta missão!' : 'Seu recorde global: ' + prev;
    el('gt').textContent = 'Tempo: ' + t.toFixed(1) + 's · Símbolos: ' + items + ' · Nível: ' + (maxLv + 1);
    el('gf').textContent = FACTS[Math.floor(R() * FACTS.length)];
    if (!runId || !player) {
      el('gp').textContent = 'Sessão inválida: resultado não enviado.';
      return;
    }
    pending = {
      player_id: player.id, session: runId, score: points,
      duration: +t.toFixed(1), items, level: maxLv + 1
    };
    write(PENDING_KEY, pending);
    runId = null;
    el('gp').textContent = 'Salvando no ranking global...';
    void saveResult();
  }

  start = startGuest;
  finish = finishGuest;
  rr = drawRanking;
  best = 0;
  rank = [];
  el('mb').textContent = '0';
  el('bst').onclick = startGuest;
  el('g1').onclick = startGuest;
  el('p2').onclick = () => { state = 'MENU'; void startGuest(); };
  el('brk').onclick = () => { ia(); drawRanking(); show('rkp'); void loadRanking(); };
  el('rc').onclick = () => { void loadRanking(); };
  el('gretry').onclick = () => { void saveResult(); };

  if (client) {
    channel = client.channel('cosmic-sprint-guests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' },
        () => { void loadRanking(); }).subscribe();
    void loadRanking();
    if (player) {
      void profile().then(() => {
        msg('Bem-vindo de volta, ' + player.first_name + '! Seu recorde está salvo.');
        if (pending) void saveResult();
      }).catch(error => msg('Verificação do jogador: ' + error.message));
    } else msg('Preencha nome e sobrenome. Sem login, senha ou cadastro.');
    setInterval(() => {
      if (!document.hidden) { void loadRanking(); if (pending) void saveResult(); }
    }, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void loadRanking(); });
  } else msg('Falha na conexão com o ranking. Verifique sua internet.');
})();
