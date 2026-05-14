const PRIVATE_USER = 'Aladro';
const PRIVATE_PASSWORD = 'L4l4dr0#26';
const STORAGE_KEY = 'luisAladroArticles';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  articles: loadArticles(),
  knowledgeBase: '',
  userName: null,
  askingName: false
};

document.addEventListener('DOMContentLoaded', () => {
  $('#currentYear').textContent = new Date().getFullYear();
  setupNavigation();
  setupRevealAnimations();
  setupPrivatePanel();
  setupEditor();
  setupArticles();
  setupChatbot();
  loadKnowledgeBase();
});

function setupNavigation() {
  const menuToggle = $('.menu-toggle');
  const nav = $('.main-nav');
  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
  $$('.main-nav a').forEach(link => link.addEventListener('click', () => nav.classList.remove('open')));

  const sections = ['inicio', 'curriculum', 'articulos', 'contacto'].map(id => document.getElementById(id));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        $$('.main-nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === entry.target.id));
      }
    });
  }, { rootMargin: '-40% 0px -50% 0px', threshold: 0.01 });
  sections.forEach(section => observer.observe(section));
}

function setupRevealAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  $$('.reveal').forEach(el => observer.observe(el));
}

function setupPrivatePanel() {
  const panel = $('#privatePanel');
  const loginForm = $('#loginForm');
  const loginView = $('#loginView');
  const editorView = $('#editorView');

  $('#openLogin').addEventListener('click', () => openPanel());
  $$('[data-close-panel]').forEach(el => el.addEventListener('click', () => closePanel()));

  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const user = $('#username').value.trim();
    const password = $('#password').value;
    if (user === PRIVATE_USER && password === PRIVATE_PASSWORD) {
      sessionStorage.setItem('privateAccess', 'true');
      $('#loginError').textContent = '';
      loginView.hidden = true;
      editorView.hidden = false;
      $('#articleTitle').focus();
    } else {
      $('#loginError').textContent = 'Usuario o contraseña incorrectos.';
    }
  });

  $('#logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('privateAccess');
    loginView.hidden = false;
    editorView.hidden = true;
    loginForm.reset();
  });

  function openPanel() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    const hasAccess = sessionStorage.getItem('privateAccess') === 'true';
    loginView.hidden = hasAccess;
    editorView.hidden = !hasAccess;
    setTimeout(() => (hasAccess ? $('#articleTitle') : $('#username')).focus(), 50);
  }

  function closePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }
}

function setupEditor() {
  const form = $('#articleForm');
  const body = $('#articleBody');
  const imageOne = $('#imageOne');
  const imageTwo = $('#imageTwo');

  $$('.editor-toolbar button').forEach(button => {
    button.addEventListener('click', () => {
      body.focus();
      document.execCommand(button.dataset.command, false, button.dataset.value || null);
    });
  });

  [imageOne, imageTwo].forEach(input => input.addEventListener('change', updateImagePreview));
  $('#clearEditor').addEventListener('click', () => resetEditor());

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const title = $('#articleTitle').value.trim();
    const articleBody = sanitizeHtml(body.innerHTML.trim());
    if (!title || !articleBody) { alert('Añade un título y contenido al artículo.'); return; }

    const images = await Promise.all([fileToDataUrl(imageOne.files[0]), fileToDataUrl(imageTwo.files[0])]);
    const article = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title,
      subtitle: $('#articleSubtitle').value.trim(),
      tags: $('#articleTags').value.split(',').map(tag => tag.trim()).filter(Boolean),
      body: articleBody,
      images: images.filter(Boolean),
      createdAt: new Date().toISOString()
    };
    state.articles.unshift(article);
    saveArticles();
    renderArticles();
    resetEditor();
    alert('Artículo publicado correctamente.');
    location.hash = '#articulos';
  });
}

function updateImagePreview() {
  const preview = $('#imagePreview');
  preview.innerHTML = '';
  [$('#imageOne').files[0], $('#imageTwo').files[0]].filter(Boolean).forEach(file => {
    const img = document.createElement('img');
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  });
}

