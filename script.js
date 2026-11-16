"use strict";

/**
 * ROLETA DA ILHA — GitHub Pages, sem bibliotecas externas.
 * Para trocar participantes, altere somente os nomes neste array.
 */
const NOMES = Object.freeze([
  "ANDREIA",
  "CRISTIANE",
  "DIJALMARY",
  "EDENILSE",
  "ILSE",
  "LILIANA",
  "KELI",
  "MARIANE",
  "ROSEMERI",
  "TIAGO"
]);

const STORAGE_KEY = "roleta_ilha2_v1";
const TAU = Math.PI * 2;
const $ = (selector) => document.querySelector(selector);
const rotor = $("#wheelRotor");
const canvas = $("#wheelCanvas");
const ctx = canvas.getContext("2d");
const spinButton = $("#spinButton");
const spinButtonText = $("#spinButtonText");
const noRepeatToggle = $("#noRepeatToggle");
const drawCounter = $("#drawCounter");
const historyPanel = $("#historyPanel");
const settingsPanel = $("#settingsPanel");
const settingsButton = $("#settingsButton");
const fullscreenButton = $("#fullscreenButton");
const historyList = $("#historyList");
const historyEmpty = $("#historyEmpty");
const historyButton = $("#historyButton");
const resultOverlay = $("#resultOverlay");
const winnerName = $("#winnerName");
const resultCaption = $("#resultCaption");
const continueButton = $("#continueButton");
const toast = $("#toast");

