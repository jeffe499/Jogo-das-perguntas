// script.js — arquivo completo
// ==================== CONFIG JSONBIN ====================
const BIN_ID = "68c879f9d0ea881f407f0797";
const MASTER_KEY = "$2a$10$3LMKVXiRGejkqgkKPn1PLue3gId0dWY/xN2fjHq1RCtx8UPYZicfq";
const ACCESS_KEY = "$2a$10$1gKTJqvxP6cwzqa972KtievzGRIkUilZAt66wtS7ofz3B1UP3fQfe";

// ==================== DADOS (fases e loja) ====================
const phasesData = [
  {
    id: 1,
    name: "Fase 1 — Básico",
    questions: [
      { q: "Qual a capital do Brasil?", a: ["São Paulo","Brasília","Rio de Janeiro","Salvador"], correct: 1 },
      { q: "Quanto é 5 + 7?", a: ["10","11","12","13"], correct: 2 },
      { q: "Quem escreveu 'Dom Casmurro'?", a: ["Machado de Assis","José de Alencar","Carlos Drummond","Clarice Lispector"], correct: 0 },
      { q: "Qual é o maior planeta do Sistema Solar?", a: ["Terra","Saturno","Júpiter","Netuno"], correct: 2 },
      { q: "Qual elemento químico tem símbolo O?", a: ["Ouro","Oxigênio","Ósmio","Prata"], correct: 1 }
    ]
  },
  {
    id: 2,
    name: "Fase 2 — Intermediário",
    questions: [
      { q: "Qual linguagem roda no navegador?", a: ["Python","Ruby","JavaScript","C++"], correct: 2 },
      { q: "Qual o resultado de 7 * 6?", a: ["42","36","48","40"], correct: 0 },
      { q: "Quem pintou a Mona Lisa?", a: ["Van Gogh","Leonardo da Vinci","Pablo Picasso","Rembrandt"], correct: 1 },
      { q: "Em que continente fica o Egito?", a: ["Ásia","Europa","América","África"], correct: 3 },
      { q: "Qual país inventou o futebol moderno?", a: ["Inglaterra","Brasil","Espanha","Portugal"], correct: 0 }
    ]
  }
];

const shopItems = [
  { id: "vida", name: "Vida extra", cost: 20, desc: "Permite errar uma vez sem perder pontos (consumível ao usar)." },
  { id: "elim", name: "Eliminar 2 alternativas", cost: 15, desc: "Remove duas respostas erradas para esta pergunta." },
  { id: "dica", name: "Dica", cost: 10, desc: "Mostra uma pista (primeira letra + tamanho)." },
  { id: "pular", name: "Pular pergunta", cost: 12, desc: "Pula a pergunta atual sem ganhar pontos." },
  { id: "dobro", name: "Dobrar pontos", cost: 18, desc: "Dobrar pontos da próxima resposta correta." },
  { id: "revelar", name: "Revelar resposta", cost: 25, desc: "Mostra qual é a alternativa correta imediatamente." },
  { id: "tempo", name: "+10s tempo", cost: 8, desc: "Adiciona 10 segundos extras (se tiver temporizador numa futura versão)." },
  { id: "autodica", name: "Auto-dica", cost: 30, desc: "Usa automaticamente 1 dica ao entrar em cada fase." }
];

// ==================== ESTADO PADRÃO ====================
let state = {
  accounts: {},             // username -> { pass, points, level, items:{}, unlockedPhases:[], best }
  currentUser: null,
  settings: {
    volume: 100,            // 0-100
    music: true,
    sfx: true,
    autoSave: true,
    showHints: true,
    theme: "dark",
    playbackRate: 1.0
  },
  phasesMeta: []            // [{id, unlocked, progress}]
};

// ==================== AUDIO (WebAudio para SFX) ====================
const AudioCtx = new (window.AudioContext || window.webkitAudioContext)();
const sfxGain = AudioCtx.createGain();
sfxGain.gain.value = (state.settings.volume / 100) * 0.08;
sfxGain.connect(AudioCtx.destination);

