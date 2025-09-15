// ==================== CONFIG JSONBIN ====================
const BIN_ID = "673758f4ad19ca34f8a7a8d4"; // seu bin no jsonbin.io
const MASTER_KEY = "$2a$10$3LMKVXiRGejkqgkKPn1PLue3gId0dWY/xN2fjHq1RCtx8UPYZicfq";
const ACCESS_KEY = "$2a$10$.eBKyMRaEA5nsuvcIqG/teVQucKp221vsKckeHgMWpGnF6E0j9tDO";

async function loadState() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: {
        "X-Master-Key": MASTER_KEY,
        "X-Access-Key": ACCESS_KEY
      }
    });
    const data = await res.json();
    return data.record;
  } catch (e) {
    console.error("Erro carregando JSONBin", e);
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
  } catch (e) {
    console.error("Erro salvando JSONBin", e);
  }
}

// ==================== ESTADO ====================
let state = {
  accounts: {},
  currentUser: null,
  settings: { volume: 100, music: true, sfx: true }
};

// ==================== INIT ====================
async function init() {
  const remote = await loadState();
  if (remote) state = remote;
  else await saveState();

  attachUI();
  renderPhaseList();
  renderProfile();
  updateUI();

  if (state.settings.music) playMusic();
}

// ==================== MÚSICA ====================
const bgMusic = document.getElementById("bgMusic");
function playMusic() {
  bgMusic.volume = state.settings.volume / 100;
  bgMusic.play();
}
function stopMusic() { bgMusic.pause(); }

// ==================== UI e lógica ====================
const el = id => document.getElementById(id);
function showScreen(name) {
  ["homeScreen","phasesScreen","configsScreen","perfilScreen","quizScreen","authScreen"]
    .forEach(s=>el(s).classList.add("hidden"));
  el(name).classList.remove("hidden");
}

function attachUI() {
  el("btnFases").onclick = ()=>showScreen("phasesScreen");
  el("btnConfigs").onclick = ()=>showScreen("configsScreen");
  el("btnPerfil").onclick = ()=>{showScreen("perfilScreen"); renderProfile();};
  el("profileBtn").onclick = ()=>{showScreen("perfilScreen"); renderProfile();};
  el("openAuth").onclick = ()=>showScreen("authScreen");

  el("btnSignup").onclick = signup;
  el("btnLogin").onclick = login;
  el("btnLogout").onclick = ()=>{ state.currentUser=null; saveState(); updateUI(); };

  el("musicToggle").onchange = e=>{ 
    state.settings.music=e.target.checked; 
    state.settings.music?playMusic():stopMusic(); 
    saveState(); 
  };
  el("volumeRange").oninput = e=>{ 
    state.settings.volume=+e.target.value; 
    playMusic(); 
    el("volText").innerText=state.settings.volume; 
    saveState(); 
  };
}

// ==================== PERFIL ====================
function signup(){
  const u=el("authUser").value.trim(), p=el("authPass").value;
  if(!u||!p) return alert("Informe usuário e senha");
  if(state.accounts[u]) return alert("Usuário já existe");
  state.accounts[u]={pass:btoa(p),points:0,level:1};
  state.currentUser=u;
  saveState();
  updateUI();
}

function login(){
  const u=el("authUser").value.trim(), p=el("authPass").value;
  const acc=state.accounts[u];
  if(!acc||acc.pass!==btoa(p)) return alert("Usuário/senha inválidos");
  state.currentUser=u;
  saveState();
  updateUI();
}

function renderProfile(){
  el("profileName").innerText = state.currentUser || "Visitante";
  const acc = state.accounts[state.currentUser];
  el("profilePoints").innerText = acc ? acc.points : 0;
  el("profileLevel").innerText = acc ? acc.level : 1;
  renderLeaderboard();
}

function renderLeaderboard(){
  const arr = Object.entries(state.accounts).map(([u,a])=>({user:u,points:a.points,level:a.level||1}));
  arr.sort((a,b)=>b.points-a.points);
  const lb = el("leaderboard");
  lb.innerHTML="";
  arr.slice(0,10).forEach((it,idx)=>{
    const div=document.createElement("div");
    div.className="leader-item";
    div.innerHTML=`<div><strong>#${idx+1} ${it.user}</strong></div><div>${it.points} pts · Nível ${it.level}</div>`;
    lb.appendChild(div);
  });
}

// ==================== PLACEHOLDER PHASES ====================
function renderPhaseList(){ el("phaseList").innerText="(lista de fases aqui)"; }
function updateUI(){ el("welcomeTxt").innerText=state.currentUser?"Olá, "+state.currentUser:"Olá, visitante"; }

init();