let history = [];
let rotation = 0;
let isSpinning = false;
let spinTimeout = null;
let toastTimeout = null;
let previousFocus = null;

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw || typeof raw !== "object") return;
    if (Array.isArray(raw.history)) {
      history = raw.history.filter((name) => NOMES.includes(name)).slice(-100);
    }
    if (typeof raw.noRepeat === "boolean") noRepeatToggle.checked = raw.noRepeat;
  } catch (_error) { /* A roleta funciona mesmo com armazenamento indisponível. */ }
}
function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({history, noRepeat: noRepeatToggle.checked})); }
  catch (_error) { /* Sem armazenamento, os sorteios funcionam normalmente. */ }
}
function uniqueNamesDrawn() { return new Set(history); }
function eligibleNames() {
  if (!noRepeatToggle.checked) return [...NOMES];
  const used = uniqueNamesDrawn();
  return NOMES.filter((name) => !used.has(name));
}
function randomInteger(maxExclusive) {
  if (maxExclusive <= 1) return 0;
  if (globalThis.crypto && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    const limit = Math.floor(4294967296 / maxExclusive) * maxExclusive;
    do { crypto.getRandomValues(values); } while (values[0] >= limit);
    return values[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}
function drawWheel() {
  if (!ctx) return;
  const size = 900;
  const center = size / 2;
  const radius = 439;
  const slice = TAU / NOMES.length;
  const used = noRepeatToggle.checked ? uniqueNamesDrawn() : new Set();
  const gradients = [
    ["#082958", "#0056a0", "#04183b"],
    ["#42256f", "#422b88", "#190d49"],
    ["#072b57", "#0067b1", "#051739"],
    ["#3c235f", "#462e93", "#1f1048"]
  ];
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(center, center);

  for (let i = 0; i < NOMES.length; i++) {
    const start = -Math.PI / 2 + (i - .5) * slice;
    const end = start + slice;
    const middle = start + slice / 2;
    const pal = gradients[i % gradients.length];
    const fill = ctx.createRadialGradient(0, 0, 60, 0, 0, radius);
    fill.addColorStop(0, pal[0]);
    fill.addColorStop(.62, pal[1]);
    fill.addColorStop(1, pal[2]);

    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius, start, end); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = "rgba(175,218,255,.72)"; ctx.lineWidth = 3; ctx.stroke();

    // O setor sorteado fica um pouco mais escuro quando a repetição está desativada.
    if (used.has(NOMES[i])) {
      ctx.fillStyle = "rgba(0,5,24,.49)"; ctx.fill();
    }

    // Rótulo radial, invertido no semicírculo esquerdo para não ficar de cabeça para baixo.
    ctx.save();
    ctx.rotate(middle);
    const angle = ((middle % TAU) + TAU) % TAU;
    const isLeftHalf = angle > Math.PI / 2 && angle < Math.PI * 1.5;
    ctx.translate(275, 0);
    if (isLeftHalf) ctx.rotate(Math.PI);
    const name = NOMES[i];
    const fontSize = name.length >= 9 ? 35 : name.length >= 8 ? 38 : 43;
    ctx.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 5;
    ctx.shadowColor = "rgba(3,10,36,.7)";
    ctx.strokeStyle = "rgba(2,17,50,.4)";
    ctx.lineWidth = 4;
    ctx.strokeText(name, 0, 0, 240);
    ctx.fillStyle = used.has(name) ? "#a5bcd4" : "#f6fbff";
    ctx.fillText(name, 0, 0, 240);
    ctx.restore();
  }

  const rim = ctx.createRadialGradient(0,0, radius-34, 0,0,radius);
  rim.addColorStop(0, "rgba(133,233,255,0)");
  rim.addColorStop(.60, "rgba(91,194,255,.15)");
  rim.addColorStop(1, "rgba(207,246,255,.45)");
  ctx.beginPath(); ctx.arc(0,0,radius,0,TAU); ctx.fillStyle = rim; ctx.fill();
  ctx.beginPath(); ctx.arc(0,0,radius-6,0,TAU); ctx.strokeStyle = "#9be7ff"; ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,radius-16,0,TAU); ctx.strokeStyle = "rgba(169,236,255,.50)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
function updateUI() {
  const uniqueCount = uniqueNamesDrawn().size;
  drawCounter.textContent = noRepeatToggle.checked
    ? `${uniqueCount} de ${NOMES.length} sorteados`
    : `${history.length} sorteios realizados`;
  const exhausted = noRepeatToggle.checked && uniqueCount >= NOMES.length;
  spinButton.disabled = isSpinning || exhausted;
  spinButtonText.textContent = isSpinning ? "SORTEANDO..." : exhausted ? "TODOS SORTEADOS" : "GIRAR ROLETA";
  noRepeatToggle.disabled = isSpinning;
  $("#resetButton").disabled = isSpinning;
  historyList.replaceChildren();
  history.forEach((name, index) => {
    const item = document.createElement("li");
    item.textContent = `${name}`;
    item.setAttribute("aria-label", `Sorteio ${index + 1}: ${name}`);
    historyList.appendChild(item);
  });
  historyEmpty.hidden = history.length > 0;
  historyList.hidden = history.length === 0;
  drawWheel();
}
function showToast(message) {
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 3400);
}
function showConfetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#71dcff", "#c2faff", "#897cff", "#f9d98c", "#ffffff"];
  for (let i = 0; i < 65; i++) {
    const part = document.createElement("span");
    part.className = "confetti-piece";
    part.style.setProperty("--x", `${Math.random()*100}vw`);
    part.style.setProperty("--size", `${3+Math.random()*6}px`);
    part.style.setProperty("--color", colors[i % colors.length]);
    part.style.setProperty("--r", `${Math.random()*360}deg`);
    part.style.setProperty("--drift", `${(Math.random()-.5)*35}vw`);
    part.style.setProperty("--duration", `${2.6+Math.random()*2}s`);
    document.body.appendChild(part);
    part.addEventListener("animationend", () => part.remove(), {once:true});
  }
}
function completeSpin(name) {
  if (!isSpinning) return;
  clearTimeout(spinTimeout);
  isSpinning = false;
  rotor.style.transition = "none";
  rotation = ((rotation % 360) + 360) % 360;
  rotor.style.transform = `rotate(${rotation}deg)`;
  history.push(name);
  saveSettings();
  updateUI();
  previousFocus = document.activeElement;
  winnerName.textContent = name;
  const ended = noRepeatToggle.checked && eligibleNames().length === 0;
  resultCaption.textContent = ended ? "Todos os participantes foram sorteados!" : "Compartilhar é multiplicar possibilidades.";
  continueButton.textContent = ended ? "VER RESULTADOS" : "CONTINUAR";
  resultOverlay.hidden = false;
  continueButton.focus();
  showConfetti();
}
function spin() {
  if (isSpinning || !resultOverlay.hidden) return;
  const choices = eligibleNames();
  if (!choices.length) { showToast("Todos os nomes já foram sorteados. Use Reiniciar para começar outra rodada."); return; }
  const selected = choices[randomInteger(choices.length)];
  const index = NOMES.indexOf(selected);
  const arc = 360 / NOMES.length;
  const jitter = (Math.random() - .5) * arc * .38;
  const targetModulo = ((360 - index * arc + jitter) % 360 + 360) % 360;
  const startModulo = ((rotation % 360) + 360) % 360;
  const remainder = (targetModulo - startModulo + 360) % 360;
  const totalSpin = (6 + randomInteger(3)) * 360 + remainder;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduceMotion ? 700 : 5400 + randomInteger(850);
  isSpinning = true;
  closeSettings();
  historyPanel.hidden = true;
  historyButton.setAttribute("aria-expanded", "false");
  historyButton.setAttribute("aria-label", "Abrir histórico dos sorteios");
  updateUI();
  rotor.style.transition = "none";
  rotor.style.transform = `rotate(${rotation}deg)`;
  // Forçar o navegador a registrar a posição inicial antes da transição.
  void rotor.offsetWidth;
  rotation += totalSpin;
  rotor.style.transition = `transform ${duration}ms cubic-bezier(.14,.75,.06,1)`;
  rotor.style.transform = `rotate(${rotation}deg)`;
  // Timeout de segurança para navegadores que não disparam transitionend.
  spinTimeout = setTimeout(() => completeSpin(selected), duration + 80);
}
function closeResult() {
  resultOverlay.hidden = true;
  if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  else spinButton.focus();
  if (noRepeatToggle.checked && eligibleNames().length === 0) {
    settingsPanel.hidden = false;
    settingsButton.setAttribute("aria-expanded", "true");
    historyPanel.hidden = false;
    historyButton.setAttribute("aria-expanded", "true");
    historyButton.setAttribute("aria-label", "Fechar histórico dos sorteios");
  }
}
function reset() {
  if (isSpinning) return;
  history = [];
  saveSettings();
  updateUI();
  historyPanel.hidden = true;
  historyButton.setAttribute("aria-expanded", "false");
  historyButton.setAttribute("aria-label", "Abrir histórico dos sorteios");
  showToast("Roleta reiniciada. Todos os nomes estão disponíveis.");
}
spinButton.addEventListener("click", spin);
continueButton.addEventListener("click", closeResult);
$("#resetButton").addEventListener("click", reset);
noRepeatToggle.addEventListener("change", () => { saveSettings(); updateUI(); });
function closeSettings() {
  settingsPanel.hidden = true;
  settingsButton.setAttribute("aria-expanded", "false");
  settingsButton.setAttribute("aria-label", "Abrir opções");
}
settingsButton.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  const shown = !settingsPanel.hidden;
  settingsButton.setAttribute("aria-expanded", String(shown));
  settingsButton.setAttribute("aria-label", shown ? "Fechar opções" : "Abrir opções");
});
$("#closeSettingsButton").addEventListener("click", () => {closeSettings();settingsButton.focus();});
historyButton.addEventListener("click", () => {
  const show = historyPanel.hidden;
  historyPanel.hidden = !show;
  historyButton.setAttribute("aria-expanded", String(show));
  historyButton.setAttribute("aria-label", show ? "Fechar histórico dos sorteios" : "Abrir histórico dos sorteios");
});
$("#closeHistoryButton").addEventListener("click", () => {
  historyPanel.hidden = true;
  historyButton.setAttribute("aria-expanded", "false");
  historyButton.focus();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !resultOverlay.hidden) { event.preventDefault(); closeResult(); } else if (event.key === "Escape" && !settingsPanel.hidden) { closeSettings(); settingsButton.focus(); }
  if ((event.code === "Space" || event.code === "Enter") && event.target === document.body && resultOverlay.hidden && !isSpinning) {
    event.preventDefault(); spin();
  }
  if (event.key === "Tab" && !resultOverlay.hidden) {
    event.preventDefault(); continueButton.focus();
  }
});

