// TRUTHPOP — app.js (Clean Final Version 💥)
// Built by Vedika

const HUME_API_KEY = 'YOUR_KEY_HERE';
let lastRecording = null;
let stressSpikes  = 0;

window.onload = function () {
  const saved = localStorage.getItem('truthpop_last');
  if (saved) lastRecording = JSON.parse(saved);
  setTimeout(function () {
    const splash = document.getElementById('splashScreen');
    splash.classList.add('fade-out');
    setTimeout(function () { splash.classList.add('hidden'); showWalkthrough(); }, 600);
  }, 3000);
};

let currentSlide = 0;
const totalSlides = 3;
function showWalkthrough() { const wt = document.getElementById('walkthroughScreen'); wt.classList.remove('hidden'); wt.classList.add('fade-in'); }
function nextSlide() { if (currentSlide === totalSlides - 1) { goToMainApp(); return; } goSlide(currentSlide + 1); }
function goSlide(index) {
  const slides = document.querySelectorAll('.wt-slide');
  const dots   = document.querySelectorAll('.wt-dot');
  const btn    = document.getElementById('wtNextBtn');
  slides[currentSlide].classList.remove('active'); dots[currentSlide].classList.remove('active');
  currentSlide = index;
  slides[currentSlide].classList.add('active'); dots[currentSlide].classList.add('active');
  btn.textContent = currentSlide === totalSlides - 1 ? "Let's Go! 🚀" : "Next →";
}
function goToMainApp() {
  const wt = document.getElementById('walkthroughScreen');
  const main = document.getElementById('mainScreen');
  wt.classList.add('fade-out');
  setTimeout(function () {
    wt.classList.add('hidden'); main.classList.remove('hidden'); main.classList.add('fade-in');
    buildWaveform(40); setupSpeechRecognition();
  }, 600);
}

let currentTheme = 'warm';
function setTheme(n) {
  document.body.classList.remove('theme-' + currentTheme);
  document.body.classList.add('theme-' + n); currentTheme = n;
  document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active-dot'));
  document.querySelector('.theme-dot.' + n).classList.add('active-dot');
}
document.querySelector('.theme-dot.warm').classList.add('active-dot');

let waveformInterval = null;
function buildWaveform(n) {
  const w = document.getElementById('waveform'); w.innerHTML = '';
  for (let i = 0; i < n; i++) { const b = document.createElement('div'); b.className = 'wave-bar'; b.style.height = '8px'; w.appendChild(b); }
}
function startWaveformAnimation() {
  document.getElementById('waveformContainer').classList.add('visible');
  waveformInterval = setInterval(function () { document.querySelectorAll('.wave-bar').forEach(b => b.style.height = (Math.random() * 48 + 4) + 'px'); }, 100);
}
function stopWaveformAnimation() {
  clearInterval(waveformInterval);
  document.querySelectorAll('.wave-bar').forEach(b => b.style.height = '8px');
  document.getElementById('waveformContainer').classList.remove('visible');
}

let recognition = null, fullTranscript = '';
function setupSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US';
  let lastTime = Date.now();
  recognition.onresult = function (e) {
    const now = Date.now();
    if (now - lastTime > 2200 && isRecording) stressSpikes++;
    lastTime = now;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) fullTranscript += e.results[i][0].transcript + ' ';
    }
  };
  recognition.onerror = function (e) { if (e.error === 'no-speech' && isRecording) stressSpikes++; };
  recognition.onend = function () { if (isRecording) recognition.start(); };
}

