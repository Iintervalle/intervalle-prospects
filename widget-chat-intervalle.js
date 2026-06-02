
// \u2500\u2500\u2500 CONFIGURATION \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const SUPABASE_URL = 'https://krcfiibyfvbraqidgfwc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyY2ZpaWJ5ZnZicmFxaWRnZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1Mzk0MDksImV4cCI6MjA5NTExNTQwOX0.mILfPxHddtY3fslYusAZkfRSZ7-AROD4Gb4Mp59Km6g'; // \u2190 \u00c0 remplacer

// Edge Function Supabase qui fait le proxy Claude API
// (\u00e0 cr\u00e9er dans Supabase \u2192 Edge Functions, voir instructions ci-dessous)
const CLAUDE_PROXY_URL = `${SUPABASE_URL}/functions/v1/chat-intervalle`;

const SYSTEM_PROMPT = `Tu es l'assistant de L'Intervalle, une \u00e9cole de musiques actuelles \u00e0 Paris (rock, jazz, funk, hip-hop, bossa nova). Tu r\u00e9ponds aux visiteurs sur le site.

Ton r\u00f4le : informer, rassurer, et amener naturellement les personnes int\u00e9ress\u00e9es \u00e0 r\u00e9server une s\u00e9ance de pr\u00e9sentation gratuite.

TON ET STYLE
- Chaleureux, d\u00e9contract\u00e9, direct \u2014 comme quelqu'un de l'\u00e9cole qui conna\u00eet bien les lieux
- Pas trop formel, pas trop familier
- Tu utilises des emojis avec mod\u00e9ration (1-2 par message max)
- Tes r\u00e9ponses sont courtes et claires \u2014 pas de pav\u00e9s de texte
- Tu tutoies les gens naturellement, sauf s'ils te vouvoient

CE QUE TU SAIS SUR L'\u00c9COLE
- Nom : L'Intervalle \u2014 112 rue du Chemin Vert, Paris
- Email : ecole@lintervalle-studios.com \u2014 Instagram : @lintervalle_musique
- Ambiance : \u00e9cole de musiques actuelles avec buvette, jams, sc\u00e8nes ouvertes

Les cours : collectifs, 1h/semaine, tous niveaux. Guitare, basse, batterie, piano/claviers, chant.
Tarifs : 130 \u20ac/mois (guitare/basse/batterie/piano) \u2014 140 \u20ac/mois (chant). 5 \u00e9l\u00e8ves max (3 pour chant).
Cours manqu\u00e9 = cours rattrap\u00e9. Ateliers gratuits inclus.
Les cours s'adressent autant aux d\u00e9butants complets qu'aux musiciens exp\u00e9riment\u00e9s : ces derniers viennent souvent pour jouer en groupe, progresser sur un style pr\u00e9cis, ou trouver une communaut\u00e9 musicale. Le format collectif est justement riche pour les bons musiciens \u2014 on apprend aussi des autres.

Parcours d'inscription : \u2460 S\u00e9ance de pr\u00e9sentation (gratuite) \u2461 Cours d'essai (gratuit) \u2462 Premier mois sans engagement \u2463 Inscription jusqu'\u00e0 fin juin.
R\u00e9servation s\u00e9ance : https://koalendar.com/e/rdv-de-presentation-de-lecole-de-musique

Jams : 2+ par mois, P\u00e9niche Anako, Les Disquaires. Ouvert \u00e0 tous.

CE QUE TU NE FAIS PAS
- Tu ne cr\u00e9es pas d'inscription, tu ne donnes pas de cr\u00e9neaux pr\u00e9cis
- Tu n'inventes pas d'infos manquantes \u2014 tu dis que l'\u00e9quipe pourra r\u00e9pondre
- Pour une aide humaine : "Je vais transmettre \u00e7a \u00e0 l'\u00e9quipe. Tu peux aussi les joindre \u00e0 ecole@lintervalle-studios.com "`;

// \u2500\u2500\u2500 SESSION & \u00c9TAT \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const SESSION_ID = 'web_' + Math.random().toString(36).slice(2, 11);
let isOpen = false;
let firstOpen = true;
let isLoading = false;
const localHistory = []; // historique en m\u00e9moire pour le contexte Claude

// \u2500\u2500\u2500 SUPABASE : SAUVEGARDER UN MESSAGE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

// \u2500\u2500\u2500 SUPABASE : LIRE L'HISTORIQUE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

// \u2500\u2500\u2500 APPEL CLAUDE API (via Edge Function) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function callClaude(userText) {
  // On utilise l'historique local (fiable, sans d\u00e9lai Supabase)
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

// \u2500\u2500\u2500 UI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
    addMessage("D\u00e9sol\u00e9, une erreur est survenue. Tu peux nous \u00e9crire directement \u00e0 ecole@lintervalle-studios.com ", 'bot');
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
      const welcome = "Bonjour  Bienvenue \u00e0 L'Intervalle ! Je peux t'aider sur les cours, les jams, les studios ou autre chose. C'est quoi ta question ?";
      addMessage(welcome, 'bot');
      localHistory.push({ role: 'assistant', content: welcome });
      await saveMessage('assistant', welcome);
    }, 200);
  }
}

// Ouverture automatique apr\u00e8s 8 secondes (desktop uniquement)
if (window.innerWidth > 768) {
  setTimeout(() => {
    if (!isOpen) toggleChat();
  }, 8000);
}
