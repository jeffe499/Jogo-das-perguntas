// ==================== CONFIG JSONBIN ====================
const BIN_ID = "68c87306ae596e708fefd134"; // substitua se precisar
const MASTER_KEY = "$2a$10$3LMKVXiRGejkqgkKPn1PLue3gId0dWY/xN2fjHq1RCtx8UPYZicfq";
const ACCESS_KEY = "$2a$10$.eBKyMRaEA5nsuvcIqG/teVQucKp221vsKckeHgMWpGnF6E0j9tDO";

// ==================== DADOS (Fases / Loja) ====================
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
  // você pode adicionar fases aqui
];

const shopItems = [
  { id: "vida", name: "Vida extra", cost: 20, desc: "Permite errar uma vez sem perder pontos." },
  { id: "elim", name: "Eliminar 2 alternativas", cost: 15, desc: "Remove duas respostas erradas." },
  { id: "dica", name: "Dica", cost: 10, desc: "Mostra uma pista da resposta correta." }
];

// ==================== ESTADO PADRÃO ====================
let state = {
  accounts: {},       // username -> { pass, points, level, items: { id:count }, unlockedPhases: [ids], best:numero }
  currentUser: null,
  settings: { volume: 100, music: true, sfx: true },
  phasesMeta: []      // array with {id, unlocked, progress}
};

// ==================== HELPERS JSONBIN ====================
async function loadState() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: {
        "X-Master-Key": MASTER_KEY,
        "X-Access-Key": ACCESS_KEY
      }
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

// ==================== DOM Helpers ====================
const el = id => document.getElementById(id);
function showScreen(name) {
  const screens = ['homeScreen','phasesScreen','configsScreen','perfilScreen','quizScreen','authScreen'];
  screens.forEach(s => el(s) && el(s).classList.add('hidden'));
  el(name) && el(name).classList.remove('hidden');
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
  // associar alguns botões globais
  el('btnFases').onclick = () => showScreen('phasesScreen');
  el('phasesBtn') && (el('phasesBtn').onclick = () => showScreen('phasesScreen'));
  el('btnConfigs').onclick = () => showScreen('configsScreen');
  el('settingsBtn') && (el('settingsBtn').onclick = () => showScreen('configsScreen'));
  el('btnPerfil').onclick = () => { showScreen('perfilScreen'); renderProfile(); };
  el('profileBtn') && (el('profileBtn').onclick = () => { showScreen('perfilScreen'); renderProfile(); });
  el('openAuth').onclick = () => showScreen('authScreen');
  el('startBtn') && (el('startBtn').onclick = () => playCurrentPhase());
  el('quickStart') && (el('quickStart').onclick = () => playCurrentPhase());
  el('openProfileBtn') && (el('openProfileBtn').onclick = () => showScreen('authScreen'));

  el('btnSignup').onclick = signup;
  el('btnLogin').onclick = login;
  el('btnLogout').onclick = () => { state.currentUser = null; saveState(); updateUI(); alert('Desconectado'); };

  el('musicToggle').onchange = (e) => { state.settings.music = e.target.checked; state.settings.music ? playMusic() : stopMusic(); saveState(); };
  el('volumeRange').oninput = (e) => { state.settings.volume = +e.target.value; el('volText').innerText = state.settings.volume; setMusicVolume(); saveState(); };
  el('btnFinish').onclick = () => { if (confirm('Deseja sair da fase? Progresso será salvo.')) endPhaseEarly(); };
  el('showRankingBtn').onclick = () => { renderLeaderboard(true); };

  // quiz controls (btnNext not used in auto flow but kept)
  el('btnNext').onclick = () => { /* reserved */ };

  // load remote state
  const remote = await loadState();
  if (remote) {
    // merge remote safely (simple replace)
    state = remote;
    // ensure phasesMeta consistent with phasesData
    ensurePhasesMeta();
  } else {
    // initialize fresh state
    initDefaultState();
    await saveState();
  }

  renderPhaseList();
  renderProfile();
  renderShop();
  updateUI();
  if (state.settings.music) playMusic();
});