function tryEnterFullscreen() {
  if (document.fullscreenElement) return Promise.resolve(true);
  const root = document.documentElement;
  if (!root.requestFullscreen) return Promise.resolve(false);
  try { return root.requestFullscreen({navigationUI: "hide"}).then(() => true).catch(() => false); }
  catch (_error) { return Promise.resolve(false); }
}
async function toggleFullscreen() {
  if (document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch (_error) {}
    return;
  }
  if (!(await tryEnterFullscreen())) showToast("Para tela cheia, use F11 ou permita o modo de apresentação no navegador.");
}
function syncFullscreenControl() {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.setAttribute("aria-label", active ? "Sair da tela cheia" : "Ativar tela cheia");
  fullscreenButton.title = active ? "Sair da tela cheia" : "Tela cheia (F11 no computador)";
}
fullscreenButton.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenControl);
function setupFullscreenExperience() {
  // Fullscreen real não pode ser garantido na abertura: o navegador costuma exigir um gesto.
  // Ocupamos 100% da viewport imediatamente e pedimos fullscreen no primeiro gesto permitido.
  tryEnterFullscreen(); // Alguns navegadores e instalações em quiosque permitem esta abertura.
  let attempted = false;
  const onUserGesture = (event) => {
    if (attempted) return;
    attempted = true;
    // O botão dedicado gerencia sua própria entrada/saída sem disparar duas ações.
    const isFullscreenButton = event.target instanceof Element &&
      Boolean(event.target.closest("#fullscreenButton"));
    if (!isFullscreenButton) tryEnterFullscreen();
    window.removeEventListener("pointerdown", onUserGesture, true);
    window.removeEventListener("keydown", onUserGesture, true);
  };
  window.addEventListener("pointerdown", onUserGesture, {capture:true});
  window.addEventListener("keydown", onUserGesture, {capture:true});
}

loadSettings();
updateUI();
setupFullscreenExperience();