// Helper: play short beep (type: 'correct'|'wrong')
function playSfx(type = 'correct') {
  if (!state.settings.sfx) return;
  try {
    const ctx = AudioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    if (type === 'correct') {
      o.frequency.value = 880;
      o.type = 'sine';
    } else {
      o.frequency.value = 240;
      o.type = 'square';
    }
    // apply volume (respect global slider)
    g.gain.value = ((state.settings.volume || 100) / 100) * (type === 'correct' ? 0.08 : 0.06);
    o.connect(g).connect(ctx.destination);
    o.start();
    // short envelope
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    setTimeout(() => {
      try { o.stop(); o.disconnect(); g.disconnect(); } catch (e) {}
    }, 180);
  } catch (e) {
    // fallback: do nothing
    console.warn('SFX play error', e);
  }
}

// ==================== UTIL: JSONBin ====================
async function loadState() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": MASTER_KEY, "X-Access-Key": ACCESS_KEY }
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return data.record;
  } catch (err) {
    console.warn("loadState failed:", err);
    return null;
  }
}

async function saveState() {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": MASTER_KEY,
        "X-Access-Key": ACCESS_KEY
      },
      body: JSON.stringify(state)
    });
  } catch (err) {
    console.error("saveState failed:", err);
  }
}

// ==================== DOM HELPERS ====================
const el = id => document.getElementById(id);
function showScreen(name) {
  const screens = ['homeScreen','phasesScreen','configsScreen','perfilScreen','quizScreen','authScreen'];
  screens.forEach(s => { const e = el(s); if (e) e.classList.add('hidden'); });
  const t = el(name); if (t) t.classList.remove('hidden');
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
  bindBasicButtons();

  // load remote state
  const remote = await loadState();
  if (remote) {
    // merge remote safely (prefer remote for persistent fields)
    state = Object.assign({}, state, remote);
    state.settings = Object.assign({}, state.settings, remote.settings || {});
    ensurePhasesMeta();
  } else {
    initDefaultState();
    if (state.settings.autoSave) await saveState();
  }

  applyTheme();
  renderPhaseList();
  renderProfile();
  renderShop();
  renderConfigsUI();
  updateUI();

  // apply audio settings (volume + playbackRate)
  setMusicVolume();
  setMusicPlaybackRate();
  if (state.settings.music) try { playMusic(); } catch(e){/* ignore */ }
});

// ==================== BINDINGS BASICOS ====================
function bindBasicButtons() {
  if (el('btnFases')) el('btnFases').onclick = () => showScreen('phasesScreen');
  if (el('phasesBtn')) el('phasesBtn').onclick = () => showScreen('phasesScreen');
  if (el('btnConfigs')) el('btnConfigs').onclick = () => showScreen('configsScreen');
  if (el('settingsBtn')) el('settingsBtn').onclick = () => showScreen('configsScreen');
  if (el('btnPerfil')) el('btnPerfil').onclick = () => { showScreen('perfilScreen'); renderProfile(); };
  if (el('profileBtn')) el('profileBtn').onclick = () => { showScreen('perfilScreen'); renderProfile(); };
  if (el('openAuth')) el('openAuth').onclick = () => showScreen('authScreen');
  if (el('startBtn')) el('startBtn').onclick = () => playCurrentPhase();
  if (el('quickStart')) el('quickStart').onclick = () => playCurrentPhase();
  if (el('openProfileBtn')) el('openProfileBtn').onclick = () => showScreen('authScreen');

  if (el('btnSignup')) el('btnSignup').onclick = signup;
  if (el('btnLogin')) el('btnLogin').onclick = login;
  if (el('btnLogout')) el('btnLogout').onclick = () => { state.currentUser = null; if (state.settings.autoSave) saveState(); updateUI(); alert('Desconectado'); };

  if (el('btnFinish')) el('btnFinish').onclick = () => { if (confirm('Deseja sair da fase? Progresso será salvo.')) endPhaseEarly(); };
  if (el('showRankingBtn')) el('showRankingBtn').onclick = () => renderLeaderboard(true);
}

// ==================== PHASES META ====================
function ensurePhasesMeta() {
  const ids = phasesData.map(p => p.id);
  ids.forEach(id => {
    if (!state.phasesMeta.find(x => x.id === id)) {
      state.phasesMeta.push({ id, unlocked: id === 1, progress: 0 });
    }
  });
  state.phasesMeta = phasesData.map(p => state.phasesMeta.find(m => m.id === p.id) || { id: p.id, unlocked: p.id === 1, progress: 0 });
}
function initDefaultState() {
  state = {
    accounts: {},
    currentUser: null,
    settings: Object.assign({}, state.settings),
    phasesMeta: phasesData.map(p => ({ id: p.id, unlocked: p.id === 1, progress: 0 }))
  };
  state.accounts['player'] = { pass: btoa('1234'), points: 0, level: 1, items: {}, unlockedPhases: [1], best: 0 };
}