// ensure phasesMeta created according to phasesData
function ensurePhasesMeta() {
  const ids = phasesData.map(p => p.id);
  // add missing
  ids.forEach((id, idx) => {
    if (!state.phasesMeta.find(x => x.id === id)) {
      state.phasesMeta.push({ id, unlocked: id === 1, progress: 0 });
    }
  });
  // keep order same as phasesData
  state.phasesMeta = phasesData.map(p => state.phasesMeta.find(m => m.id === p.id) || { id: p.id, unlocked: p.id === 1, progress: 0 });
}

// initial default state
function initDefaultState() {
  state = {
    accounts: {},
    currentUser: null,
    settings: { volume: 100, music: true, sfx: true },
    phasesMeta: phasesData.map(p => ({ id: p.id, unlocked: p.id === 1, progress: 0 }))
  };

  // create a demo account for quick testing
  state.accounts['player'] = { pass: btoa('1234'), points: 0, level: 1, items: {}, unlockedPhases: [1], best: 0 };
}

// ==================== AUDIO ====================
const bgMusic = () => document.getElementById('bgMusic');
function playMusic() {
  const m = bgMusic();
  if (!m) return;
  setMusicVolume();
  m.play().catch(()=>{/* autoplay might be blocked until user interaction */});
}
function stopMusic() {
  const m = bgMusic();
  if (m) m.pause();
}
function setMusicVolume() {
  const m = bgMusic();
  if (m) m.volume = (state.settings.volume || 100) / 100;
}

// ==================== AUTENTICAÇÃO / PERFIL / RANKING ====================
function signup() {
  const u = el('authUser').value.trim();
  const p = el('authPass').value;
  if (!u || !p) return alert('Informe usuário e senha');
  if (state.accounts[u]) return alert('Usuário já existe');
  state.accounts[u] = { pass: btoa(p), points: 0, level: 1, items: {}, unlockedPhases: [1], best: 0 };
  state.currentUser = u;
  saveState();
  updateUI();
  alert('Conta criada e logada como ' + u);
}

function login() {
  const u = el('authUser').value.trim();
  const p = el('authPass').value;
  const acc = state.accounts[u];
  if (!acc || acc.pass !== btoa(p)) return alert('Usuário/senha inválidos');
  state.currentUser = u;
  saveState();
  updateUI();
  alert('Logado como ' + u);
}

function renderProfile() {
  el('profileName').innerText = state.currentUser || 'Visitante';
  const acc = state.currentUser ? state.accounts[state.currentUser] : null;
  el('profilePoints').innerText = acc ? acc.points : 0;
  el('profileLevel').innerText = acc ? acc.level : 1;
  el('profileItems').innerText = acc ? Object.entries(acc.items).map(([k,v]) => `${k}×${v}`).join(', ') || '—' : '—';
  renderLeaderboard(false);
}

// leaderboard: if showTable true, renders full table; else renders compact list
function renderLeaderboard(showTable = false) {
  const arr = Object.entries(state.accounts).map(([u,o]) => ({ user: u, points: o.points || 0, level: o.level || 1 }));
  arr.sort((a,b) => b.points - a.points);
  const lb = el('leaderboard');
  lb.innerHTML = '';
  if (showTable) {
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th>Posição</th><th>Jogador</th><th>Pontos</th><th>Nível</th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    arr.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>#${idx+1}</td><td>${it.user}</td><td>${it.points}</td><td>${it.level}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    lb.appendChild(table);
  } else {
    // compact top 5 display
    arr.slice(0,5).forEach((it, idx) => {
      const div = document.createElement('div');
      div.className = 'leader-item';
      div.innerHTML = `<div><strong>#${idx+1} ${it.user}</strong><div class="small muted">Nível: ${it.level}</div></div><div style="font-weight:700">${it.points} pts</div>`;
      lb.appendChild(div);
    });
  }
  // update global counters
  el('globalPoints').innerText = getGlobalPoints();
  el('globalLevel').innerText = getGlobalLevel();
}

function getGlobalPoints() {
  return Object.values(state.accounts).reduce((s,a) => s + (a.points||0), 0);
}
function getGlobalLevel() {
  return 1 + Math.floor(getGlobalPoints() / 100);
}