function setupArticles() {
  $('#searchArticles').addEventListener('input', renderArticles);
  $('#sortArticles').addEventListener('change', renderArticles);
  renderArticles();
}

function renderArticles() {
  const grid = $('#articlesGrid');
  const query = $('#searchArticles')?.value?.toLowerCase() || '';
  const sort = $('#sortArticles')?.value || 'newest';
  grid.innerHTML = '';

  let articles = [...state.articles].filter(article => {
    const haystack = [article.title, article.subtitle, article.tags.join(' '), stripTags(article.body)].join(' ').toLowerCase();
    return haystack.includes(query);
  });

  articles.sort((a, b) => {
    if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sort === 'title') return a.title.localeCompare(b.title, 'es');
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  if (!articles.length) {
    grid.appendChild($('#emptyArticlesTemplate').content.cloneNode(true));
    return;
  }

  articles.forEach(article => {
    const card = document.createElement('article');
    card.className = 'article-card';
    const cover = article.images[0] ? `<img src="${article.images[0]}" alt="Imagen del artículo ${escapeHtml(article.title)}">` : '';
    const tags = article.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('');
    card.innerHTML = `
      ${cover}
      <div class="article-card-content">
        <time datetime="${article.createdAt}">${formatDate(article.createdAt)}</time>
        <h3>${escapeHtml(article.title)}</h3>
        ${article.subtitle ? `<p>${escapeHtml(article.subtitle)}</p>` : ''}
        ${tags ? `<div class="tags">${tags}</div>` : ''}
        <div class="article-body">${article.body}</div>
        ${article.images[1] ? `<img src="${article.images[1]}" alt="Imagen complementaria del artículo ${escapeHtml(article.title)}">` : ''}
        <button class="secondary-action small" data-delete="${article.id}">Eliminar</button>
      </div>`;
    grid.appendChild(card);
  });

  $$('[data-delete]').forEach(button => button.addEventListener('click', () => {
    if (sessionStorage.getItem('privateAccess') !== 'true') {
      alert('Debes acceder al área privada para eliminar artículos.');
      return;
    }
    state.articles = state.articles.filter(article => article.id !== button.dataset.delete);
    saveArticles();
    renderArticles();
  }));
}

/* ─────────────────────────────────────────────
   CHATBOT
───────────────────────────────────────────── */
function setupChatbot() {
  const chatbot = $('#chatbot');

  $('#chatToggle').addEventListener('click', () => {
    chatbot.classList.add('open');
    chatbot.setAttribute('aria-hidden', 'false');
    $('#chatInput').focus();
  });

  $('#closeChat').addEventListener('click', () => {
    chatbot.classList.remove('open');
    chatbot.setAttribute('aria-hidden', 'true');
  });

  $('#chatForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#chatInput');
    const question = input.value.trim();
    if (!question) return;
    addChatMessage(question, 'user');
    input.value = '';
    setTimeout(() => addChatMessage(buildReply(question), 'bot'), 380);
  });
}