// ==================== BG MUSIC (HTMLAudio) ====================
function bgMusicEl() { return document.getElementById('bgMusic'); }
function playMusic() {
  const m = bgMusicEl();
  if (!m) return;
  // resume AudioContext on user gesture if needed
  if (AudioCtx.state === 'suspended') AudioCtx.resume().catch(()=>{});
  setMusicVolume();
  setMusicPlaybackRate();
  const p = m.play();
  if (p && typeof p.catch === 'function') p.catch(()=>{/* autoplay blocked until interaction */});
}
function stopMusic() {
  const m = bgMusicEl();
  if (m) m.pause();
}
function setMusicVolume() {
  const m = bgMusicEl();
  if (m) {
    m.volume = Math.max(0, Math.min(1, (state.settings.volume || 100) / 100));
  }
  // update sfxGain as well
  if (sfxGain) {
    sfxGain.gain.value = Math.max(0, Math.min(1, (state.settings.volume || 100) / 100)) * 0.08;
  }
}
function setMusicPlaybackRate() {
  const m = bgMusicEl();
  if (!m) return;
  const wasPlaying = !m.paused;
  // set the playback rate without reloading the source
  try {
    m.playbackRate = state.settings.playbackRate || 1.0;
    // if it was playing, ensure it stays playing (do not call load or replace src)
    if (wasPlaying) {
      // some browsers may require a small resume call
      m.play().catch(()=>{});
    }
  } catch (e) {
    console.warn('setMusicPlaybackRate error', e);
  }
}

// ==================== CONFIGS UI RENDER & BIND ====================
function renderConfigsUI() {
  // volume
  if (el('volText')) el('volText').innerText = state.settings.volume;
  if (el('volumeRange')) {
    el('volumeRange').value = state.settings.volume;
    el('volumeRange').oninput = (e) => {
      state.settings.volume = +e.target.value;
      if (el('volText')) el('volText').innerText = state.settings.volume;
      setMusicVolume();
      if (state.settings.autoSave) saveState();
    };
  }

  // music toggle
  if (el('musicToggle')) {
    el('musicToggle').checked = !!state.settings.music;
    el('musicToggle').onchange = (e) => {
      state.settings.music = e.target.checked;
      state.settings.music ? playMusic() : stopMusic();
      if (state.settings.autoSave) saveState();
    };
  }

  // sfx toggle
  if (el('sfxToggle')) {
    el('sfxToggle').checked = !!state.settings.sfx;
    el('sfxToggle').onchange = (e) => {
      state.settings.sfx = e.target.checked;
      if (state.settings.autoSave) saveState();
    };
  }

  // autoSave
  if (el('autoSave')) {
    el('autoSave').checked = !!state.settings.autoSave;
    el('autoSave').onchange = (e) => {
      state.settings.autoSave = e.target.checked;
      if (state.settings.autoSave) saveState();
    };
  }

  // showHints
  if (el('showHints')) {
    el('showHints').checked = !!state.settings.showHints;
    el('showHints').onchange = (e) => {
      state.settings.showHints = e.target.checked;
      if (state.settings.autoSave) saveState();
    };
  }

  // theme
  if (el('themeToggle')) {
    el('themeToggle').value = state.settings.theme || 'dark';
    el('themeToggle').onchange = (e) => {
      state.settings.theme = e.target.value;
      applyTheme();
      if (state.settings.autoSave) saveState();
    };
  }

  // playback rate
  if (el('playbackRate')) {
    el('playbackRate').value = state.settings.playbackRate || 1.0;
    if (el('playbackRateValue')) el('playbackRateValue').innerText = (state.settings.playbackRate || 1.0).toFixed(2);
    el('playbackRate').oninput = (e) => {
      const v = parseFloat(e.target.value);
      state.settings.playbackRate = v;
      if (el('playbackRateValue')) el('playbackRateValue').innerText = v.toFixed(2);
      setMusicPlaybackRate(); // update without stopping
      if (state.settings.autoSave) saveState();
    };
  }
}

function applyTheme() {
  const t = state.settings.theme || 'dark';
  document.body.classList.toggle('light-theme', t === 'light');
  document.body.classList.toggle('dark-theme', t !== 'light');
}