// ==================== LOJA ====================
function renderShop() {
  const container = el('shopContainer');
  if (!container) return;
  container.innerHTML = '<h3>Loja de Itens</h3>';
  shopItems.forEach(it => {
    const div = document.createElement('div');
    div.className = 'phase';
    div.innerHTML = `<strong>${it.name}</strong> (${it.cost} pts)<br><span class='small muted'>${it.desc}</span>`;
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn small-btn';
    buyBtn.style.marginLeft = '8px';
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
  saveState();
  renderProfile();
  alert(`Comprou ${item.name}! Agora você tem ${acc.items[itemId]}`);
}

// ==================== FASES & QUIZ ====================
function renderPhaseList() {
  const container = el('phaseList');
  container.innerHTML = '';
  state.phasesMeta.forEach(pmeta => {
    const div = document.createElement('div');
    div.className = 'phase' + (pmeta.unlocked ? '' : ' locked');
    div.innerHTML = `<div style="font-weight:600">Fase ${pmeta.id}</div><div class="small muted">Perguntas: ${getPhaseQuestions(pmeta.id).length} · Progresso: ${pmeta.progress}/5</div>`;
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

// session vars for quiz
let session = null; // {phaseId, index, score, livesUsed, usedItems: {...}}

// start playing current unlocked max phase
function playCurrentPhase() {
  if (!state.currentUser) { alert('Entre em sua conta para salvar progresso.'); showScreen('authScreen'); return; }
  const unlocked = state.accounts[state.currentUser].unlockedPhases || [1];
  const current = Math.max(...unlocked);
  startQuiz(current);
}

function startQuiz(phaseId) {
  const questions = getPhaseQuestions(phaseId).slice(0,5); // use first 5 (as requested)
  session = {
    phaseId,
    questions,
    index: 0,
    score: 0,
    lives: (state.accounts[state.currentUser] && state.accounts[state.currentUser].items && state.accounts[state.currentUser].items['vida']) || 0,
    usedItems: { elim: 0, dica: 0 }
  };
  showScreen('quizScreen');
  renderQuestion();
}

function renderQuestion() {
  if (!session) return;
  const q = session.questions[session.index];
  el('quizPhaseNum').innerText = session.phaseId;
  el('quizIndex').innerText = session.index + 1;
  el('quizTotal').innerText = session.questions.length;
  el('scoreDisplay').innerText = session.score;
  el('questionText').innerText = q.q;
  const ansList = el('answersList');
  ansList.innerHTML = '';

  // create answer elements
  q.a.forEach((txt, idx) => {
    const b = document.createElement('div');
    b.className = 'ans';
    b.innerText = txt;
    b.onclick = () => handleAnswer(idx, b);
    ansList.appendChild(b);
  });

  // add small control buttons: usar item eliminar / dica se user tiver
  const ctrl = document.createElement('div');
  ctrl.style.marginTop = '8px';
  ctrl.style.display = 'flex';
  ctrl.style.gap = '8px';

  const acc = state.currentUser ? state.accounts[state.currentUser] : null;
  if (acc) {
    const hasElim = (acc.items['elim'] || 0) - (session.usedItems.elim || 0) > 0;
    const elimBtn = document.createElement('button');
    elimBtn.className = 'btn small-btn';
    elimBtn.innerText = 'Eliminar 2';
    elimBtn.disabled = !hasElim;
    elimBtn.onclick = (e) => { e.stopPropagation(); useEliminateTwo(); };
    ctrl.appendChild(elimBtn);

    const hasDica = (acc.items['dica'] || 0) - (session.usedItems.dica || 0) > 0;
    const dicaBtn = document.createElement('button');
    dicaBtn.className = 'btn small-btn';
    dicaBtn.innerText = 'Usar Dica';
    dicaBtn.disabled = !hasDica;
    dicaBtn.onclick = (e) => { e.stopPropagation(); useHint(); };
    ctrl.appendChild(dicaBtn);
  }

  el('questionCard').appendChild(ctrl);
}

function handleAnswer(selectedIdx, btnElem) {
  if (!session) return;
  const q = session.questions[session.index];
  // mark answers
  const ansElems = Array.from(document.querySelectorAll('.answers .ans'));
  ansElems.forEach((elmn, idx) => {
    if (idx === q.correct) elmn.classList.add('correct');
    if (idx === selectedIdx && idx !== q.correct) elmn.classList.add('wrong');
    elmn.onclick = null; // disable further clicks
  });

  if (selectedIdx === q.correct) {
    session.score += 10;
    if (state.settings.sfx) playBeep();
  } else {
    // wrong
    // check for life
    if (session.lives > 0) {
      session.lives -= 1;
      alert('Você errou, mas tem uma vida extra — continuando sem penalidade de pontos.');
    } else {
      // no life: zero points for that question (we already do nothing)
      if (state.settings.sfx) playBeep();
    }
  }

  // next question after short delay
  setTimeout(() => {
    session.index++;
    // remove the control buttons area (so next question re-adds)
    cleanupQuestionCardControls();
    if (session.index >= session.questions.length) {
      finishPhase();
    } else {
      renderQuestion();
    }
  }, 900);
}

function cleanupQuestionCardControls() {
  const card = el('questionCard');
  if (!card) return;
  const controls = Array.from(card.querySelectorAll('div')).filter(d => d.style && d.style.gap === '8px');
  controls.forEach(c => c.remove());
}

function useEliminateTwo() {
  if (!session) return;
  const acc = state.accounts[state.currentUser];
  if (!acc || (acc.items['elim'] || 0) <= 0) { alert('Sem itens "Eliminar 2".'); return; }
  // remove two wrong options visually
  const q = session.questions[session.index];
  const ansElems = Array.from(document.querySelectorAll('.answers .ans'));
  let removed = 0;
  // shuffle indexes to randomly remove - but avoid removing correct
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
  saveState();
  renderProfile();
}

function useHint() {
  if (!session) return;
  const acc = state.accounts[state.currentUser];
  if (!acc || (acc.items['dica'] || 0) <= 0) { alert('Sem itens "Dica".'); return; }
  const q = session.questions[session.index];
  // show a simple hint: reveal first letter + number of letters
  const correctText = q.a[q.correct];
  const hint = `Dica: começa com "${correctText[0]}" e tem ${correctText.length} caracteres.`;
  alert(hint);
  acc.items['dica'] -= 1;
  session.usedItems.dica = (session.usedItems.dica || 0) + 1;
  saveState();
  renderProfile();
}

// finish phase normally
function finishPhase() {
  const acc = state.accounts[state.currentUser];
  if (acc) {
    acc.points = (acc.points || 0) + session.score;
    acc.level = Math.max(1, Math.floor((acc.points || 0) / 50) + 1);
    acc.best = Math.max(acc.best || 0, session.score || 0);
    // mark progress in phasesMeta and unlocked next if exists
    const meta = state.phasesMeta.find(p => p.id === session.phaseId);
    if (meta) meta.progress = session.questions.length; // full (5)
    // ensure unlockedPhases
    acc.unlockedPhases = acc.unlockedPhases || [];
    if (!acc.unlockedPhases.includes(session.phaseId)) acc.unlockedPhases.push(session.phaseId);
    const nextPhase = state.phasesMeta.find(p => p.id === session.phaseId + 1);
    if (nextPhase) {
      nextPhase.unlocked = true;
      if (!acc.unlockedPhases.includes(nextPhase.id)) acc.unlockedPhases.push(nextPhase.id);
    }
  }
  alert(`Fase ${session.phaseId} concluída! Você ganhou ${session.score} pontos.`);
  session = null;
  saveState();
  renderPhaseList();
  renderProfile();
  showScreen('perfilScreen');
}

// leave early and save partial
function endPhaseEarly() {
  if (!session) return;
  const acc = state.accounts[state.currentUser];
  if (acc) {
    acc.points = (acc.points || 0) + session.score;
    acc.level = Math.max(1, Math.floor((acc.points || 0) / 50) + 1);
  }
  session = null;
  saveState();
  renderPhaseList();
  renderProfile();
  showScreen('homeScreen');
}

// ==================== SFX beep (simple) ====================
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 600;
    g.gain.value = (state.settings.volume / 100) * 0.06;
    o.connect(g).connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); o.disconnect(); ctx.close(); }, 120);
  } catch (e) { /* ignore */ }
}

// ==================== UI helpers ====================
function updateUI() {
  el('welcomeTxt').innerText = state.currentUser ? 'Olá, ' + state.currentUser : 'Olá, visitante';
  el('volText').innerText = state.settings.volume;
  el('volumeRange').value = state.settings.volume;
  el('musicToggle').checked = !!state.settings.music;
  el('sfxToggle').checked = !!state.settings.sfx;
  renderPhaseList();
  renderProfile();
}

// ==================== UTILIDADES ====================
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