function buildReply(input) {
  const txt = normalizeText(input);

  /* Seguridad: bloquear preguntas sobre código, archivos o credenciales */
  const blockedTopics = [
    'fichero', 'base de conocimiento', 'password', 'contraseña', 'credenciales',
    'usuario privado', 'acceso privado', 'prompt', 'codigo fuente', 'script',
    'javascript', 'html', 'css', 'localstorage', 'sessionstorage', 'backend', 'base de datos'
  ];
  if (blockedTopics.some(term => txt.includes(term))) {
    return 'Lo siento, no puedo ayudarte con ese tema. En la parte inferior de la página tienes los datos de contacto de Luis. ¡Gracias!';
  }

  /* El bot preguntó el nombre y el usuario contesta */
  if (state.askingName) {
    state.askingName = false;
    const firstName = input.trim().split(' ')[0];
    state.userName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    return `¡Encantado de conocerte, ${state.userName}! 😊 ¿En qué puedo ayudarte hoy?`;
  }

  /* Saludos */
  const saludos = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'ola', 'hi', 'hello'];
  if (saludos.some(s => txt === s || txt.startsWith(s + ' ') || txt.endsWith(' ' + s))) {
    if (state.userName) {
      return `¡Hola de nuevo, ${state.userName}! ¿Cómo te va el día? ¿En qué puedo ayudarte?`;
    }
    state.askingName = true;
    return '¡Hola! ¿Cómo estás? Me alegra que estés aquí. ¿Cómo te llamas?';
  }

  /* Cortesías y frases sociales */
  const cortesias = [
    { keys: ['que tal', 'como estas', 'como te encuentras', 'como va el dia', 'como va tu dia'],
      reply: () => `¡Muy bien${state.userName ? ', ' + state.userName : ''}, gracias por preguntar! 😊 ¿Y a ti cómo te va el día?` },
    { keys: ['como te llamas', 'cual es tu nombre', 'quien eres'],
      reply: () => { state.askingName = true; return '¡Me llamo Asistente Virtual de Luis! ¿Y tú cómo te llamas?'; } },
    { keys: ['buen dia', 'feliz dia', 'que tengas buen dia'],
      reply: () => `¡Gracias! Te deseo también un muy buen día${state.userName ? ', ' + state.userName : ''}. 😊` },
    { keys: ['gracias', 'muchas gracias', 'te lo agradezco'],
      reply: () => `¡Gracias a ti${state.userName ? ', ' + state.userName : ''}! Ha sido un placer ayudarte.` },
    { keys: ['adios', 'hasta luego', 'nos vemos', 'chao', 'bye'],
      reply: () => `¡Hasta luego${state.userName ? ', ' + state.userName : ''}! Que tengas un estupendo día. 👋` }
  ];

  for (const c of cortesias) {
    if (c.keys.some(k => txt.includes(k))) return c.reply();
  }

  /* Búsqueda en base de conocimiento */
  const kb = state.knowledgeBase || defaultKnowledgeBase();
  const paragraphs = kb.split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
  const stopWords = new Set(
    ['para', 'como', 'sobre', 'donde', 'cuando', 'quien', 'cual', 'cuales', 'tiene',
     'esta', 'este', 'estos', 'estas', 'informacion', 'puedes', 'decir', 'dime',
     'quiero', 'saber', 'luis', 'aladro'].map(normalizeText)
  );
  const words = txt.split(/[^a-z0-9]+/).filter(w => w.length > 3 && !stopWords.has(w));

  if (words.length) {
    const scored = paragraphs
      .map(text => ({ text, score: words.reduce((acc, w) => acc + (normalizeText(text).includes(w) ? 1 : 0), 0) }))
      .sort((a, b) => b.score - a.score);
    if (scored[0]?.score > 0) return cleanBotAnswer(scored[0].text);
  }

  /* Fallback educado */
  const disculpa = state.userName ? `Lo siento, ${state.userName}` : 'Lo siento';
  return `${disculpa}, no tengo información sobre ese tema. En la parte inferior de la página encontrarás los datos de contacto de Luis; mejor consúltale directamente a él. ¡Gracias! 🙏`;
}

function cleanBotAnswer(text) {
  return text
    .replace(/datos\.txt/gi, '')
    .replace(/\bdocumento\b/gi, 'información')
    .replace(/\barchivo\b/gi, 'información')
    .trim();
}

async function loadKnowledgeBase() {
  try {
    const response = await fetch('datos.txt', { cache: 'no-store' });
    state.knowledgeBase = response.ok ? await response.text() : '';
  } catch {
    state.knowledgeBase = '';
  }
}

function addChatMessage(text, type) {
  const log = $('#chatLog');
  const message = document.createElement('div');
  message.className = `${type}-message`;
  message.textContent = text;
  log.appendChild(message);
  log.scrollTop = log.scrollHeight;
}

