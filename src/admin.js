/* ───────── Panel de administración ───────── */
const STATUS = { nuevo: 'Nuevo', atendido: 'Atendido', entregado: 'Entregado', cancelado: 'Cancelado' };
const num = v => { const s = String(v ?? '').trim(); if (s === '') return NaN; const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

function adminView() {
  if (!state.authReady) return `<div class="wrap"><p class="muted" style="padding:64px 0;text-align:center">Cargando…</p></div>`;
  if (!state.user) return loginView();
  const nuevos = state.orders.filter(o => o.status === 'nuevo').length;
  const tab = (id, label, badge) => `<button type="button" role="tab" data-act="admTab" data-tab="${id}" aria-selected="${state.admin.tab === id}">${label}${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
  return `<div id="adminShell"><div class="adm-bar"><div class="wrap"><span class="logo"><span class="logo-mark"></span>${esc(state.settings.storeName)} · Administración</span>
    <nav><a class="btn" href="#/">Ver tienda</a><button type="button" class="btn" data-act="admLogout">Salir</button></nav></div></div>
    <div class="wrap"><div class="tabs" role="tablist">${tab('products', 'Productos')}${tab('banners', 'Ofertas y banners')}${tab('orders', 'Pedidos', nuevos || '')}${tab('settings', 'Ajustes')}</div>
    <div id="adminBody" role="tabpanel"></div></div></div>`;
}
function loginView() {
  return `<div class="wrap"><form class="login" id="loginForm" novalidate>
    <h1>Administración</h1><p class="muted" style="margin-bottom:22px">Ingresá para editar productos, precios, ofertas e imágenes.</p>
    <div class="field"><label for="l-u">Usuario</label><input class="in" id="l-u" name="u" autocomplete="username" autocapitalize="none" required></div>
    <div class="field"><label for="l-p">Contraseña</label><input class="in" id="l-p" name="p" type="password" autocomplete="current-password" required></div>
    <p class="err" role="alert" ${state.loginErr ? '' : 'hidden'}>${esc(state.loginErr)}</p>
    <button class="btn btn-primary" type="submit">Ingresar</button>
    ${DB?.mode === 'demo' ? '<p class="note" style="margin-top:14px">Vista previa: usuario <b>user</b> y contraseña <b>123456</b>.</p>' : ''}
    <p style="margin-top:16px;text-align:center"><a href="#/" class="note">Volver a la tienda</a></p></form></div>`;
}
async function doLogin(f) {
  const u = f.u.value, p = f.p.value;
  if (!u.trim() || !p) { state.loginErr = 'Escribí usuario y contraseña.'; return render(); }
  const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Ingresando…';
  try { await DB.auth.login(u, p); state.loginErr = ''; }
  catch (e) { state.loginErr = e.message; render(); $('#l-u').value = u; $('#l-p').focus(); }
}

function renderAdminBody() {
  const b = $('#adminBody'); if (!b) return;
  const t = state.admin.tab;
  b.innerHTML = t === 'products' ? productsTab() : t === 'banners' ? bannersTab() : t === 'orders' ? ordersTab() : settingsTab();
  const nuevos = state.orders.filter(o => o.status === 'nuevo').length;
  const tabBtn = $('[data-tab=orders]'); if (tabBtn) tabBtn.innerHTML = 'Pedidos' + (nuevos ? `<span class="badge">${nuevos}</span>` : '');
  $$('.tabs [data-tab]').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === t));
}

/* ── Productos ── */
function productRows() {
  const q = state.admin.q.toLowerCase(), c = state.admin.cat;
  const l = [...state.products].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .filter(p => (!c || p.category === c) && (!q || [p.name, p.brand, p.sub].join(' ').toLowerCase().includes(q)));
  if (!state.loaded.products) return '<div class="empty"><p>Cargando productos…</p></div>';
  if (!l.length) return `<div class="empty"><h3>${state.products.length ? 'Sin resultados' : 'Todavía no hay productos'}</h3><p>${state.products.length ? 'Probá con otra búsqueda.' : 'Agregá el primero, o cargá los productos de ejemplo desde Ajustes.'}</p></div>`;
  return `<div class="rows"><div class="arow head"><span></span><span>Producto</span><span>Precio</span><span>Precio antes</span><span>Stock</span><span>Visible</span><span></span></div>` +
    l.map(p => `<div class="arow prow ${p.active === false ? 'off' : ''}" style="--tint:${catOf(p).tint}">
      <img src="${esc(imgOf(p))}" alt="">
      <div class="nm">${esc(p.name)}<small>${esc(catOf(p).name)}${p.sub ? ' · ' + esc(p.sub) : ''}</small></div>
      <div class="nums"><label class="cell"><span class="lab">Precio</span><input class="in" type="number" min="0" step="any" inputmode="decimal" aria-label="Precio de ${esc(p.name)}" data-act="admInline" data-field="price" data-id="${esc(p.id)}" value="${esc(p.price)}"></label>
      <label class="cell"><span class="lab">Antes</span><input class="in" type="number" min="0" step="any" inputmode="decimal" aria-label="Precio anterior de ${esc(p.name)}" placeholder="Sin oferta" data-act="admInline" data-field="oldPrice" data-id="${esc(p.id)}" value="${p.oldPrice ? esc(p.oldPrice) : ''}"></label>
      <label class="cell"><span class="lab">Stock</span><input class="in" type="number" min="0" step="1" inputmode="numeric" aria-label="Stock de ${esc(p.name)}" placeholder="Sin límite" data-act="admInline" data-field="stock" data-id="${esc(p.id)}" value="${p.stock === null || p.stock === undefined ? '' : esc(p.stock)}"></label>
      <label class="sw"><input type="checkbox" data-act="admActive" data-id="${esc(p.id)}" ${p.active !== false ? 'checked' : ''} aria-label="Visible en la tienda: ${esc(p.name)}"><i></i></label></div>
      <div class="acts"><button type="button" class="btn btn-line btn-sm" data-act="admEdit" data-id="${esc(p.id)}">Editar</button><button type="button" class="btn btn-danger btn-sm" data-act="admDel" data-id="${esc(p.id)}" aria-label="Eliminar ${esc(p.name)}">Eliminar</button></div></div>`).join('') + '</div>';
}
function productsTab() {
  return `<div class="a-tools"><input class="in" type="search" placeholder="Buscar producto" aria-label="Buscar producto" data-act="admSearch" value="${esc(state.admin.q)}">
    <select class="in" aria-label="Filtrar por sección" data-act="admCatFilter"><option value="">Todas las secciones</option>${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${state.admin.cat === k ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
    <span class="sp"></span><button type="button" class="btn btn-primary" data-act="admNew">Nuevo producto</button></div>
    <p class="note" style="margin:-4px 0 12px">Editá precio, precio anterior (para mostrar la oferta) y stock directamente en la lista. Los cambios se publican al instante.</p>
    <div id="aList">${productRows()}</div>`;
}

/* ── Formularios ── */
function openForm(title, html) {
  const d = $('#dlgForm');
  d.innerHTML = `<div class="dlg-in"><button type="button" class="dlg-x" data-act="closeDlg" aria-label="Cerrar">×</button><h2>${esc(title)}</h2>${html}</div>`;
  d.showModal();
}
function imageField(image, art, accent) {
  const isData = String(image || '').startsWith('data:');
  const prev = image || artUri(art || 'laptop', accent);
  return `<div class="imgf"><img class="pv" id="imgPv" src="${esc(prev)}" alt="Vista previa"><div class="col">
    <input type="hidden" name="image" value="${esc(image || '')}">
    <div class="field" style="margin:0"><label for="f-img">Imagen: pegá un enlace o subí una foto</label><input class="in" id="f-img" data-act="admImgUrl" placeholder="https://…" value="${isData ? '' : esc(image || '')}"></div>
    <div class="btns"><label class="btn btn-line btn-sm">Subir foto<input type="file" accept="image/*" class="sr" data-act="admImgFile"></label><button type="button" class="btn btn-line btn-sm" data-act="admImgClear">Quitar imagen</button></div>
    <small class="muted" id="imgNote">${isData ? 'Foto subida.' : (image ? '' : 'Sin imagen: se muestra la ilustración elegida abajo.')}</small></div></div>`;
}
function artSelect(val) {
  return `<div class="field"><label for="f-art">Ilustración si no hay foto</label><select class="in" id="f-art" name="art" data-act="admPreview"><option value="">Según la sección</option>${Object.entries(ART_LABELS).map(([k, l]) => `<option value="${k}" ${val === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
}
function updatePreview(form) {
  const img = form.image.value, cat = CATS[form.category?.value] || null;
  const accent = cat ? cat.acc : (form.color ? (form.color.value || '#2347F5') : '#2347F5');
  const art = form.art.value || (cat ? cat.art : 'laptop');
  $('#imgPv').src = img || artUri(art, accent);
  $('#imgNote').textContent = img ? (img.startsWith('data:') ? 'Foto subida.' : '') : 'Sin imagen: se muestra la ilustración elegida abajo.';
}
async function fileToDataUrl(file, maxSide) {
  const bmp = await createImageBitmap(file);
  let side = maxSide, q = .86;
  for (let i = 0; i < 6; i++) {
    const r = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    const x = c.getContext('2d'); x.drawImage(bmp, 0, 0, c.width, c.height);
    let url = c.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) { x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); url = c.toDataURL('image/jpeg', q); }
    if (url.length < 600000) return url;
    side *= .8; q -= .08;
  }
  throw new Error('La imagen es demasiado pesada. Probá con una más chica.');
}

function openProductForm(id) {
  const p = id ? state.products.find(x => x.id === id) : { category: 'perifericos', active: true };
  const subs = [...new Set(state.products.map(x => x.sub).filter(Boolean))];
  openForm(id ? 'Editar producto' : 'Nuevo producto', `<form data-form="product" data-id="${esc(id || '')}" novalidate>
    <div class="form-grid">
      <div class="field full"><label for="f-n">Nombre</label><input class="in" id="f-n" name="name" required value="${esc(p.name)}"></div>
      <div class="field"><label for="f-c">Sección</label><select class="in" id="f-c" name="category" data-act="admPreview">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${p.category === k ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
      <div class="field"><label for="f-s">Subcategoría</label><input class="in" id="f-s" name="sub" list="subs" placeholder="Ej.: Mouse, Heladeras" value="${esc(p.sub)}"><datalist id="subs">${subs.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div class="field"><label for="f-b">Marca</label><input class="in" id="f-b" name="brand" value="${esc(p.brand)}"></div>
      <div class="field"><label for="f-st">Stock</label><input class="in" id="f-st" name="stock" type="number" min="0" step="1" inputmode="numeric" value="${p.stock === null || p.stock === undefined ? '' : esc(p.stock)}"><small>Vacío = sin límite. 0 = sin stock.</small></div>
      <div class="field"><label for="f-p">Precio ($)</label><input class="in" id="f-p" name="price" type="number" min="0" step="any" inputmode="decimal" required value="${p.price ?? ''}"></div>
      <div class="field"><label for="f-o">Precio anterior ($)</label><input class="in" id="f-o" name="oldPrice" type="number" min="0" step="any" inputmode="decimal" value="${p.oldPrice ? esc(p.oldPrice) : ''}"><small>Si es mayor que el precio, se muestra como oferta.</small></div>
      <div class="field full"><label for="f-d">Descripción</label><textarea class="in" id="f-d" name="description" rows="3">${esc(p.description)}</textarea></div>
      <div class="field full"><label for="f-sp">Características</label><textarea class="in" id="f-sp" name="specs" rows="4">${esc(p.specs)}</textarea><small>Una por línea. Ej.: Memoria: 16 GB</small></div>
    </div>
    ${imageField(p.image, p.art, (CATS[p.category] || CATS.perifericos).acc)}${artSelect(p.art)}
    <label class="chk"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}> Visible en la tienda</label>
    <p class="err" data-err hidden role="alert"></p>
    <div class="dlg-f"><button type="button" class="btn btn-line" data-act="closeDlg">Cancelar</button><button type="submit" class="btn btn-primary">Guardar producto</button></div></form>`);
}

/* ── Banners ── */
function bannersTab() {
  const l = [...state.banners].sort((a, b) => (a.order || 0) - (b.order || 0));
  return `<div class="a-tools"><p class="muted" style="flex:1">Estos banners rotan arriba en la página principal.</p><button type="button" class="btn btn-primary" data-act="admBNew">Nuevo banner</button></div>
  ${!l.length ? '<div class="empty"><h3>No hay banners</h3><p>Creá uno para destacar una oferta en la portada.</p></div>' :
    `<div class="rows">${l.map(b => `<div class="arow brow ${b.active === false ? 'off' : ''}"><div class="sw-prev" style="background:${esc(b.color || '#0E1A2B')};color:${lum(b.color) > .6 ? '#0E1A2B' : '#fff'}">${esc(b.cta || 'Sin botón')}</div>
      <div class="nm">${esc(b.title)}<small>${esc(b.subtitle || '')}</small></div><span class="muted">Orden ${esc(b.order ?? 0)}</span>
      <div class="acts"><button type="button" class="btn btn-line btn-sm" data-act="admBEdit" data-id="${esc(b.id)}">Editar</button><button type="button" class="btn btn-danger btn-sm" data-act="admBDel" data-id="${esc(b.id)}">Eliminar</button></div></div>`).join('')}</div>`}`;
}
function openBannerForm(id) {
  const b = id ? state.banners.find(x => x.id === id) : { color: '#2347F5', active: true, order: state.banners.length + 1, link: 'ofertas', art: 'laptop' };
  openForm(id ? 'Editar banner' : 'Nuevo banner', `<form data-form="banner" data-id="${esc(id || '')}" novalidate>
    <div class="field"><label for="b-t">Título</label><input class="in" id="b-t" name="title" required value="${esc(b.title)}"></div>
    <div class="field"><label for="b-s">Texto de apoyo</label><input class="in" id="b-s" name="subtitle" value="${esc(b.subtitle)}"></div>
    <div class="form-grid">
      <div class="field"><label for="b-c">Texto del botón</label><input class="in" id="b-c" name="cta" value="${esc(b.cta)}"></div>
      <div class="field"><label for="b-l">El botón lleva a</label><select class="in" id="b-l" name="link"><option value="ofertas" ${b.link === 'ofertas' ? 'selected' : ''}>Todas las ofertas</option>${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${b.link === k ? 'selected' : ''}>${c.name}</option>`).join('')}<option value="" ${!b.link ? 'selected' : ''}>Inicio</option></select></div>
      <div class="field"><label for="b-col">Color de fondo</label><input class="in" id="b-col" name="color" type="color" value="${esc(b.color || '#2347F5')}" style="padding:4px" data-act="admPreview"></div>
      <div class="field"><label for="b-o">Orden</label><input class="in" id="b-o" name="order" type="number" step="1" value="${esc(b.order ?? 1)}"></div>
    </div>
    ${imageField(b.image, b.art, '#FFD21F')}${artSelect(b.art)}
    <label class="chk"><input type="checkbox" name="active" ${b.active !== false ? 'checked' : ''}> Mostrar en la tienda</label>
    <p class="err" data-err hidden role="alert"></p>
    <div class="dlg-f"><button type="button" class="btn btn-line" data-act="closeDlg">Cancelar</button><button type="submit" class="btn btn-primary">Guardar banner</button></div></form>`);
}

/* ── Pedidos ── */
function waChip(o) {
  if (o.whatsapp?.sent) return '<span class="chipst ok">WhatsApp enviado</span>';
  if (o.whatsapp?.error) return '<span class="chipst bad" title="' + esc(o.whatsapp.error) + '">WhatsApp falló</span>';
  return '<span class="chipst mid">WhatsApp pendiente</span>';
}
function ordersTab() {
  if (!state.orders.length) return '<div class="empty"><h3>Todavía no hay pedidos</h3><p>Cuando un cliente confirme una compra, aparece acá al instante.</p></div>';
  return `<div class="rows">${state.orders.map(o => `<div class="arow orow"><div><b>${esc(o.code || o.id.slice(0, 6))}</b><small class="muted" style="display:block">${fmtDate(o.createdAt)}</small></div>
    <div class="nm">${esc(o.customer?.name)}<small>${esc(o.customer?.phone)} · ${o.itemCount || o.items?.length || 0} productos · ${o.customer?.delivery === 'envio' ? 'Envío' : 'Retiro'}</small></div>
    <div><b>${money(o.total)}</b><br>${waChip(o)}</div>
    <select class="in" aria-label="Estado del pedido ${esc(o.code)}" data-act="admStatus" data-id="${esc(o.id)}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <div class="acts"><button type="button" class="btn btn-line btn-sm" data-act="admOrder" data-id="${esc(o.id)}">Ver pedido</button></div></div>`).join('')}</div>`;
}
function openOrder(id) {
  const o = state.orders.find(x => x.id === id); if (!o) return;
  const c = o.customer || {};
  const msg = `Hola ${c.name || ''}, te escribimos de ${state.settings.storeName} por tu pedido ${o.code || ''}.`;
  openForm('Pedido ' + (o.code || ''), `<p class="muted">${fmtDate(o.createdAt)} · ${waChip(o)}</p>
    <table class="ord-items"><tbody>${(o.items || []).map(i => `<tr><td>${esc(i.qty)} × ${esc(i.name)}</td><td>${money(i.price * i.qty)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td style="font-size:18px">${money(o.total)}</td></tr></tbody></table>
    ${o.priceMismatch ? `<p class="err">Atención: los precios del pedido no coinciden con los actuales. Total verificado: ${money(o.verifiedTotal)}.</p>` : ''}
    <p><b>${esc(c.name)}</b><br>${esc(c.phone)}<br>${c.delivery === 'envio' ? 'Envío a: ' + esc(c.address) : 'Retiro en el local'}</p>
    ${c.note ? `<p class="muted" style="margin-top:8px">“${esc(c.note)}”</p>` : ''}
    <div class="dlg-f"><button type="button" class="btn btn-line" data-act="closeDlg">Cerrar</button><a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/${uyPhone(c.phone)}?text=${encodeURIComponent(msg)}">Escribir al cliente</a></div>`);
}

/* ── Ajustes ── */
function settingsTab() {
  const s = state.settings, perks = (s.perks || []).join('\n');
  return `<form class="panel" data-form="settings" novalidate><h3>Datos de la tienda</h3>
    <div class="field"><label for="s-n">Nombre de la tienda</label><input class="in" id="s-n" name="storeName" required value="${esc(s.storeName)}"></div>
    <div class="field"><label for="s-t">Frase corta</label><input class="in" id="s-t" name="tagline" value="${esc(s.tagline)}"></div>
    <div class="field"><label for="s-p">Barra de beneficios (una por línea, máximo 3)</label><textarea class="in" id="s-p" name="perks" rows="3">${esc(perks)}</textarea></div>
    <div class="field"><label for="s-f">Pie de página: dirección, horarios, contacto</label><textarea class="in" id="s-f" name="footerInfo" rows="3">${esc(s.footerInfo)}</textarea></div>
    <details style="margin-bottom:14px"><summary style="cursor:pointer;font-weight:600">Respaldo: abrir WhatsApp del cliente al comprar</summary>
      <p class="note" style="margin:8px 0">Solo si no usás el envío automático (Cloud Function). Abre WhatsApp con el mensaje armado y el cliente lo envía él mismo, por lo que <b>verá el número</b>.</p>
      <label class="chk"><input type="checkbox" name="linkFallback" ${s.linkFallback ? 'checked' : ''}> Activar respaldo</label>
      <div class="field"><label for="s-w">Número de WhatsApp (con código de país)</label><input class="in" id="s-w" name="waNumber" inputmode="tel" placeholder="598…" value="${esc(s.waNumber)}"></div></details>
    <p class="err" data-err hidden role="alert"></p>
    <button class="btn btn-primary" type="submit">Guardar ajustes</button></form>
  <form class="panel" data-form="password" novalidate><h3>Cambiar contraseña</h3>
    <p class="note" style="margin-bottom:12px">Cambiala apenas puedas: la contraseña inicial es fácil de adivinar.</p>
    <div class="field"><label for="pw1">Nueva contraseña</label><input class="in" id="pw1" name="p1" type="password" autocomplete="new-password" minlength="6"></div>
    <div class="field"><label for="pw2">Repetir contraseña</label><input class="in" id="pw2" name="p2" type="password" autocomplete="new-password"></div>
    <p class="err" data-err hidden role="alert"></p>
    <button class="btn btn-ink" type="submit">Cambiar contraseña</button></form>
  <div class="panel"><h3>Datos de ejemplo</h3><p class="note" style="margin-bottom:12px">Carga ${SEED_PRODUCTS.length} productos y ${SEED_BANNERS.length} banners de muestra con marcas ficticias. No borra lo que ya cargaste.</p>
    <button type="button" class="btn btn-line" data-act="admSeed">Cargar productos de ejemplo</button></div>
  <p class="note">Conexión: ${DB.mode === 'firebase' ? 'Firebase (datos en tiempo real)' : 'modo demo (datos guardados solo en este navegador)'}.</p>`;
}

/* ── Acciones ── */
function formErr(form, msg) { const e = $('[data-err]', form); e.textContent = msg; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); }
async function guarded(fn, form) {
  const btn = form && $('button[type=submit]', form); if (btn) btn.disabled = true;
  try { await fn(); }
  catch (e) { console.error(e); const m = /permission|insufficient/i.test(e.message || e.code || '') ? 'Tu sesión no tiene permiso para guardar. Volvé a ingresar.' : (e.message || 'No se pudo guardar.'); form ? formErr(form, m) : toast(m, { bad: true }); }
  finally { if (btn) btn.disabled = false; }
}

function adminClick(a, t) {
  const id = t.dataset.id;
  if (a === 'admTab') { state.admin.tab = t.dataset.tab; renderAdminBody(); }
  else if (a === 'admNew') openProductForm();
  else if (a === 'admEdit') openProductForm(id);
  else if (a === 'admDel') { const p = state.products.find(x => x.id === id); askConfirm(`¿Eliminar “${p?.name}”? No se puede deshacer.`).then(ok => ok && guarded(async () => { await DB.remove('products', id); toast('Producto eliminado'); })); }
  else if (a === 'admBNew') openBannerForm();
  else if (a === 'admBEdit') openBannerForm(id);
  else if (a === 'admBDel') { const b = state.banners.find(x => x.id === id); askConfirm(`¿Eliminar el banner “${b?.title}”?`).then(ok => ok && guarded(async () => { await DB.remove('banners', id); toast('Banner eliminado'); })); }
  else if (a === 'admOrder') openOrder(id);
  else if (a === 'admLogout') DB.auth.logout().then(() => { state.loginErr = ''; render(); });
  else if (a === 'admImgClear') { const f = t.closest('form'); f.image.value = ''; $('#f-img').value = ''; updatePreview(f); }
  else if (a === 'admSeed') askConfirm('Se cargarán los productos y banners de ejemplo. ¿Continuar?', 'Cargar').then(ok => ok && guarded(async () => {
    for (const p of seedProducts()) await DB.save('products', p.id, p);
    for (const b of SEED_BANNERS) await DB.save('banners', b.id, b);
    toast('Productos de ejemplo cargados');
  }));
}

function adminChange(a, t) {
  const id = t.dataset.id;
  if (a === 'admCatFilter') { state.admin.cat = t.value; $('#aList').innerHTML = productRows(); }
  else if (a === 'admInline') {
    const field = t.dataset.field, raw = t.value.trim();
    let v = raw === '' ? (field === 'price' ? NaN : (field === 'stock' ? null : 0)) : num(raw);
    if ((typeof v === 'number' && (Number.isNaN(v) || v < 0))) { toast('Escribí un número válido.', { bad: true }); return renderAdminBody(); }
    if (field === 'stock' && v !== null) v = Math.floor(v);
    guarded(async () => { await DB.save('products', id, { [field]: v, updatedAt: Date.now() }); toast('Guardado'); });
  }
  else if (a === 'admActive') guarded(async () => { await DB.save('products', id, { active: t.checked, updatedAt: Date.now() }); });
  else if (a === 'admStatus') guarded(async () => { await DB.save('orders', id, { status: t.value }); toast('Estado actualizado'); });
  else if (a === 'admPreview') updatePreview(t.closest('form'));
  else if (a === 'admImgFile') {
    const f = t.files[0]; if (!f) return;
    const form = t.closest('form'), isBanner = form.dataset.form === 'banner';
    fileToDataUrl(f, isBanner ? 1100 : 800).then(url => { form.image.value = url; $('#f-img').value = ''; updatePreview(form); })
      .catch(e => formErr(form, e.message || 'No se pudo leer la imagen.'));
  }
}
document.addEventListener('input', e => {
  const t = e.target, a = t.dataset?.act;
  if (a === 'admSearch') { state.admin.q = t.value; $('#aList').innerHTML = productRows(); }
  else if (a === 'admImgUrl') { const f = t.closest('form'); f.image.value = t.value.trim(); updatePreview(f); }
  else if (a === 'admPreview' && t.type === 'color') updatePreview(t.closest('form'));
});

async function adminSubmit(form) {
  const kind = form.dataset.form, id = form.dataset.id || null, f = new FormData(form);
  const s = k => String(f.get(k) ?? '').trim();
  $('[data-err]', form).hidden = true;

  if (kind === 'product') {
    const price = num(f.get('price')), old = String(f.get('oldPrice')).trim() === '' ? 0 : num(f.get('oldPrice'));
    const stockRaw = s('stock'), stock = stockRaw === '' ? null : Math.floor(num(stockRaw));
    if (!s('name')) return formErr(form, 'Escribí el nombre del producto.');
    if (Number.isNaN(price) || price < 0) return formErr(form, 'Escribí un precio válido.');
    if (Number.isNaN(old) || old < 0) return formErr(form, 'El precio anterior no es válido.');
    if (stock !== null && (Number.isNaN(stock) || stock < 0)) return formErr(form, 'El stock no es válido.');
    const data = { name: s('name'), category: s('category'), sub: s('sub'), brand: s('brand'), price, oldPrice: old, stock, description: s('description'), specs: String(f.get('specs') || '').trim(), image: s('image'), art: s('art'), active: f.get('active') === 'on', updatedAt: Date.now() };
    if (!id) data.createdAt = Date.now();
    return guarded(async () => { await DB.save('products', id, data); $('#dlgForm').close(); toast('Producto guardado'); }, form);
  }
  if (kind === 'banner') {
    if (!s('title')) return formErr(form, 'Escribí el título del banner.');
    const data = { title: s('title'), subtitle: s('subtitle'), cta: s('cta'), link: s('link'), color: s('color') || '#2347F5', order: Number.isNaN(num(f.get('order'))) ? 1 : num(f.get('order')), image: s('image'), art: s('art') || 'laptop', active: f.get('active') === 'on', updatedAt: Date.now() };
    return guarded(async () => { await DB.save('banners', id, data); $('#dlgForm').close(); toast('Banner guardado'); }, form);
  }
  if (kind === 'settings') {
    if (!s('storeName')) return formErr(form, 'Escribí el nombre de la tienda.');
    const linkFallback = f.get('linkFallback') === 'on';
    if (linkFallback && digits(s('waNumber')).length < 8) return formErr(form, 'Para activar el respaldo, escribí un número de WhatsApp válido.');
    const data = { storeName: s('storeName'), tagline: s('tagline'), perks: String(f.get('perks') || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 3), footerInfo: String(f.get('footerInfo') || '').trim(), linkFallback, waNumber: digits(s('waNumber')) };
    return guarded(async () => { await DB.save('settings', 'store', data); toast('Ajustes guardados'); }, form);
  }
  if (kind === 'password') {
    const p1 = String(f.get('p1') || ''), p2 = String(f.get('p2') || '');
    if (p1.length < 6) return formErr(form, 'La contraseña debe tener al menos 6 caracteres.');
    if (p1 !== p2) return formErr(form, 'Las contraseñas no coinciden.');
    return guarded(async () => { await DB.auth.changePassword(p1); form.reset(); toast('Contraseña actualizada'); }, form);
  }
}