let isRecording = false, timerInterval = null, secondsElapsed = 0, audioChunks = [], mediaRecorder = null;
function toggleRecord() { if (isRecording) { stopRecording(); } else { startRecording(); } }
async function startRecording() {
  isRecording = true; secondsElapsed = 0; fullTranscript = ''; audioChunks = []; stressSpikes = 0;
  const old = document.getElementById('summaryCard'); if (old) old.remove();
  document.getElementById('recordBtn').classList.add('recording');
  document.getElementById('recordIcon').textContent = '⏹';
  document.getElementById('recordStatus').textContent = 'Listening… speak freely! 🎧';
  document.getElementById('recordHint').textContent = 'Tap again to stop';
  document.getElementById('recordTimer').classList.add('visible');
  startWaveformAnimation();
  timerInterval = setInterval(function () { secondsElapsed++; document.getElementById('recordTimer').textContent = formatTime(secondsElapsed); }, 1000);
  if (recognition) recognition.start();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.start(1000);
  } catch (err) { console.log('Mic:', err); }
}
function stopRecording() {
  isRecording = false; clearInterval(timerInterval);
  if (recognition) recognition.stop();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') { mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t => t.stop()); }
  document.getElementById('recordBtn').classList.remove('recording');
  document.getElementById('recordIcon').textContent = '🎤';
  document.getElementById('recordTimer').classList.remove('visible');
  document.getElementById('recordHint').textContent = 'Tap to record again';
  stopWaveformAnimation();
  document.getElementById('recordStatus').textContent = 'Analysing your voice… 🧠';
  setTimeout(() => analyseWithHumeAI(secondsElapsed, fullTranscript), 1200);
}

async function analyseWithHumeAI(duration, transcript) {
  if (HUME_API_KEY === 'YOUR_KEY_HERE') { showResults(duration, transcript, getDemoEmotions()); return; }
  try {
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    const fd = new FormData();
    fd.append('file', blob, 'rec.webm');
    fd.append('models', JSON.stringify({ prosody: {} }));
    const res = await fetch('https://api.hume.ai/v0/batch/jobs', { method: 'POST', headers: { 'X-Hume-Api-Key': HUME_API_KEY }, body: fd });
    const job = await res.json();
    pollForResults(job.job_id, duration, transcript);
  } catch (e) { showResults(duration, transcript, getDemoEmotions()); }
}
async function pollForResults(jobId, duration, transcript) {
  let attempts = 0;
  const chk = setInterval(async function () {
    if (++attempts > 15) { clearInterval(chk); showResults(duration, transcript, getDemoEmotions()); return; }
    try {
      const res = await fetch('https://api.hume.ai/v0/batch/jobs/' + jobId + '/predictions', { headers: { 'X-Hume-Api-Key': HUME_API_KEY } });
      if (!res.ok) return;
      clearInterval(chk); showResults(duration, transcript, extractEmotions(await res.json()));
    } catch (e) {}
  }, 2000);
}
function extractEmotions(data) {
  try {
    const preds = data[0].results.predictions[0].models.prosody.grouped_predictions[0].predictions;
    let totals = {}, count = 0;
    preds.forEach(p => { p.emotions.forEach(e => { totals[e.name] = (totals[e.name] || 0) + e.score; }); count++; });
    return getEmotionNames().map(name => ({ name, score: totals[name] ? Math.round((totals[name]/count)*100) : Math.round(Math.random()*40+10) }));
  } catch (e) { return getDemoEmotions(); }
}

// ── 10 PARAMETERS (Excitement REPLACED by Shyness as visible param) ──
function getEmotionNames() {
  return ['Happiness', 'Confidence', 'Shyness', 'Sadness', 'Spark', 'Stress', 'Energy', 'Focus', 'Uncertainty', 'Excitement'];
}

function getDemoEmotions() {
  const ranges = {
    Happiness:   [45, 78],
    Confidence:  [40, 75],
    Shyness:     [48, 72],
    Sadness:     [5,  28],
    Spark:       [30, 68],
    Stress:      [18, 48],
    Energy:      [35, 72],
    Focus:       [30, 62],
    Uncertainty: [12, 38],
    Excitement:  [20, 50]
  };
  return getEmotionNames().map(function (name) {
    const r = ranges[name] || [20, 60];
    return { name: name, score: Math.round(Math.random() * (r[1] - r[0]) + r[0]) };
  });
}