/* ─────────────────────────────────────────────
   UTILIDADES
───────────────────────────────────────────── */
function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadArticles() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveArticles() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.articles)); }

function resetEditor() {
  $('#articleForm').reset();
  $('#articleBody').innerHTML = '';
  $('#imagePreview').innerHTML = '';
}

function fileToDataUrl(file) {
  if (!file) return Promise.resolve(null);
  if (!file.type.startsWith('image/')) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const allowed = ['B', 'I', 'STRONG', 'EM', 'UL', 'OL', 'LI', 'P', 'BR', 'H3', 'H4', 'A'];
  template.content.querySelectorAll('*').forEach(node => {
    if (!allowed.includes(node.tagName)) { node.replaceWith(...node.childNodes); return; }
    [...node.attributes].forEach(attr => {
      if (node.tagName === 'A' && attr.name === 'href') return;
      node.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}

function stripTags(html) { return html.replace(/<[^>]*>?/gm, ' '); }
function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function formatDate(value) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value)); }

function defaultKnowledgeBase() {
  return `Luis Aladro de Frutos es Director Comercial, Director de Ventas, especialista en Desarrollo de Negocio y Marketing Digital en Madrid, Las Tablas.

Tiene más de 20 años de experiencia en Dirección Comercial, Desarrollo de Negocio y Marketing Digital en sectores competitivos, con foco en automoción, medios de comunicación, energía y retail. Gestiona presupuestos superiores a 600.000 euros con foco en ROI, KPIs y rentabilidad.

Sus competencias clave incluyen Dirección de Ventas VN y VO, Dirección de Marketing, Desarrollo de Negocio, Estrategia Comercial, P&L y Presupuestos, KAM, grandes cuentas, flotas B2B, liderazgo y coaching de equipos, CRM Salesforce HubSpot Imaweb, Marketing Digital, Transformación Digital, Estrategia Omnicanal, Generación de Leads, SEO, SEM, Google Analytics, Meta Business Suite, Forecasting, Reporting, apertura de centros e Inteligencia Artificial aplicada a negocio.

Desde enero de 2018 trabaja en Grupo Gil Automoción como Director de Marketing y Ventas. Gestiona ventas multimarca en vehículo nuevo y de ocasión, productos financieros, estrategia 360 omnicanal, campañas Google Ads y Meta Business Suite, apertura de concesionarios en Madrid y las marcas AutoestrenaGil.es y OcasionGil.es.

Experiencia anterior: Director de Publicidad en El Distrito Comunicación (2014-2017). Director Comercial VN VO y Director de Desarrollo en Grupo CMS con marcas BMW MINI Opel Chevrolet (2008-2014). Director de Desarrollo de Negocio en Dilab Sunglasses (2007-2008). Director de Desarrollo y Grandes Cuentas en Prevensis con clientes BP Endesa Iberdrola Repsol HP (2005-2007). Formador Freelance en TIC (1999-2005). Gestión de negocio familiar en Fruar S.A. Agencia Renault (1986-2002).

Más de 25 años de experiencia en automoción. Más de 30 años en ventas. Más de 10 años como formador.

Formación: Ingeniería Técnica Industrial, Técnico Especialista en Electrónica Industrial, Dirección de Marketing y Ventas, Programa Avanzado de Transformación Digital, The PowerMBA Business & Strategy Program, Formación en IA Aplicada a Negocio (2024-2026).

Herramientas: Salesforce, HubSpot, Imaweb, DMS, Google Analytics, Google Ads, Meta Business Suite, SEMrush, ChatGPT, Claude, Gemini, Grok, Perplexity, NotebookLM, Kimi, Microsoft Office, Adobe Photoshop, Premiere Pro, Illustrator y Canva.

Idiomas: Español nativo, Inglés B1 intermedio, Francés B1 intermedio. Carnés de conducir AM A1 A2 A B BE C1 C1E y C.

Contacto: email luis.aladro.f@gmail.com, teléfono 625 631 432, ubicación Madrid Las Tablas.`;
}
