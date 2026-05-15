import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const ARTICLE_BUCKET = 'article-images';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  articles: [],
  knowledgeBase: '',
  editingArticleId: null,
  currentUser: null,
  supabase: null
};

document.addEventListener('DOMContentLoaded', async () => {
  $('#currentYear').textContent = new Date().getFullYear();
  initSupabase();
  await refreshSession();
  setupNavigation();
  setupRevealAnimations();
  setupPrivatePanel();
  setupEditor();
  setupArticles();
  setupArticleModal();
  setupChatbot();
  loadKnowledgeBase();
  await loadArticlesFromSupabase();
});

function initSupabase() {
  const config = window.supabaseConfig || {};
  const url = String(config.url || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const anonKey = config.anonKey;

  if (!url || !anonKey) {
    console.error('Falta configurar supabase-config.js con url y anonKey.');
    return;
  }

  state.supabase = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

async function refreshSession() {
  if (!state.supabase) return;
  const { data } = await state.supabase.auth.getSession();
  state.currentUser = data.session?.user || null;
}

function isAuthenticated() {
  return Boolean(state.currentUser);
}

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

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!state.supabase) {
      $('#loginError').textContent = 'La conexión con Supabase no está configurada.';
      return;
    }

    const email = $('#username').value.trim();
    const password = $('#password').value;

    const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });

    if (error) {
      $('#loginError').textContent = 'Email o contraseña incorrectos.';
      return;
    }

    state.currentUser = data.user;
    $('#loginError').textContent = '';
    loginView.hidden = true;
    editorView.hidden = false;
    setEditorMode();
    $('#articleTitle').focus();
  });

  $('#logoutBtn').addEventListener('click', async () => {
    if (state.supabase) await state.supabase.auth.signOut();
    state.currentUser = null;
    state.editingArticleId = null;
    loginView.hidden = false;
    editorView.hidden = true;
    loginForm.reset();
    resetEditor();
  });

  function openPanel() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    const hasAccess = isAuthenticated();
    loginView.hidden = hasAccess;
    editorView.hidden = !hasAccess;
    setEditorMode();
    setTimeout(() => (hasAccess ? $('#articleTitle') : $('#username')).focus(), 50);
  }

  window.openPrivatePanel = openPanel;

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

  $('#clearEditor').addEventListener('click', () => {
    state.editingArticleId = null;
    resetEditor();
    setEditorMode();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    if (!state.supabase || !isAuthenticated()) {
      alert('Debes acceder al área privada para publicar o editar artículos.');
      return;
    }

    const title = $('#articleTitle').value.trim();
    const articleBody = sanitizeHtml(body.innerHTML.trim());
    if (!title || !articleBody) {
      alert('Añade un título y contenido al artículo.');
      return;
    }

    const currentArticle = state.editingArticleId
      ? state.articles.find(article => article.id === state.editingArticleId)
      : null;

    const articleId = currentArticle?.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    const files = [imageOne.files[0], imageTwo.files[0]].filter(Boolean);

    let imageUrls = currentArticle?.images || [];
    if (files.length) {
      try {
        const uploadedUrls = [];
        for (let index = 0; index < files.length; index += 1) {
          uploadedUrls.push(await uploadArticleImage(files[index], articleId, index));
        }
        if (currentArticle?.images?.length) await deleteArticleImages(currentArticle.images);
        imageUrls = uploadedUrls;
      } catch (error) {
        console.error(error);
        alert('No se han podido subir las imágenes. Revisa el bucket article-images y sus políticas.');
        return;
      }
    }

    const payload = {
      id: articleId,
      title,
      subtitle: $('#articleSubtitle').value.trim() || null,
      tags: $('#articleTags').value.split(',').map(tag => tag.trim()).filter(Boolean),
      body: articleBody,
      image_urls: imageUrls,
      updated_at: new Date().toISOString(),
      user_id: state.currentUser.id
    };

    let result;
    if (currentArticle) {
      result = await state.supabase
        .from('articles')
        .update(payload)
        .eq('id', currentArticle.id)
        .select()
        .single();
    } else {
      result = await state.supabase
        .from('articles')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
    }

    if (result.error) {
      console.error(result.error);
      alert('No se ha podido guardar el artículo. Revisa la tabla articles y las políticas RLS.');
      return;
    }

    await loadArticlesFromSupabase();
    const wasEditing = Boolean(state.editingArticleId);
    state.editingArticleId = null;
    resetEditor();
    setEditorMode();
    alert(wasEditing ? 'Artículo actualizado correctamente.' : 'Artículo publicado correctamente.');
    location.hash = '#articulos';
  });
}

