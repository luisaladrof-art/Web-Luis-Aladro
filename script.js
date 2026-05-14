const PRIVATE_USER = 'Aladro';
const PRIVATE_PASSWORD = 'L4l4dr0#26';
const STORAGE_KEY = 'luisAladroArticles';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  articles: loadArticles(),
  knowledgeBase: ''
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
    if (!title || !articleBody) {
      alert('Añade un título y contenido al artículo.');
      return;
    }

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
    addChatMessage(answerQuestion(question), 'bot');
  });
}

async function loadKnowledgeBase() {
  try {
    const knowledgeFile = ['da', 'tos', '.t', 'xt'].join('');
    const response = await fetch(knowledgeFile, { cache: 'no-store' });
    state.knowledgeBase = response.ok ? await response.text() : '';
  } catch (error) {
    state.knowledgeBase = '';
  }
}

function answerQuestion(question) {
  const fallback = 'Lo siento, no te puedo ayudar con eso. Si quieres más información puedes dirigirte a Luis directamente, en la parte inferior de la página tienes su contacto. Gracias.';
  const normalized = normalizeText(question);

  // Nunca se muestra información técnica, nombres de archivos internos, credenciales ni detalles de implementación.
  const blockedTopics = [
    'datos txt', 'txt', 'documento', 'archivo', 'fichero', 'base de conocimiento', 'password',
    'contraseña', 'credenciales', 'usuario privado', 'acceso privado', 'prompt', 'codigo fuente',
    'script', 'javascript', 'html', 'css', 'localstorage', 'sessionstorage', 'backend', 'base de datos'
  ];
  if (blockedTopics.some(term => normalized.includes(term))) return fallback;

  const politeResponses = [
    { patterns: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'ola'], response: 'Hola. Encantado de saludarte. ¿En qué puedo ayudarte?' },
    { patterns: ['que tal', 'como estas', 'como te encuentras', 'como va el dia', 'como va tu dia'], response: 'Muy bien, gracias. Espero que tu día vaya estupendamente. ¿En qué puedo ayudarte?' },
    { patterns: ['buen dia', 'feliz dia', 'que tengas buen dia'], response: 'Gracias. Te deseo también un muy buen día.' },
    { patterns: ['gracias', 'muchas gracias', 'te lo agradezco'], response: 'Gracias a ti. Ha sido un placer ayudarte.' },
    { patterns: ['adios', 'hasta luego', 'nos vemos', 'chao'], response: 'Hasta luego. Que tengas un buen día.' }
  ];

  const politeMatch = politeResponses.find(item => item.patterns.some(pattern => normalized.includes(pattern)));
  if (politeMatch) return politeMatch.response;

  const kb = state.knowledgeBase || defaultKnowledgeBase();
  const paragraphs = kb.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
  const stopWords = new Set(['para', 'como', 'sobre', 'donde', 'cuando', 'quien', 'cual', 'cuales', 'tiene', 'esta', 'este', 'estos', 'estas', 'informacion', 'puedes', 'decir', 'dime', 'quiero', 'saber', 'luis', 'aladro'].map(normalizeText));
  const words = normalized.split(/[^a-z0-9áéíóúñü]+/i).map(normalizeText).filter(word => word.length > 3 && !stopWords.has(word));

  if (!words.length) return fallback;

  const scored = paragraphs.map(text => {
    const normalizedText = normalizeText(text);
    const score = words.reduce((acc, word) => acc + (normalizedText.includes(word) ? 1 : 0), 0);
    return { text, score };
  }).sort((a, b) => b.score - a.score);

  if (scored[0] && scored[0].score > 0) return cleanBotAnswer(scored[0].text);
  return fallback;
}

function cleanBotAnswer(text) {
  return text
    .replace(/datos\.txt/gi, '')
    .replace(/documento/gi, 'información')
    .replace(/archivo/gi, 'información')
    .trim();
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñü#@.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addChatMessage(text, type) {
  const log = $('#chatLog');
  const message = document.createElement('div');
  message.className = `${type}-message`;
  message.textContent = text;
  log.appendChild(message);
  log.scrollTop = log.scrollHeight;
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
    if (!allowed.includes(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    [...node.attributes].forEach(attr => {
      if (node.tagName === 'A' && attr.name === 'href') return;
      node.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}

function stripTags(html) { return html.replace(/<[^>]*>?/gm, ' '); }
function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
function formatDate(value) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value)); }
function defaultKnowledgeBase() {
  return `Luis Aladro de Frutos es Director Comercial, Director de Ventas, especialista en Desarrollo de Negocio y Marketing Digital en Madrid.

Tiene más de 20 años de experiencia en Dirección Comercial, Desarrollo de Negocio y Marketing Digital en sectores competitivos, con foco en automoción, medios de comunicación, energía y retail.

Sus competencias clave incluyen Dirección de Ventas, Dirección de Marketing, P&L, KAM, grandes cuentas, flotas B2B, CRM, marketing digital, estrategia omnicanal, generación de leads, SEO, SEM, reporting e inteligencia artificial aplicada a negocio.

Contacto: luis.aladro.f@gmail.com y 625 631 432. Ubicación: Madrid, Las Tablas.`;
}