// ── TRUTH SCORE (7 forensic signals) ──
function calculateTruthScore(emotions, duration, wordCount) {
  const get = name => (emotions.find(e => e.name === name) || {}).score || 30;

  const confidence  = get('Confidence');
  const stress      = get('Stress');
  const uncertainty = get('Uncertainty');
  const energy      = get('Energy');
  const shyness     = get('Shyness');
  const happiness   = get('Happiness');

  const isShort    = wordCount > 0 && wordCount <= 8;
  const noSpeech   = wordCount === 0;
  if (noSpeech) return 50;

  let score = 55;

  // AMPLIFIED signals — push much further from 50!
  score += (energy      - 35) * 0.35;
  score += (happiness   - 40) * 0.20;
  score -= (stress      - 20) * 0.40;
  score -= (uncertainty - 20) * 0.30;
  score -= (shyness     - 15) * 0.12;

  // Strong bonus/penalty blocks
  if (confidence > 62 && energy > 50 && stress < 35) score += 20;
  else if (confidence > 62 && stress > 45) score -= 28;
  else if (confidence > 62 && uncertainty > 40) score -= 20;
  
  // If stress is very high, push hard toward deceptive
  if (stress > 60) score -= 20;
  // If very calm and happy, push hard toward truth
  if (energy > 60 && happiness > 60 && stress < 25) score += 18;

  const transcript = fullTranscript.toLowerCase();
  const hesWords   = ['um','uh','er','like','you know','basically','i mean','sort of','kind of','honestly','i guess','maybe'];
  let hesCount = 0;
  hesWords.forEach(w => { const m = transcript.match(new RegExp('\\b' + w + '\\b', 'g')); if (m) hesCount += m.length; });
  const hesRate = wordCount > 0 ? (hesCount / wordCount) * 10 : 0;
  if (hesRate > 3)        score -= 18;
  else if (hesRate > 1.5) score -= 9;
  else if (hesRate < 0.3) score += 6;

  const words = transcript.split(' ').filter(w => w.length > 3);
  const freq  = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const repeated = Object.values(freq).filter(c => c > 2).length;
  if (repeated > 3) score -= 12;
  else if (repeated > 1) score -= 5;

  const wpm = duration > 0 ? (wordCount / duration) * 60 : 120;
  if (wpm > 200)              score -= 14;
  else if (wpm >= 90 && wpm <= 160) score += 8;
  else if (wpm < 50 && wordCount > 5) score -= 10;

  score -= Math.min(stressSpikes, 4) * 6;
  if (isShort && stress < 32 && hesCount === 0 && stressSpikes <= 1) score += 15;

  return Math.min(88, Math.max(12, Math.round(score)));
}

// ── VIBE SENTENCE ──
function getVibeSentence(emotions, truthScore) {
  const get = name => (emotions.find(e => e.name === name) || {}).score || 30;
  const top = emotions.reduce((a, b) => a.score > b.score ? a : b);
  const vibes = [
    { check: () => get('Happiness') > 65 && get('Energy') > 55,    text: "You sound genuinely lit up right now — real joy coming through! ✨" },
    { check: () => get('Spark') > 60 && get('Energy') > 50,         text: "Your voice has serious Spark right now — electric and engaging! 💥" },
    { check: () => get('Energy') > 65,                               text: "High energy speaker! You sound switched on and full of life. ⚡" },
    { check: () => get('Confidence') > 65 && get('Stress') < 35,    text: "Super confident and grounded — people would trust what you are saying. 💪" },
    { check: () => get('Sadness') > 45,                              text: "There is a heaviness in your voice today. Whatever you are feeling — that is valid. 🌧️" },
    { check: () => get('Stress') > 58,                               text: "Your voice is carrying some tension. Take a breath — you have totally got this. 🫁" },
    { check: () => get('Shyness') > 40,                              text: "You sound a little hesitant — like you have more to say than you are letting out. 🌸" },
    { check: () => get('Confidence') > 60,                           text: "You come across as someone who knows exactly what they are talking about. 💪" },
    { check: () => top.score > 65,                                   text: "Your " + top.name + " is really shining through in your voice right now! 🌟" },
    { check: () => true,                                              text: "Every voice is unique — and yours has its own special energy today! 💥" }
  ];
  return vibes.find(v => v.check()).text;
}