async function uploadArticleImage(file, articleId, index) {
  if (!file || !file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
  const blob = await compressImageToBlob(file);
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
  const path = `${state.currentUser.id}/${articleId}/${Date.now()}-${index}-${safeName || 'imagen.jpg'}`;

  const { error } = await state.supabase.storage
    .from(ARTICLE_BUCKET)
    .upload(path, blob, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/jpeg'
    });

  if (error) throw error;

  const { data } = state.supabase.storage.from(ARTICLE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function deleteArticleImages(urls = []) {
  const paths = urls.map(extractStoragePath).filter(Boolean);
  if (!paths.length) return;
  const { error } = await state.supabase.storage.from(ARTICLE_BUCKET).remove(paths);
  if (error) console.warn('No se han podido borrar algunas imágenes antiguas:', error);
}

function extractStoragePath(publicUrl) {
  const marker = `/storage/v1/object/public/${ARTICLE_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

function compressImageToBlob(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 1400;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) reject(new Error('No se ha podido comprimir la imagen.'));
          else resolve(blob);
        }, 'image/jpeg', 0.78);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function updateImagePreview() {
  const preview = $('#imagePreview');
  preview.innerHTML = '';

  const editingArticle = state.editingArticleId
    ? state.articles.find(article => article.id === state.editingArticleId)
    : null;

  const selectedFiles = [$('#imageOne').files[0], $('#imageTwo').files[0]].filter(Boolean);

  if (!selectedFiles.length && editingArticle?.images?.length) {
    editingArticle.images.forEach((src, index) => {
      const img = document.createElement('img');
      img.alt = `Imagen actual ${index + 1} del artículo`;
      img.src = src;
      preview.appendChild(img);
    });
    return;
  }

  selectedFiles.forEach(file => {
    const img = document.createElement('img');
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  });
}

function setEditorMode() {
  const title = $('#editorView h2');
  const submitButton = $('#articleForm button[type="submit"]');
  const clearButton = $('#clearEditor');

  if (!title || !submitButton) return;

  if (state.editingArticleId) {
    title.textContent = 'Editar artículo';
    submitButton.textContent = 'Guardar cambios';
    if (clearButton) clearButton.textContent = 'Cancelar edición';
  } else {
    title.textContent = 'Nuevo artículo';
    submitButton.textContent = 'Publicar artículo';
    if (clearButton) clearButton.textContent = 'Limpiar';
  }
}

function editArticle(articleId) {
  const article = state.articles.find(item => item.id === articleId);
  if (!article) return;

  if (!isAuthenticated()) {
    alert('Debes acceder al área privada para editar artículos.');
    if (typeof window.openPrivatePanel === 'function') window.openPrivatePanel();
    return;
  }

  state.editingArticleId = article.id;
  $('#articleTitle').value = article.title || '';
  $('#articleSubtitle').value = article.subtitle || '';
  $('#articleTags').value = (article.tags || []).join(', ');
  $('#articleBody').innerHTML = article.body || '';
  $('#imageOne').value = '';
  $('#imageTwo').value = '';
  updateImagePreview();
  setEditorMode();

  if (typeof window.openPrivatePanel === 'function') window.openPrivatePanel();
}

function setupArticles() {
  $('#searchArticles').addEventListener('input', renderArticles);
  $('#sortArticles').addEventListener('change', renderArticles);
  renderArticles();
}

async function loadArticlesFromSupabase() {
  if (!state.supabase) {
    renderArticles();
    return;
  }

  const { data, error } = await state.supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    renderArticles();
    return;
  }

  state.articles = (data || []).map(article => ({
    id: article.id,
    title: article.title,
    subtitle: article.subtitle || '',
    body: article.body || '',
    tags: article.tags || [],
    images: article.image_urls || [],
    createdAt: article.created_at,
    updatedAt: article.updated_at
  }));

  renderArticles();
}

function renderArticles() {
  const grid = $('#articlesGrid');
  const query = $('#searchArticles')?.value?.toLowerCase() || '';
  const sort = $('#sortArticles')?.value || 'newest';
  grid.innerHTML = '';

  let articles = [...state.articles].filter(article => {
    const haystack = [article.title, article.subtitle, (article.tags || []).join(' '), stripTags(article.body || '')].join(' ').toLowerCase();
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
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Abrir artículo: ${article.title}`);
    card.dataset.openArticle = article.id;
    const cover = article.images?.[0]
      ? `<img class="article-card-cover" src="${article.images[0]}" alt="Imagen del artículo ${escapeHtml(article.title)}">`
      : `<div class="article-card-cover article-card-placeholder" aria-hidden="true">Sin imagen</div>`;
    card.innerHTML = `
      ${cover}
      <div class="article-card-content article-card-compact">
        <h3>${escapeHtml(article.title)}</h3>
        <span class="read-more">Leer artículo completo</span>
        <div class="article-actions">
          <button class="secondary-action small" data-edit="${article.id}">Editar</button>
          <button class="secondary-action small" data-delete="${article.id}">Eliminar</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  $$('[data-open-article]').forEach(card => {
    card.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      openArticleModal(card.dataset.openArticle);
    });
    card.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('button')) return;
      event.preventDefault();
      openArticleModal(card.dataset.openArticle);
    });
  });

  $$('[data-edit]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    editArticle(button.dataset.edit);
  }));

  $$('[data-delete]').forEach(button => button.addEventListener('click', async event => {
    event.stopPropagation();
    if (!isAuthenticated()) {
      alert('Debes acceder al área privada para eliminar artículos.');
      if (typeof window.openPrivatePanel === 'function') window.openPrivatePanel();
      return;
    }

    if (!confirm('¿Seguro que quieres eliminar este artículo?')) return;

    const article = state.articles.find(item => item.id === button.dataset.delete);
    const { error } = await state.supabase.from('articles').delete().eq('id', button.dataset.delete);
    if (error) {
      console.error(error);
      alert('No se ha podido eliminar el artículo.');
      return;
    }

    if (article?.images?.length) await deleteArticleImages(article.images);
    await loadArticlesFromSupabase();
  }));
}

function setupArticleModal() {
  if ($('#articleModal')) return;

  const modal = document.createElement('section');
  modal.id = 'articleModal';
  modal.className = 'article-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="article-modal-overlay" data-close-article-modal></div>
    <article class="article-modal-window" role="dialog" aria-modal="true" aria-labelledby="articleModalTitle">
      <button class="article-modal-close" type="button" data-close-article-modal aria-label="Cerrar artículo">×</button>
      <div id="articleModalContent" class="article-modal-content"></div>
    </article>`;
  document.body.appendChild(modal);

  $$('[data-close-article-modal]', modal).forEach(element => {
    element.addEventListener('click', closeArticleModal);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('open')) closeArticleModal();
  });
}