// ==================== AUTENTICAÇÃO / PERFIL / RANKING ====================
function signup() {
  const u = el('authUser') ? el('authUser').value.trim() : '';
  const p = el('authPass') ? el('authPass').value : '';
  if (!u || !p) return alert('Informe usuário e senha');
  if (state.accounts[u]) return alert('Usuário já existe');
  state.accounts[u] = { pass: btoa(p), points: 0, level: 1, items: {}, unlockedPhases: [1], best: 0 };
  state.currentUser = u;
  if (state.settings.autoSave) saveState();
  updateUI();
  alert('Conta criada e logada como ' + u);
}

function login() {
  const u = el('authUser') ? el('authUser').value.trim() : '';
  const p = el('authPass') ? el('authPass').value : '';
  const acc = state.accounts[u];
  if (!acc || acc.pass !== btoa(p)) return alert('Usuário/senha inválidos');
  state.currentUser = u;
  if (state.settings.autoSave) saveState();
  updateUI();
  alert('Logado como ' + u);
}

function renderProfile() {
  if (!el('profileName')) return;
  el('profileName').innerText = state.currentUser || 'Visitante';
  const acc = state.currentUser ? state.accounts[state.currentUser] : null;
  el('profilePoints').innerText = acc ? acc.points : 0;
  el('profileLevel').innerText = acc ? acc.level : 1;
  el('profileItems').innerText = acc ? Object.entries(acc.items).map(([k,v]) => `${k}×${v}`).join(', ') || '—' : '—';
  renderLeaderboard(false);
}

function renderLeaderboard(showTable = false) {
  const arr = Object.entries(state.accounts).map(([u,o]) => ({ user: u, points: o.points || 0, level: o.level || 1 }));
  arr.sort((a,b) => b.points - a.points);
  const lb = el('leaderboard');
  if (!lb) return;
  lb.innerHTML = '';
  if (showTable) {
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Posição</th><th>Jogador</th><th>Pontos</th><th>Nível</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    arr.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>#${idx+1}</td><td>${it.user}</td><td>${it.points}</td><td>${it.level}</td>`;
      tbody.appendChild(tr);
    });
    lb.appendChild(table);
  } else {
    arr.slice(0,5).forEach((it, idx) => {
      const div = document.createElement('div');
      div.className = 'leader-item';
      div.innerHTML = `<div><strong>#${idx+1} ${it.user}</strong><div class="small muted">Nível: ${it.level}</div></div><div style="font-weight:700">${it.points} pts</div>`;
      lb.appendChild(div);
    });
  }
  if (el('globalPoints')) el('globalPoints').innerText = getGlobalPoints();
  if (el('globalLevel')) el('globalLevel').innerText = getGlobalLevel();
}
function getGlobalPoints() { return Object.values(state.accounts).reduce((s,a) => s + (a.points||0), 0); }
function getGlobalLevel() { return 1 + Math.floor(getGlobalPoints() / 100); }

// ==================== LOJA ====================
function renderShop() {
  const container = el('shopContainer');
  if (!container) return;
  container.innerHTML = '<h3>Loja de Itens</h3>';
  shopItems.forEach(it => {
    const div = document.createElement('div');
    div.className = 'phase';
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.alignItems = 'center';
    div.innerHTML = `<div><strong>${it.name}</strong> <div class='small muted'>${it.desc}</div></div><div style="text-align:right">${it.cost} pts</div>`;
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn small-btn';
    buyBtn.style.marginLeft = '12px';
    buyBtn.innerText = 'Comprar';
    buyBtn.onclick = (e) => { e.stopPropagation(); buyItem(it.id); };
    div.appendChild(buyBtn);
    container.appendChild(div);
  });
}

function buyItem(itemId) {
  if (!state.currentUser) return alert('Entre na conta primeiro.');
  const acc = state.accounts[state.currentUser];
  const item = shopItems.find(i => i.id === itemId);
  if (!item) return;
  if ((acc.points || 0) < item.cost) return alert('Pontos insuficientes!');
  acc.points -= item.cost;
  acc.items[itemId] = (acc.items[itemId] || 0) + 1;
  if (state.settings.autoSave) saveState();
  renderProfile();
  alert(`Comprou ${item.name}! Agora você tem ${acc.items[itemId]}`);
}

