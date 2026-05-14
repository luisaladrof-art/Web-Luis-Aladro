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
  const fallback = 'Lo siento, no tengo información suficiente para responder a eso con precisión. Puedes contactar directamente con Luis en la parte inferior de la página.';
  const normalized = normalizeText(question);

  // Prompt operativo del chatbot.
  // En esta web estática no hay un system prompt real de OpenAI; por eso las reglas se aplican aquí, en JavaScript.
  // Objetivo: interpretar la pregunta, elegir intención, calcular duraciones cuando proceda y no pegar bloques largos de datos.txt.

  const blockedTopics = [
    'datos txt', 'txt', 'documento interno', 'archivo interno', 'fichero interno', 'base de conocimiento',
    'password', 'contraseña', 'credenciales', 'usuario privado', 'acceso privado', 'prompt', 'codigo fuente',
    'script', 'javascript', 'html', 'css', 'localstorage', 'sessionstorage', 'backend', 'base de datos'
  ];
  if (blockedTopics.some(term => normalized.includes(normalizeText(term)))) return fallback;

  const politeResponses = [
    { patterns: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'ola'], response: 'Hola. Soy el asistente virtual de Luis. ¿Qué quieres saber sobre su experiencia, formación, competencias o contacto?' },
    { patterns: ['que tal', 'como estas', 'como te encuentras', 'como va el dia', 'como va tu dia'], response: 'Muy bien, gracias. Puedo ayudarte con información profesional sobre Luis: experiencia, dirección comercial, marketing, automoción, formación, herramientas o contacto.' },
    { patterns: ['gracias', 'muchas gracias', 'te lo agradezco'], response: 'Gracias a ti. Ha sido un placer ayudarte.' },
    { patterns: ['adios', 'hasta luego', 'nos vemos', 'chao'], response: 'Hasta luego. Que tengas un buen día.' }
  ];

  const politeMatch = politeResponses.find(item => item.patterns.some(pattern => normalized.includes(pattern)));
  if (politeMatch) return politeMatch.response;

  const hasAny = (terms) => terms.some(term => normalized.includes(normalizeText(term)));
  const asksYears = hasAny(['cuanto', 'cuantos años', 'años', 'tiempo', 'desde cuando', 'durante cuanto']);

  const current = new Date();
  const yearsSinceJan2018 = yearsBetween(new Date(2018, 0, 1), current);
  const yearsCommercialStrict = Math.round((6 + yearsSinceJan2018) * 10) / 10;
  const yearsMarketingDirector = yearsSinceJan2018;

  // Intenciones específicas primero. Esto evita que "experiencia comercial" caiga en una respuesta genérica.
  if (asksYears && hasAny(['director de marketing', 'direccion de marketing', 'marketing y ventas'])) {
    return `Como Director de Marketing y Ventas, Luis trabaja desde enero de 2018 en Grupo Gil Automoción. Eso supone aproximadamente ${formatYears(yearsMarketingDirector)} hasta la actualidad. En ese puesto dirige marketing y ventas multimarca, campañas online y offline, estrategia omnicanal, transformación digital, generación de leads y aperturas de concesionarios.`;
  }

  if (asksYears && hasAny(['director comercial', 'direccion comercial', 'director de ventas', 'direccion de ventas'])) {
    return `En puestos directamente vinculados a dirección comercial y dirección de ventas, Luis acumula aproximadamente ${formatYears(yearsCommercialStrict)}: de 2008 a 2014 como Director Comercial VN y VO / Director de Desarrollo en Grupo CMS, y desde enero de 2018 hasta la actualidad como Director de Marketing y Ventas en Grupo Gil Automoción. Si se considera toda su trayectoria comercial, de ventas y desarrollo de negocio, la experiencia supera los 20 años.`;
  }

  if (asksYears && hasAny(['comercial', 'ventas', 'desarrollo de negocio', 'b2b', 'b2c', 'grandes cuentas', 'kam'])) {
    return 'Luis tiene más de 20 años de experiencia comercial. Esa trayectoria incluye dirección de ventas, dirección comercial, desarrollo de negocio, grandes cuentas, gestión B2B y B2C, automoción VN y VO, publicidad, retail y gestión de equipos comerciales.';
  }

  if (asksYears && hasAny(['experiencia profesional', 'trayectoria profesional', 'trabajado', 'carrera profesional', 'profesional'])) {
    return 'Luis cuenta con más de 20 años de experiencia profesional en Dirección Comercial, Dirección de Ventas, Desarrollo de Negocio y Marketing Digital, principalmente en automoción, medios de comunicación, energía y retail.';
  }

  if (hasAny(['contacto', 'email', 'correo', 'telefono', 'llamar', 'ubicacion', 'donde esta', 'localizacion'])) {
    return 'Puedes contactar con Luis Aladro por email en luis.aladro.f@gmail.com o por teléfono en el 625 631 432. Su ubicación profesional es Madrid, Las Tablas.';
  }

  if (hasAny(['formacion', 'estudios', 'academica', 'titulacion', 'power mba', 'powermba', 'transformacion digital', 'ingenieria', 'electronica'])) {
    return 'Luis cuenta con formación en IA aplicada a negocio, The PowerMBA Business & Strategy Program, Programa Avanzado de Transformación Digital, Dirección de Marketing y Ventas, Ingeniería Técnica Industrial y Técnico Especialista en Electrónica Industrial.';
  }

  if (hasAny(['herramientas', 'tecnologia', 'crm', 'salesforce', 'hubspot', 'imaweb', 'google analytics', 'google ads', 'meta', 'semrush', 'chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'notebooklm', 'kimi', 'office', 'photoshop', 'premiere', 'illustrator', 'canva'])) {
    return 'Luis trabaja con CRM como Salesforce, HubSpot e Imaweb; herramientas de marketing digital como Google Analytics, Google Ads, Meta Business Suite y SEMrush; herramientas de IA como ChatGPT, Claude, Gemini, Grok, Perplexity, NotebookLM y Kimi; Microsoft Office avanzado; y herramientas de diseño y contenido como Photoshop, Premiere Pro, Illustrator y Canva.';
  }

  if (hasAny(['idioma', 'idiomas', 'ingles', 'frances', 'español', 'carnet', 'carne', 'conducir'])) {
    return 'Luis tiene español nativo, inglés B1 intermedio y francés B1 intermedio. También dispone de carnés de conducir AM, A1, A2, A, B, BE, C1, C1E y C.';
  }

  if (hasAny(['experiencia actual', 'actualidad', 'trabajo actual', 'puesto actual', 'grupo gil'])) {
    return 'Actualmente Luis es Director de Marketing y Ventas en Grupo Gil Automoción desde enero de 2018. Dirige marketing y ventas multimarca de vehículo nuevo y de ocasión, gestiona presupuestos, campañas omnicanal, transformación digital, generación de leads y aperturas de nuevos concesionarios en Madrid.';
  }

  if (hasAny(['automocion', 'vehiculo', 'vehiculos', 'vn', 'vo', 'concesionario', 'concesionarios', 'flotas', 'grupo gil', 'cms', 'bmw', 'mini', 'opel', 'mazda', 'mitsubishi', 'mg', 'ocasion', 'autoestrena'])) {
    return 'En automoción, Luis tiene una trayectoria amplia en vehículo nuevo multimarca y vehículo de ocasión. Actualmente dirige marketing y ventas en Grupo Gil Automoción, con responsabilidad sobre estrategia omnicanal, campañas online y offline, gestión presupuestaria, apertura de concesionarios y marcas como AutoestrenaGil.es y OcasionGil.es. Anteriormente trabajó en Grupo CMS con marcas BMW, MINI, Opel y Chevrolet, incluyendo dirección comercial, gestión de equipos, flotas B2B, stock y vehículos de ocasión.';
  }

  if (hasAny(['experiencia comercial', 'area comercial', 'perfil comercial', 'ventas', 'comercial', 'direccion comercial', 'desarrollo de negocio', 'grandes cuentas', 'kam', 'b2b', 'b2c', 'p&l', 'presupuesto', 'rentabilidad', 'roi', 'kpi'])) {
    return 'La experiencia comercial de Luis supera los 20 años. Incluye Dirección de Ventas, Dirección Comercial VN y VO, Desarrollo de Negocio, gestión B2B y B2C, negociación con grandes cuentas, KAM, flotas, gestión de P&L y presupuestos superiores a 600.000 euros, seguimiento de KPIs, ROI y rentabilidad.';
  }

  if (hasAny(['marketing', 'marketing digital', 'seo', 'sem', 'leads', 'omnicanal', 'campañas', 'campanas', 'analytics', 'meta business', 'google ads'])) {
    return 'En marketing digital, Luis tiene experiencia en estrategia 360º omnicanal, generación de leads, SEO, SEM, Google Analytics, Google Ads, Meta Business Suite, SEMrush, reporting y campañas online y offline orientadas a objetivos comerciales.';
  }

  if (hasAny(['inteligencia artificial', 'ia', 'ai', 'aplicada a negocio'])) {
    return 'Luis está orientado a la Inteligencia Artificial aplicada a negocio, especialmente como apoyo a ventas, marketing, transformación digital, análisis, productividad y generación de oportunidades comerciales.';
  }

  if (hasAny(['competencias', 'habilidades', 'especialidades', 'capacidades', 'puntos fuertes', 'que sabe hacer'])) {
    return 'Sus competencias clave incluyen Dirección de Ventas VN y VO, Dirección de Marketing, Desarrollo de Negocio, Estrategia Comercial, P&L y presupuestos, Key Account Management, negociación con grandes cuentas, gestión de flotas B2B, liderazgo de equipos, CRM, Marketing Digital, Transformación Digital, estrategia omnicanal, generación de leads, SEO, SEM, reporting e Inteligencia Artificial aplicada a negocio.';
  }

  if (hasAny(['experiencia', 'trayectoria', 'profesional', 'carrera', 'trabajos', 'puestos', 'empresas', 'curriculum', 'cv'])) {
    return 'Luis Aladro es un ejecutivo senior con más de 20 años de experiencia en Dirección Comercial, Dirección de Ventas, Desarrollo de Negocio y Marketing Digital. Ha trabajado en automoción, medios de comunicación, energía y retail, con responsabilidades en gestión de equipos, P&L, grandes cuentas, transformación digital, CRM, generación de leads y estrategia omnicanal.';
  }

  // Búsqueda secundaria en datos.txt: solo si hay términos suficientes y coincidencia clara.
  const kb = state.knowledgeBase || defaultKnowledgeBase();
  const paragraphs = kb.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
  const stopWords = new Set(['para', 'como', 'sobre', 'donde', 'cuando', 'quien', 'cual', 'cuales', 'tiene', 'esta', 'este', 'estos', 'estas', 'informacion', 'puedes', 'decir', 'dime', 'quiero', 'saber', 'luis', 'aladro', 'experiencia', 'perfil', 'profesional'].map(normalizeText));
  const words = normalized.split(/[^a-z0-9áéíóúñü]+/i).map(normalizeText).filter(word => word.length > 4 && !stopWords.has(word));

  if (words.length >= 2) {
    const scored = paragraphs.map(text => {
      const normalizedText = normalizeText(text);
      const score = words.reduce((acc, word) => acc + (normalizedText.includes(word) ? 1 : 0), 0);
      return { text, score };
    }).sort((a, b) => b.score - a.score);

    if (scored[0] && scored[0].score >= 2) return cleanBotAnswer(summarizeParagraph(scored[0].text));
  }

  return fallback;
}

function yearsBetween(startDate, endDate) {
  const ms = endDate - startDate;
  const years = ms / (365.2425 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.round(years * 10) / 10);
}

function formatYears(value) {
  const rounded = Math.round(value * 10) / 10;
  if (rounded < 1) return 'menos de 1 año';
  if (Math.abs(rounded - 1) < 0.05) return '1 año';
  return `${String(rounded).replace('.', ',')} años`;
}

function summarizeParagraph(text) {
  const cleaned = cleanBotAnswer(text);
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  return sentences.slice(0, 3).join(' ').trim();
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