function openArticleModal(articleId) {
  const article = state.articles.find(item => item.id === articleId);
  if (!article) return;

  const modal = $('#articleModal');
  const content = $('#articleModalContent');
  const tags = article.tags?.length ? `<div class="article-modal-tags">${article.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : '';
  const images = (article.images || []).map((src, index) => `
    <figure class="article-modal-figure">
      <img src="${src}" alt="${index === 0 ? 'Imagen principal' : 'Imagen complementaria'} del artículo ${escapeHtml(article.title)}">
    </figure>`).join('');

  content.innerHTML = `
    <header class="article-modal-header">
      <time datetime="${article.createdAt}">${formatDate(article.createdAt)}</time>
      <h2 id="articleModalTitle">${escapeHtml(article.title)}</h2>
      ${article.subtitle ? `<p class="article-modal-subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
      ${tags}
    </header>
    ${images}
    <div class="article-modal-body">${article.body}</div>`;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  $('.article-modal-close', modal).focus();
}

function closeArticleModal() {
  const modal = $('#articleModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
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

function resetEditor() {
  $('#articleForm').reset();
  $('#articleBody').innerHTML = '';
  $('#imagePreview').innerHTML = '';
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

  const hasAny = (terms) => terms.some(term => normalized.includes(term));

  // Respuestas por intención. Evita que preguntas distintas devuelvan siempre el primer párrafo coincidente.
  if (hasAny(['contacto', 'email', 'correo', 'telefono', 'llamar', 'ubicacion', 'donde esta', 'localizacion'])) {
    return 'Puedes contactar con Luis Aladro por email en luis.aladro.f@gmail.com o por teléfono en el 625 631 432. Su ubicación profesional es Madrid, Las Tablas.';
  }

  if (hasAny(['formacion', 'estudios', 'academica', 'titulacion', 'power mba', 'powermba', 'transformacion digital', 'ingenieria', 'electronica'])) {
    return 'Luis cuenta con formación en IA aplicada a negocio, The PowerMBA Business & Strategy Program, Programa Avanzado de Transformación Digital, Dirección de Marketing y Ventas, Ingeniería Técnica Industrial y Técnico Especialista en Electrónica Industrial.';
  }

  if (hasAny(['herramientas', 'tecnologia', 'crm', 'salesforce', 'hubspot', 'imaweb', 'google analytics', 'google ads', 'meta', 'semrush', 'chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'notebooklm', 'kimi', 'office', 'photoshop', 'premiere', 'illustrator', 'canva'])) {
    return 'Luis trabaja con CRM como Salesforce, HubSpot e Imaweb; herramientas de marketing digital como Google Analytics, Google Ads, Meta Business Suite y SEMrush; herramientas de IA como ChatGPT, Claude, Gemini, Grok, Perplexity, NotebookLM y Kimi; además de Microsoft Office avanzado y soluciones de diseño y contenido como Photoshop, Premiere Pro, Illustrator y Canva.';
  }

  if (hasAny(['idioma', 'idiomas', 'ingles', 'frances', 'español', 'carnet', 'carne', 'conducir'])) {
    return 'Luis tiene español nativo, inglés B1 intermedio y francés B1 intermedio. También dispone de carnés de conducir AM, A1, A2, A, B, BE, C1, C1E y C.';
  }

  if (hasAny(['automocion', 'vehiculo', 'vehiculos', 'vn', 'vo', 'concesionario', 'concesionarios', 'flotas', 'grupo gil', 'cms', 'bmw', 'mini', 'opel', 'mazda', 'mitsubishi', 'mg', 'ocasion', 'autoestrena'])) {
    return 'En automoción, Luis tiene una trayectoria amplia en vehículo nuevo multimarca y vehículo de ocasión. Actualmente dirige marketing y ventas en Grupo Gil Automoción, con responsabilidad sobre estrategia omnicanal, campañas online y offline, gestión presupuestaria, apertura de concesionarios y marcas como Opel, Mazda, Mitsubishi, MG, AutoestrenaGil.es y OcasionGil.es. Anteriormente trabajó en Grupo CMS con marcas BMW, MINI, Opel y Chevrolet, incluyendo dirección comercial, gestión de equipos, flotas B2B, stock y vehículos de ocasión.';
  }

  if (hasAny(['experiencia actual', 'actualidad', 'trabajo actual', 'puesto actual', 'grupo gil'])) {
    return 'Actualmente Luis es Director de Marketing y Ventas en Grupo Gil Automoción desde enero de 2018. Dirige marketing y ventas multimarca de vehículo nuevo y de ocasión, gestiona presupuestos, campañas omnicanal, transformación digital y aperturas de nuevos concesionarios en Madrid.';
  }

  if (hasAny(['experiencia', 'trayectoria', 'profesional', 'carrera', 'trabajos', 'puestos', 'empresas', 'curriculum', 'cv'])) {
    return 'Luis Aladro es un ejecutivo senior con más de 20 años de experiencia en Dirección Comercial, Dirección de Ventas, Desarrollo de Negocio y Marketing Digital. Ha trabajado en sectores como automoción, medios de comunicación, energía y retail, con responsabilidades en gestión de equipos, P&L, grandes cuentas, transformación digital, CRM, generación de leads y estrategia omnicanal.';
  }

  if (hasAny(['competencias', 'habilidades', 'especialidades', 'capacidades', 'puntos fuertes', 'que sabe hacer'])) {
    return 'Sus competencias clave incluyen Dirección de Ventas VN y VO, Dirección de Marketing, Desarrollo de Negocio, Estrategia Comercial, P&L y presupuestos, Key Account Management, negociación con grandes cuentas, gestión de flotas B2B, liderazgo de equipos, CRM, Marketing Digital, Transformación Digital, estrategia omnicanal, generación de leads, SEO, SEM, reporting e Inteligencia Artificial aplicada a negocio.';
  }

  if (hasAny(['marketing', 'marketing digital', 'seo', 'sem', 'leads', 'omnicanal', 'campañas', 'campanas', 'analytics', 'meta business', 'google ads'])) {
    return 'En marketing digital, Luis tiene experiencia en estrategia 360º omnicanal, generación de leads, SEO, SEM, Google Analytics, Google Ads, Meta Business Suite, SEMrush, reporting y campañas online y offline orientadas a objetivos comerciales.';
  }

  if (hasAny(['inteligencia artificial', 'ia', 'ai', 'aplicada a negocio'])) {
    return 'Luis está orientado a la Inteligencia Artificial aplicada a negocio, especialmente como apoyo a ventas, marketing, transformación digital, análisis, productividad y generación de oportunidades comerciales.';
  }

  if (hasAny(['ventas', 'comercial', 'direccion comercial', 'desarrollo de negocio', 'grandes cuentas', 'kam', 'b2b', 'b2c', 'p&l', 'presupuesto', 'rentabilidad', 'roi', 'kpi'])) {
    return 'En el área comercial, Luis aporta experiencia en Dirección de Ventas, Desarrollo de Negocio, gestión B2B y B2C, negociación con grandes cuentas, KAM, gestión de P&L y presupuestos superiores a 600.000 euros, seguimiento de KPIs, ROI y rentabilidad.';
  }

  // Búsqueda secundaria limitada, con umbral más alto para evitar respuestas genéricas repetidas.
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

    if (scored[0] && scored[0].score >= 2) return cleanBotAnswer(scored[0].text);
  }

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

function saveArticles() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.articles));
  } catch (error) {
    throw error;
  }
}

function resetEditor() {
  $('#articleForm').reset();
  $('#articleBody').innerHTML = '';
  $('#imagePreview').innerHTML = '';
}

function fileToDataUrl(file) {
  if (!file) return Promise.resolve(null);
  if (!file.type.startsWith('image/')) return Promise.resolve(null);

  // localStorage tiene poco espacio. Comprimimos las fotos antes de guardarlas para poder publicar varios artículos.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 1200;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
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
