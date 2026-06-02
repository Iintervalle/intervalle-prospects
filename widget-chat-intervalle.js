// ─── CONFIGURATION ────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://krcfiibyfvbraqidgfwc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyY2ZpaWJ5ZnZicmFxaWRnZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1Mzk0MDksImV4cCI6MjA5NTExNTQwOX0.mILfPxHddtY3fslYusAZkfRSZ7-AROD4Gb4Mp59Km6g'; // ← À remplacer

// Edge Function Supabase qui fait le proxy Claude API
// (à créer dans Supabase → Edge Functions, voir instructions ci-dessous)
const CLAUDE_PROXY_URL = `${SUPABASE_URL}/functions/v1/chat-intervalle`;

const SYSTEM_PROMPT = `Tu es l'assistant de L'Intervalle, une école de musiques actuelles à Paris (rock, jazz, funk, hip-hop, bossa nova). Tu réponds aux visiteurs sur le site.

Ton rôle : informer, rassurer, et amener naturellement les personnes intéressées à réserver une séance de présentation gratuite.

TON ET STYLE
- Chaleureux, décontracté, direct — comme quelqu'un de l'école qui connaît bien les lieux
- Pas trop formel, pas trop familier
- Tu utilises des emojis avec modération (1-2 par message max)
- Tes réponses sont courtes et claires — pas de pavés de texte
- Tu tutoies les gens naturellement, sauf s'ils te vouvoient

CE QUE TU SAIS SUR L'ÉCOLE
- Nom : L'Intervalle — 112 rue du Chemin Vert, Paris
- Email : ecole@lintervalle-studios.com — Instagram : @lintervalle_musique
- Ambiance : école de musiques actuelles avec buvette, jams, scènes ouvertes

Les cours : collectifs, 1h/semaine, tous niveaux. Guitare, basse, batterie, piano/claviers, chant.
Tarifs : 130 €/mois (guitare/basse/batterie/piano) — 140 €/mois (chant). 5 élèves max (3 pour chant).
Cours manqué = cours rattrapé. Ateliers gratuits inclus.
Les cours s'adressent autant aux débutants complets qu'aux musiciens expérimentés : ces derniers viennent souvent pour jouer en groupe, progresser sur un style précis, ou trouver une communauté musicale. Le format collectif est justement riche pour les bons musiciens — on apprend aussi des autres.

Parcours d'inscription : ① Séance de présentation (gratuite) ② Cours d'essai (gratuit) ③ Premier mois sans engagement ④ Inscription jusqu'à fin juin.
Réservation séance : https://koalendar.com/e/rdv-de-presentation-de-lecole-de-musique

Jams : 2+ par mois, Péniche Anako, Les Disquaires. Ouvert à tous.

CE QUE TU NE FAIS PAS
- Tu ne crées pas d'inscription, tu ne donnes pas de créneaux précis
- Tu n'inventes pas d'infos manquantes — tu dis que l'équipe pourra répondre
- Pour une aide humaine : "Je vais transmettre ça à l'équipe. Tu peux aussi les joindre à ecole@lintervalle-studios.com "`;

// ─── SESSION & ÉTAT ───────────────────────────────────────────────────────────
const SESSION_ID = 'web_' + Math.random().toString(36).slice(2, 11);
let isOpen = false;
let firstOpen = true;
let isLoading = false;
const localHistory = []; // historique en mémoire pour le contexte Claude

// ─── SUPABASE : SAUVEGARDER UN MESSAGE ───────────────────────────────────────
async function saveMessage(role, contenu) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/conversations_agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ session_id: SESSION_ID, canal: 'web', role, contenu })
    });
  } catch(e) { /* silencieux */ }
}

// ─── SUPABASE : LIRE L'HISTORIQUE ────────────────────────────────────────────
async function getHistory() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations_agent?session_id=eq.${SESSION_ID}&order=created_at.asc&limit=20`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await res.json();
    return (rows || []).map(r => ({ role: r.role, content: r.contenu }));
  } catch(e) { return []; }
}

// ─── APPEL CLAUDE API (via Edge Function) ────────────────────────────────────
async function callClaude(userText) {
  // On utilise l'historique local (fiable, sans délai Supabase)
  localHistory.push({ role: 'user', content: userText });

  const res = await fetch(CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [...localHistory]
    })
  });

  if (!res.ok) throw new Error('Erreur API');
  const data = await res.json();
  const reply = data.content[0].text;
  localHistory.push({ role: 'assistant', content: reply });
  return reply;
}

// ─── UI ───────────────────────────────────────────────────────────────────────
const messagesEl = document.getElementById('chatMessages');
const input = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const suggestionsEl = document.getElementById('suggestions');

function renderBotText(text) {
  // Nettoie le markdown et convertit les liens en <a>
  let t = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '');
  // Convertit [texte](url) en lien HTML
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" style="color:#5a19eb;text-decoration:underline;">$1</a>');
  // Convertit les URLs nues en liens
  t = t.replace(/(^|[^"])((https?:\/\/)[^\s<"]+)/g,
    '$1<a href="$2" target="_blank" style="color:#5a19eb;text-decoration:underline;">$2</a>');
  return t;
}

function addMessage(text, sender) {
  const msg = document.createElement('div');
  msg.className = `msg ${sender}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  if (sender === 'bot') {
    bubble.innerHTML = renderBotText(text);
  } else {
    bubble.textContent = text;
  }
  msg.appendChild(bubble);
  messagesEl.appendChild(msg);
  // Scroll pour que le haut du message soit visible
  setTimeout(() => {
    msg.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function showTyping() {
  const typing = document.createElement('div');
  typing.className = 'msg bot';
  typing.id = 'typing';
  typing.innerHTML = `<div class="typing-indicator">
    <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
  </div>`;
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typing');
  if (t) t.remove();
}

async function sendMessage(text) {
  if (!text.trim() || isLoading) return;
  isLoading = true;
  sendBtn.disabled = true;
  suggestionsEl.style.display = 'none';

  addMessage(text, 'user');
  input.value = '';
  await saveMessage('user', text);

  showTyping();
  try {
    const reply = await callClaude(text);
    removeTyping();
    addMessage(reply, 'bot');
    await saveMessage('assistant', reply);
  } catch(e) {
    removeTyping();
    addMessage("Désolé, une erreur est survenue. Tu peux nous écrire directement à ecole@lintervalle-studios.com ", 'bot');
  }

  isLoading = false;
  sendBtn.disabled = false;
}

function sendSuggestion(btn) { sendMessage(btn.textContent); }

sendBtn.addEventListener('click', () => sendMessage(input.value));
input.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(input.value); });
document.getElementById('closeBtn').addEventListener('click', toggleChat);

function toggleChat() {
  isOpen = !isOpen;
  document.getElementById('chat-toggle').classList.toggle('active', isOpen);
  document.getElementById('chat-window').classList.toggle('open', isOpen);

  if (isOpen && firstOpen) {
    firstOpen = false;
    setTimeout(async () => {
      showTyping();
      await new Promise(r => setTimeout(r, 700));
      removeTyping();
      const welcome = "Bonjour  Bienvenue à L'Intervalle ! Je peux t'aider sur les cours, les jams, les studios ou autre chose. C'est quoi ta question ?";
      addMessage(welcome, 'bot');
      localHistory.push({ role: 'assistant', content: welcome });
      await saveMessage('assistant', welcome);
    }, 200);
  }
}

// Ouverture automatique après 8 secondes (desktop uniquement)
if (window.innerWidth > 768) {
  setTimeout(() => {
    if (!isOpen) toggleChat();
  }, 8000);
}