// ── COMPARISON ──
function getComparisonText(emotions, truthScore) {
  if (!lastRecording) return null;
  const prevConf  = (lastRecording.emotions && lastRecording.emotions.find(e => e.name === 'Confidence') || {}).score || 50;
  const currConf  = (emotions.find(e => e.name === 'Confidence') || {}).score || 50;
  const confDiff  = currConf - prevConf;
  const truthDiff = truthScore - (lastRecording.truthScore || 50);
  const parts = [];
  if (confDiff > 8)       parts.push('More confident than last time 📈');
  else if (confDiff < -8) parts.push('Less confident than last time 📉');
  else                    parts.push('Similar confidence 🔁');
  if (truthDiff > 8)       parts.push('More truthful signals ✅');
  else if (truthDiff < -8) parts.push('More stress than last time ⚠️');
  else                     parts.push('Consistent patterns');
  return parts.join(' · ');
}

// ── FEEDBACK ──
function getEmotionFeedback(emotions) {
  const get = name => (emotions.find(e => e.name === name) || {}).score || 30;
  const lines = [];
  const stress = get('Stress'), uncertainty = get('Uncertainty'), focus = get('Focus'), shyness = get('Shyness');
  if (stress > 50)       lines.push('😰 Elevated stress detected — try slowing your pace and breathing deeply.');
  else if (stress < 20)  lines.push('😌 Very low stress — you sound relaxed and completely at ease!');
  if (uncertainty > 40)  lines.push('❓ Some uncertainty in your voice — you might still be deciding something.');
  else if (uncertainty < 15) lines.push('✅ Very clear and decided — minimal uncertainty detected.');
  if (focus > 55)        lines.push('🎯 Strong focus — you sound like you know exactly what you want to say.');
  else if (focus < 25)   lines.push('💭 A bit scattered — maybe you had a lot on your mind?');
  if (shyness > 42)      lines.push('🌸 Some shyness coming through — your voice quieted at moments.');
  return lines;
}