// ==================== FASES & QUIZ ====================
function renderPhaseList() {
  const container = el('phaseList');
  if (!container) return;
  container.innerHTML = '';
  state.phasesMeta.forEach(pmeta => {
    const div = document.createElement('div');
    div.className = 'phase' + (pmeta.unlocked ? '' : ' locked');
    const qCount = (phasesData.find(p => p.id === pmeta.id)?.questions?.length) || 0;
    div.innerHTML = `<div style="font-weight:600">${pmeta.id} — Fase</div><div class="small muted">Perguntas: ${qCount} · Progresso: ${pmeta.progress}/${Math.min(5,qCount)}</div>`;
    div.onclick = () => {
      if (!pmeta.unlocked) return alert('Fase trancada. Complete as fases anteriores.');
      startQuiz(pmeta.id);
    };
    container.appendChild(div);
  });
}

function getPhaseQuestions(phaseId) {
  const phase = phasesData.find(f => f.id === phaseId);
  return phase ? phase.questions : [];
}

let session = null; // session object during quiz

function playCurrentPhase() {
  if (!state.currentUser) { alert('Entre em sua conta para salvar progresso.'); showScreen('authScreen'); return; }
  const acc = state.accounts[state.currentUser];
  const unlocked = acc ? (acc.unlockedPhases || [1]) : [1];
  const current = Math.max(...unlocked);
  startQuiz(current);
}

function startQuiz(phaseId) {
  const questions = getPhaseQuestions(phaseId).slice(0,5);
  session = {
    phaseId,
    questions,
    index: 0,
    score: 0,
    usedItems: { elim: 0, dica: 0, pular: 0, revelar: 0 },
    doubleNext: false
  };
  showScreen('quizScreen');
  renderQuestion();
}

function renderQuestion() {
  if (!session) return;
  cleanupQuestionCardControls();
  const q = session.questions[session.index];
  if (!q) return finishPhase();

  if (el('quizPhaseNum')) el('quizPhaseNum').innerText = session.phaseId;
  if (el('quizIndex')) el('quizIndex').innerText = session.index + 1;
  if (el('quizTotal')) el('quizTotal').innerText = session.questions.length;
  if (el('scoreDisplay')) el('scoreDisplay').innerText = session.score;
  if (el('questionText')) el('questionText').innerText = q.q;

  const ansList = el('answersList');
  if (!ansList) return;
  ansList.innerHTML = '';

  q.a.forEach((txt, idx) => {
    const b = document.createElement('div');
    b.className = 'ans';
    b.innerText = txt;
    b.onclick = () => handleAnswer(idx, b);
    ansList.appendChild(b);
  });

  // controls for items
  const card = el('questionCard');
  const ctrl = document.createElement('div');
  ctrl.style.marginTop = '8px';
  ctrl.style.display = 'flex';
  ctrl.style.gap = '8px';
  ctrl.dataset.ctrl = '1';

  const acc = state.currentUser ? state.accounts[state.currentUser] : null;
  if (acc) {
    // Eliminar 2
    const hasElim = (acc.items['elim'] || 0) - (session.usedItems.elim || 0) > 0;
    const elimBtn = document.createElement('button');
    elimBtn.className = 'btn small-btn';
    elimBtn.innerText = 'Eliminar 2';
    elimBtn.disabled = !hasElim;
    elimBtn.onclick = (e) => { e.stopPropagation(); useEliminateTwo(); };
    ctrl.appendChild(elimBtn);

    // Dica
    const hasDica = (acc.items['dica'] || 0) - (session.usedItems.dica || 0) > 0;
    const dicaBtn = document.createElement('button');
    dicaBtn.className = 'btn small-btn';
    dicaBtn.innerText = 'Dica';
    dicaBtn.disabled = !hasDica;
    dicaBtn.onclick = (e) => { e.stopPropagation(); useHint(); };
    ctrl.appendChild(dicaBtn);

    // Pular
    const hasPular = (acc.items['pular'] || 0) > 0;
    const pularBtn = document.createElement('button');
    pularBtn.className = 'btn small-btn';
    pularBtn.innerText = 'Pular';
    pularBtn.disabled = !hasPular;
    pularBtn.onclick = (e) => { e.stopPropagation(); useSkip(); };
    ctrl.appendChild(pularBtn);

    // Dobrar próxima
    const hasDobro = (acc.items['dobro'] || 0) > 0;
    const dobroBtn = document.createElement('button');
    dobroBtn.className = 'btn small-btn';
    dobroBtn.innerText = 'Dobrar próxima';
    dobroBtn.disabled = !hasDobro;
    dobroBtn.onclick = (e) => { e.stopPropagation(); useDouble(); };
    ctrl.appendChild(dobroBtn);

    // Revelar
    const hasRevelar = (acc.items['revelar'] || 0) > 0;
    const revelarBtn = document.createElement('button');
    revelarBtn.className = 'btn small-btn';
    revelarBtn.innerText = 'Revelar';
    revelarBtn.disabled = !hasRevelar;
    revelarBtn.onclick = (e) => { e.stopPropagation(); useReveal(); };
    ctrl.appendChild(revelarBtn);

    // show vidas
    const vidasLbl = document.createElement('div');
    vidasLbl.className = 'small muted';
    vidasLbl.style.marginLeft = '8px';
    vidasLbl.innerText = `Vidas: ${acc.items['vida'] || 0}`;
    ctrl.appendChild(vidasLbl);

    // autodica auto-activation per phase
    if (state.settings.showHints && (acc.items['autodica'] || 0) > 0 && (acc._autodicaPhaseUsed !== session.phaseId)) {
      acc.items['autodica'] = Math.max(0, acc.items['autodica'] - 1);
      acc._autodicaPhaseUsed = session.phaseId;
      if (state.settings.autoSave) saveState();
      const correctText = q.a[q.correct];
      setTimeout(() => alert(`Auto-dica: começa com "${correctText[0]}" e tem ${correctText.length} caracteres.`), 120);
    }
  }

  card.appendChild(ctrl);
}

function cleanupQuestionCardControls() {
  const card = el('questionCard');
  if (!card) return;
  const ctls = card.querySelectorAll('[data-ctrl="1"]');
  ctls.forEach(c => c.remove());
}

function handleAnswer(selectedIdx/*, btnElem*/) {
  if (!session) return;
  const q = session.questions[session.index];
  const ansElems = Array.from(document.querySelectorAll('.answers .ans'));
  ansElems.forEach(a => a.onclick = null);

  ansElems.forEach((elmn, idx) => {
    if (idx === q.correct) elmn.classList.add('correct');
    if (idx === selectedIdx && idx !== q.correct) elmn.classList.add('wrong');
  });

  const acc = state.currentUser ? state.accounts[state.currentUser] : null;

  if (selectedIdx === q.correct) {
    const base = 10;
    const points = session.doubleNext ? base * 2 : base;
    session.score += points;
    session.doubleNext = false;
    playSfx('correct');
  } else {
    if (acc && (acc.items['vida'] || 0) > 0) {
      acc.items['vida'] = Math.max(0, (acc.items['vida'] || 1) - 1);
      if (state.settings.autoSave) saveState();
      renderProfile();
      alert('Você errou, mas usou 1 Vida Extra — vida consumida, continuando sem perda de pontos.');
      playSfx('wrong');
    } else {
      playSfx('wrong');
    }
  }

  setTimeout(() => {
    cleanupQuestionCardControls();
    session.index++;
    if (session.index >= session.questions.length) finishPhase();
    else renderQuestion();
  }, 900);
}

// ==================== ITENS ====================
function useEliminateTwo() {
  if (!session) return;
  const acc = state.accounts[state.currentUser];
  if (!acc || (acc.items['elim'] || 0) <= 0) { alert('Sem itens "Eliminar 2".'); return; }
  const q = session.questions[session.index];
  const ansElems = Array.from(document.querySelectorAll('.answers .ans'));
  let removed = 0;
  const idxs = ansElems.map((_, i) => i).sort(() => Math.random() - 0.5);
  for (const i of idxs) {
    if (i === q.correct) continue;
    if (!ansElems[i].classList.contains('removed')) {
      ansElems[i].classList.add('removed');
      ansElems[i].style.opacity = '0.35';
      ansElems[i].onclick = null;
      removed++;
      if (removed >= 2) break;
    }
  }
  acc.items['elim'] -= 1;
  session.usedItems.elim = (session.usedItems.elim || 0) + 1;
  if (state.settings.autoSave) saveState();
  renderProfile();
}