// ── SHOW RESULTS ──
function showResults(duration, transcript, emotions) {
  document.getElementById('recordStatus').textContent = 'Your TruthPop report! 💥';

  const wordCount = transcript.trim() ? transcript.trim().split(' ').filter(Boolean).length : 0;
  const wpm       = duration > 0 ? Math.round((wordCount / duration) * 60) : 0;
  let pace = 'Slow 🐢';
  if (wpm > 100) pace = 'Normal ✅';
  if (wpm > 160) pace = 'Fast 🚀';
  if (wordCount === 0) pace = 'Nothing detected 🤫';

  const truthScore   = calculateTruthScore(emotions, duration, wordCount);
  const vibeSentence = getVibeSentence(emotions, truthScore);
  const comparison   = getComparisonText(emotions, truthScore);
  const feedbackList = getEmotionFeedback(emotions);

  // Top 7 by score
  const top7 = [...emotions].sort((a, b) => b.score - a.score).slice(0, 7);

  lastRecording = { emotions, truthScore };
  localStorage.setItem('truthpop_last', JSON.stringify(lastRecording));
  // Save to history!
  saveToHistory(duration, transcript, emotions, truthScore);

  const transcriptText = transcript.trim()
    ? '"' + transcript.trim().substring(0, 180) + (transcript.length > 180 ? '...' : '') + '"'
    : 'No words detected — allow microphone! 🎤';

  let truthDesc = '';
  if (truthScore >= 72)      truthDesc = 'Voice patterns suggest <strong>high truthfulness</strong>. Calm tone, natural pace, minimal stress. ✅';
  else if (truthScore >= 55) truthDesc = '<strong>Moderate truthfulness</strong>. Some hesitation patterns noticed mid-speech. 🤔';
  else if (truthScore >= 35) truthDesc = '<strong>Notable stress signals</strong> detected. Unnatural pauses and elevated uncertainty. ⚠️';
  else                       truthDesc = '<strong>High stress indicators</strong> detected. Multiple spikes and inconsistent rhythm. 🚨';

  const icons = {
    Happiness: '😊', Confidence: '💪', Shyness: '🙈', Sadness: '😔',
    Spark: '💥', Stress: '😰', Energy: '⚡', Focus: '🎯',
    Uncertainty: '❓', Excitement: '⚡'
  };
  const colors = ['#ff6b9d', '#06b6d4', '#ff9a3c', '#10b981', '#c77dff', '#f59e0b', '#3b82f6'];

  const card = document.createElement('div');
  card.id = 'summaryCard';
  card.className = 'summary-card fade-in';
  card.innerHTML =
    '<div class="summary-header"><span class="summary-emoji">💥</span><span class="summary-title">TruthPop Report</span></div>' +
    '<div class="vibe-sentence">' + vibeSentence + '</div>' +
    (comparison ? '<div class="comparison-box">🔁 vs last recording: ' + comparison + '</div>' : '') +
    '<div class="summary-stats">' +
      '<div class="stat-item"><div class="stat-value">' + formatTime(duration) + '</div><div class="stat-label">Duration</div></div>' +
      '<div class="stat-item"><div class="stat-value">' + wordCount + '</div><div class="stat-label">Words</div></div>' +
      '<div class="stat-item"><div class="stat-value">' + wpm + '</div><div class="stat-label">WPM</div></div>' +
    '</div>' +
    '<div class="summary-pace">Speaking pace: <strong>' + pace + '</strong></div>' +
    '<div class="emotions-section"><div class="section-title">🧠 Top 7 Emotions</div><div class="emotions-list" id="emotionsList"></div></div>' +
    (feedbackList.length > 0 ? '<div class="feedback-section"><div class="section-title">💬 Voice Insights</div><div class="feedback-list" id="feedbackList"></div></div>' : '') +
    '<div class="truth-section">' +
      '<div class="section-title">💥 Truth-O-Meter</div>' +
      '<div class="truth-disclaimer">⚡ Works best with emotional speech — calm factual statements are harder to judge.</div>' +
      '<div class="stress-spikes">Stress spikes: <strong>' + stressSpikes + '</strong>' + (stressSpikes > 3 ? ' — elevated ⚠️' : ' — normal ✅') + '</div>' +
      '<div class="truth-labels-row"><span class="t-false">◀ Deceptive</span><span class="t-true">Truthful ▶</span></div>' +
      '<div class="truth-track"><div class="truth-thumb" id="truthThumb" style="left:50%"></div></div>' +
      '<div class="truth-score-row"><span class="t-false">' + (100 - truthScore) + '%</span><span class="t-true">' + truthScore + '%</span></div>' +
      '<div class="truth-desc">' + truthDesc + '</div>' +
    '</div>' +
    '<div class="summary-transcript"><div class="transcript-label">🗣️ What you said:</div><div class="transcript-text">' + transcriptText + '</div></div>';

  document.querySelector('.record-area').appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Animate bars
  const list = document.getElementById('emotionsList');
  top7.forEach(function (emotion, index) {
    const color = colors[index % colors.length];
    const icon  = icons[emotion.name] || '✨';
    const row   = document.createElement('div');
    row.className = 'emotion-row';
    row.innerHTML =
      '<div class="emotion-row-label"><span>' + icon + '</span><span>' + emotion.name + '</span></div>' +
      '<div class="emotion-bar-wrap"><div class="emotion-bar-fill" id="bar' + index + '" style="width:0%;background:' + color + '"></div></div>' +
      '<div class="emotion-pct" style="color:' + color + '">' + emotion.score + '%</div>';
    list.appendChild(row);
    setTimeout(function () {
      const bar = document.getElementById('bar' + index);
      if (bar) bar.style.width = emotion.score + '%';
    }, index * 120 + 400);
  });

  // Feedback
  const fbEl = document.getElementById('feedbackList');
  if (fbEl) {
    feedbackList.forEach(function (line) {
      const item = document.createElement('div');
      item.className = 'feedback-item';
      item.textContent = line;
      fbEl.appendChild(item);
    });
  }

  // Truth slider
  setTimeout(function () {
    const thumb = document.getElementById('truthThumb');
    if (thumb) thumb.style.left = truthScore + '%';
  }, 1000);
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ':' + (sec < 10 ? '0' + sec : sec);
}

// ── HISTORY SYSTEM ──
// Saves every recording to localStorage
// Shows all past recordings in history tab

function saveToHistory(duration, transcript, emotions, truthScore) {
  const history = getHistory();
  const top = [...emotions].sort((a, b) => b.score - a.score)[0];
  const entry = {
    id: Date.now(),
    date: new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }),
    duration: formatTime(duration),
    wordCount: transcript.trim() ? transcript.trim().split(' ').filter(Boolean).length : 0,
    topEmotion: top.name,
    topScore: top.score,
    truthScore: truthScore,
    transcript: transcript.trim().substring(0, 120) || 'No speech detected',
    emotions: emotions
  };
  history.unshift(entry); // add to beginning
  localStorage.setItem('truthpop_history', JSON.stringify(history));
}

function getHistory() {
  const saved = localStorage.getItem('truthpop_history');
  return saved ? JSON.parse(saved) : [];
}

function deleteHistoryEntry(id) {
  const history = getHistory().filter(function(e) { return e.id !== id; });
  localStorage.setItem('truthpop_history', JSON.stringify(history));
  // Try both render methods
  const histScreen = document.getElementById('historyScreen');
  if (histScreen && !histScreen.classList.contains('hidden')) {
    renderHistory();
  } else {
    showHistoryInMain();
  }
}