function useHint() {
  if (!session) return;
  const acc = state.accounts[state.currentUser];
  if (!acc || (acc.items['dica'] || 0) <= 0) { alert('Sem itens "Dica".'); return; }
  const q = session.questions[session.index];
  const correctText = q.a[q.correct];
  alert(`Dica: começa com "${correctText[0]}" e tem ${correctText.length} caracteres.`);
  acc.items['dica'] -= 1;
  session.usedItems.dica = (session.usedItems.dica || 0) + 1;
  if (state.settings.autoSave) saveState();
  renderProfile();
}

function useSkip() {
  if (!session) return;
  const acc = state.accounts[state.currentUser];
  if (!acc || (acc.items['pular'] || 0) <= 0) { alert('Sem itens "Pular".'); return; }
  acc.items['pular'] -= 1;
  session.usedItems.pular = (session.usedItems.pular || 0) + 1;
  if (state.settings.autoSave) saveState();
  renderProfile();
  cleanupQuestionCardControls();
  session.index++;
  if (session.index >= session.questions.length) finishPhase();
  else renderQuestion();
}

function useDouble() {
  if (!session) return;
  const acc = state.accounts[state.currentUser];
  if (!acc || (acc.items['dobro'] || 0) <= 0) { alert('Sem itens "Dobro".'); return; }
  acc.items['dobro'] -= 1;
  session.doubleNext = true;
  if (state.settings.autoSave) saveState();
  renderProfile();
  alert('Próxima resposta correta valerá o dobro de pontos!');
}

function useReveal() {
  if (!session) return;
  const acc = state.accounts[state.currentUser];
  if (!acc || (acc.items['revelar'] || 0) <= 0) { alert('Sem itens "Revelar".'); return; }
  const q = session.questions[session.index];
  acc.items['revelar'] -= 1;
  if (state.settings.autoSave) saveState();
  renderProfile();
  alert(`Resposta correta: "${q.a[q.correct]}"`);
  const ansElems = Array.from(document.querySelectorAll('.answers .ans'));
  ansElems.forEach((elmn, idx) => {
    if (idx === q.correct) elmn.classList.add('correct');
    elmn.onclick = null;
  });
}

// ==================== FINALIZAÇÃO / SAIR ====================
function finishPhase() {
  const acc = state.currentUser ? state.accounts[state.currentUser] : null;
  if (acc) {
    acc.points = (acc.points || 0) + session.score;
    acc.level = Math.max(1, Math.floor((acc.points || 0) / 50) + 1);
    acc.best = Math.max(acc.best || 0, session.score || 0);
    const meta = state.phasesMeta.find(p => p.id === session.phaseId);
    if (meta) meta.progress = session.questions.length;
    acc.unlockedPhases = acc.unlockedPhases || [];
    if (!acc.unlockedPhases.includes(session.phaseId)) acc.unlockedPhases.push(session.phaseId);
    const nextMeta = state.phasesMeta.find(p => p.id === session.phaseId + 1);
    if (nextMeta) {
      nextMeta.unlocked = true;
      if (!acc.unlockedPhases.includes(nextMeta.id)) acc.unlockedPhases.push(nextMeta.id);
    }
  }
  alert(`Fase ${session.phaseId} concluída! Você ganhou ${session.score} pontos.`);
  session = null;
  if (state.settings.autoSave) saveState();
  renderPhaseList();
  renderProfile();
  showScreen('perfilScreen');
}

function endPhaseEarly() {
  if (!session) return;
  const acc = state.currentUser ? state.accounts[state.currentUser] : null;
  if (acc) {
    acc.points = (acc.points || 0) + session.score;
    acc.level = Math.max(1, Math.floor((acc.points || 0) / 50) + 1);
  }
  session = null;
  if (state.settings.autoSave) saveState();
  renderPhaseList();
  renderProfile();
  showScreen('homeScreen');
}

// ==================== UI HELPERS ====================
function updateUI() {
  if (el('welcomeTxt')) el('welcomeTxt').innerText = state.currentUser ? 'Olá, ' + state.currentUser : 'Olá, visitante';
  if (el('volText')) el('volText').innerText = state.settings.volume;
  if (el('volumeRange')) el('volumeRange').value = state.settings.volume;
  if (el('musicToggle')) el('musicToggle').checked = !!state.settings.music;
  if (el('sfxToggle')) el('sfxToggle').checked = !!state.settings.sfx;
  renderPhaseList();
  renderProfile();
}

// ==================== UTILIDADES ====================
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