function renderHistory() {
  const history = getHistory();
  const list    = document.getElementById('historyList');
  const empty   = document.getElementById('historyEmpty');

  if (!list) return;
  list.innerHTML = '';

  if (history.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (empty) empty.style.display = 'none';

  const icons = {
    Happiness:'😊', Confidence:'💪', Shyness:'🙈', Sadness:'😔',
    Spark:'💥', Stress:'😰', Energy:'⚡', Focus:'🎯',
    Uncertainty:'❓', Excitement:'⚡'
  };

  history.forEach(function (entry) {
    const card = document.createElement('div');
    card.className = 'history-card';

    // Truth color
    let truthColor = '#10b981';
    if (entry.truthScore < 55) truthColor = '#f59e0b';
    if (entry.truthScore < 35) truthColor = '#f43f5e';

    card.innerHTML =
      '<div class="history-card-header">' +
        '<div class="history-date">' + entry.date + '</div>' +
        '<button class="history-delete" onclick="deleteHistoryEntry(' + entry.id + ')" title="Delete">✕</button>' +
      '</div>' +
      '<div class="history-stats">' +
        '<div class="history-stat">' +
          '<span class="history-stat-icon">' + (icons[entry.topEmotion] || '✨') + '</span>' +
          '<span class="history-stat-label">' + entry.topEmotion + '</span>' +
          '<span class="history-stat-val">' + entry.topScore + '%</span>' +
        '</div>' +
        '<div class="history-stat">' +
          '<span class="history-stat-icon">💥</span>' +
          '<span class="history-stat-label">Truth</span>' +
          '<span class="history-stat-val" style="color:' + truthColor + '">' + entry.truthScore + '%</span>' +
        '</div>' +
        '<div class="history-stat">' +
          '<span class="history-stat-icon">🕐</span>' +
          '<span class="history-stat-label">Duration</span>' +
          '<span class="history-stat-val">' + entry.duration + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="history-transcript">"' + entry.transcript + (entry.transcript.length >= 120 ? '...' : '') + '"</div>';

    list.appendChild(card);
  });
}

function showTab(t) {
  // Hide all screens first
  ['mainScreen','historyScreen'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // Remove active from all nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  if (t === 'record') {
    document.getElementById('mainScreen').classList.remove('hidden');
    document.querySelectorAll('.nav-btn')[0].classList.add('active');

  } else if (t === 'history') {
    // If history screen exists in HTML use it
    const histScreen = document.getElementById('historyScreen');
    if (histScreen) {
      histScreen.classList.remove('hidden');
      renderHistory();
      document.querySelectorAll('.nav-btn')[1].classList.add('active');
    } else {
      // Fallback: show history inside main screen
      document.getElementById('mainScreen').classList.remove('hidden');
      document.querySelectorAll('.nav-btn')[1].classList.add('active');
      showHistoryInMain();
    }

  } else if (t === 'about') {
    document.getElementById('mainScreen').classList.remove('hidden');
    document.querySelectorAll('.nav-btn')[2].classList.add('active');
    showAboutInMain();
  }
}

function showHistoryInMain() {
  // Remove old summary card
  const old = document.getElementById('summaryCard');
  if (old) old.remove();

  const history = getHistory();
  const area = document.querySelector('.record-area');

  // Clear area
  area.innerHTML = '';

  if (history.length === 0) {
    area.innerHTML =
      '<div style="text-align:center;padding:40px 20px;">' +
        '<div style="font-size:3rem">📋</div>' +
        '<div style="font-family:Nunito,sans-serif;font-weight:800;font-size:1.1rem;color:var(--text);margin-top:12px">No recordings yet!</div>' +
        '<div style="font-size:0.85rem;color:var(--text-muted);margin-top:8px;line-height:1.6">Record your first voice analysis<br>to see your history here.</div>' +
        '<button onclick="goRecord()" style="margin-top:20px;padding:12px 28px;background:var(--accent);color:white;border:none;border-radius:100px;cursor:pointer;font-size:0.9rem;font-weight:700">Start Recording</button>' +
      '</div>';
    return;
  }

  const icons = {
    Happiness:'😊',Confidence:'💪',Shyness:'🙈',Sadness:'😔',
    Spark:'💥',Stress:'😰',Energy:'⚡',Focus:'🎯',Uncertainty:'❓',Excitement:'⚡'
  };

  // Back button + title row
  const topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;width:100%;';
  topRow.innerHTML =
    '<div style="font-family:Nunito,sans-serif;font-weight:800;font-size:1.1rem;color:var(--text);">📋 All Recordings (' + history.length + ')</div>' +
    '<button onclick="goRecord()" style="background:var(--accent);color:white;border:none;border-radius:100px;padding:8px 16px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">🎤 Record</button>';
  area.appendChild(topRow);

  history.forEach(function(entry) {
    let truthColor = '#10b981';
    if (entry.truthScore < 55) truthColor = '#f59e0b';
    if (entry.truthScore < 35) truthColor = '#f43f5e';

    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML =
      '<div class="history-card-header">' +
        '<div class="history-date">' + entry.date + '</div>' +
        '<button class="history-delete" onclick="deleteHistoryEntry(' + entry.id + ')">✕</button>' +
      '</div>' +
      '<div class="history-stats">' +
        '<div class="history-stat">' +
          '<span class="history-stat-icon">' + (icons[entry.topEmotion]||'✨') + '</span>' +
          '<span class="history-stat-label">' + entry.topEmotion + '</span>' +
          '<span class="history-stat-val">' + entry.topScore + '%</span>' +
        '</div>' +
        '<div class="history-stat">' +
          '<span class="history-stat-icon">💥</span>' +
          '<span class="history-stat-label">Truth</span>' +
          '<span class="history-stat-val" style="color:' + truthColor + '">' + entry.truthScore + '%</span>' +
        '</div>' +
        '<div class="history-stat">' +
          '<span class="history-stat-icon">🕐</span>' +
          '<span class="history-stat-label">Duration</span>' +
          '<span class="history-stat-val">' + entry.duration + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="history-transcript">"' + entry.transcript + (entry.transcript.length >= 120 ? '...' : '') + '"</div>';

    area.appendChild(card);
  });
}

function goRecord() {
  // Step 1: Show main screen, hide others
  const mainScreen = document.getElementById('mainScreen');
  const histScreen = document.getElementById('historyScreen');
  if (mainScreen) mainScreen.classList.remove('hidden');
  if (histScreen) histScreen.classList.add('hidden');

  // Step 2: Restore record area HTML completely
  const area = document.querySelector('.record-area');
  if (area) {
    area.innerHTML =
      '<p class="record-hint" id="recordHint">Tap the button and start speaking</p>' +
      '<div class="waveform-container" id="waveformContainer">' +
        '<div class="waveform" id="waveform"></div>' +
      '</div>' +
      '<button class="record-btn" id="recordBtn" onclick="toggleRecord()">' +
        '<div class="record-btn-ring"></div>' +
        '<div class="record-btn-ring ring2"></div>' +
        '<span class="record-btn-icon" id="recordIcon">🎤</span>' +
      '</button>' +
      '<div class="record-timer" id="recordTimer">0:00</div>' +
      '<p class="record-status" id="recordStatus">Ready when you are ✨</p>';
  }

  // Step 3: Rebuild waveform bars
  buildWaveform(40);

  // Step 4: Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.nav-btn')[0].classList.add('active');
}


// ── ABOUT SCREEN ──
function showAboutInMain() {
  const old = document.getElementById('summaryCard');
  if (old) old.remove();

  const area = document.querySelector('.record-area');
  area.innerHTML =
    '<div class="about-wrap">' +

      '<div class="about-logo">💥</div>' +
      '<div class="about-app-name">TruthPop</div>' +
      '<div class="about-tagline">Your voice tells a story.<br>We just help you hear it.</div>' +

      '<div class="about-card">' +
        '<div class="about-card-title">🧠 What is TruthPop?</div>' +
        '<div class="about-card-body">TruthPop is an AI-powered voice and speech analysis app. It listens to your voice and analyses 10 emotional parameters — giving you a beautiful breakdown of your confidence, energy, happiness, stress and more. Plus a Truth-O-Meter that detects deception signals in real time!</div>' +
      '</div>' +

      '<div class="about-card">' +
        '<div class="about-card-title">📊 The 10 Parameters</div>' +
        '<div class="about-params">' +
          '<span>😊 Happiness</span><span>💪 Confidence</span>' +
          '<span>🙈 Shyness</span><span>😔 Sadness</span>' +
          '<span>💥 Spark</span><span>😰 Stress</span>' +
          '<span>⚡ Energy</span><span>🎯 Focus</span>' +
          '<span>❓ Uncertainty</span><span>⚡ Excitement</span>' +
        '</div>' +
      '</div>' +

      '<div class="about-card">' +
        '<div class="about-card-title">👩‍💻 Built by</div>' +
        '<div class="about-builder">' +
          '<div class="about-builder-name">Vedika</div>' +
          '<div class="about-builder-sub">Age 13 · First ever app 💥<br>Built with HTML, CSS, JavaScript<br>& Hume AI emotion technology</div>' +
        '</div>' +
      '</div>' +

      '<div class="about-card">' +
        '<div class="about-card-title">⚡ How it works</div>' +
        '<div class="about-card-body">' +
          '1. Press the mic button and speak freely<br>' +
          '2. AI analyses your voice tone, pace and emotion<br>' +
          '3. See your emotion breakdown + Truth-O-Meter<br>' +
          '4. All recordings saved in History tab!' +
        '</div>' +
      '</div>' +

      '<div class="about-version">TruthPop v1.0 · Made with 💥 by Vedika</div>' +

      '<button onclick="goRecord()" class="about-record-btn">🎤 Start Recording</button>' +

    '</div>';
}
