/* ───────── Utilidades ───────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 });
const money = n => '$ ' + nf.format(Math.round(Number(n) || 0));
const fmtDate = ms => ms ? new Date(ms).toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'short' }) : '';
const onOffer = p => Number(p.oldPrice) > Number(p.price) && Number(p.price) > 0;
const pct = p => Math.round((1 - p.price / p.oldPrice) * 100);
const stockOf = p => (p.stock === null || p.stock === undefined || p.stock === '') ? Infinity : Number(p.stock);
const catOf = p => CATS[p.category] || CATS.perifericos;
const lum = hex => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || ''); if (!m) return 0; const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16) / 255); return .2126 * r + .7152 * g + .0722 * b; };
const digits = s => String(s || '').replace(/\D/g, '');
const uyPhone = s => { const d = digits(s); if (d.startsWith('598')) return d; if (d.startsWith('0')) return '598' + d.slice(1); return d; };

/* ───────── Estado ───────── */
const state = {
  products: [], banners: [], orders: [], settings: { ...DEFAULT_SETTINGS },
  loaded: { products: false, banners: false }, error: '',
  cart: lsGet('nodo_cart') || {}, cartStep: 'cart', doneCode: '', orderErr: '', sending: false,
  route: { name: 'home' }, q: '', sub: '', sort: 'rel', onlyOffers: false, inStock: false,
  hero: 0, user: null, authReady: false, loginErr: '',
  admin: { tab: 'products', q: '', cat: '' }
};
let DB = null;
const app = $('#app');

const activeProducts = () => state.products.filter(p => p.active !== false);
const saveCart = () => lsSet('nodo_cart', state.cart);

/* ───────── Carrito ───────── */
function cartLines() {
  const out = [];
  for (const [id, q] of Object.entries(state.cart)) {
    const p = activeProducts().find(x => x.id === id);
    if (!p) continue;
    const qty = Math.min(Number(q) || 0, stockOf(p));
    if (qty > 0) out.push({ p, qty, sub: p.price * qty });
  }
  return out;
}
const cartCount = () => cartLines().reduce((a, l) => a + l.qty, 0);
const cartTotal = () => cartLines().reduce((a, l) => a + l.sub, 0);

function setQty(id, qty) {
  const p = activeProducts().find(x => x.id === id);
  if (!p) return;
  qty = Math.max(0, Math.min(qty, stockOf(p)));
  if (qty === 0) delete state.cart[id]; else state.cart[id] = qty;
  saveCart(); renderCartBadge(); if ($('#dlgCart').open) renderCart();
}
function addToCart(id, n = 1) {
  const p = activeProducts().find(x => x.id === id);
  if (!p) return;
  const have = state.cart[id] || 0;
  if (stockOf(p) <= 0) return toast('Este producto no tiene stock.', { bad: true });
  if (have + n > stockOf(p)) { setQty(id, stockOf(p)); return toast(`Solo quedan ${stockOf(p)} unidades de este producto.`, { bad: true }); }
  setQty(id, have + n);
  const b = $('#cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  toast('Agregado al carrito', { label: 'Ver carrito', fn: openCart });
}
function renderCartBadge() {
  $('#cartN').textContent = cartCount();
  $('#cartT').textContent = money(cartTotal());
}

/* ───────── Toasts y confirmación ───────── */
function toast(msg, opt = {}) {
  const el = document.createElement('div');
  el.className = 'toast' + (opt.bad ? ' bad' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>` + (opt.label ? `<button type="button">${esc(opt.label)}</button>` : '');
  if (opt.label) el.querySelector('button').onclick = () => { opt.fn(); el.remove(); };
  const box = $('#toasts');
  box.replaceChildren(el); // un solo aviso a la vez
  try { box.hidePopover(); box.showPopover(); } catch { /* sin popover: queda sobre la página */ }
  setTimeout(() => el.remove(), opt.label ? 4500 : 3500);
}
function askConfirm(msg, okLabel = 'Eliminar') {
  return new Promise(res => {
    const d = $('#dlgConfirm');
    $('#confirmMsg', d).textContent = msg;
    $('#confirmOk', d).textContent = okLabel;
    const done = v => { d.close(); res(v); };
    $('#confirmOk', d).onclick = () => done(true);
    $('#confirmNo', d).onclick = () => done(false);
    d.oncancel = () => res(false);
    d.showModal();
  });
}

/* ───────── Ruteo ───────── */
function parseHash() {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 'admin') return { name: 'admin' };
  if (a === 'c' && CATS[b]) return { name: 'cat', cat: b };
  if (a === 'ofertas') return { name: 'offers' };
  return { name: 'home' };
}
window.addEventListener('hashchange', () => {
  state.route = parseHash(); state.sub = ''; state.q = ''; state.sort = 'rel'; state.onlyOffers = false; state.inStock = false;
  $('#q').value = '';
  render(); window.scrollTo(0, 0);
});

/* ───────── Piezas de la tienda ───────── */
function card(p) {
  const offer = onOffer(p), out = stockOf(p) <= 0, c = catOf(p);
  return `<article class="card ${out ? 'is-out' : ''}">
    <button type="button" class="card-img" data-act="open" data-id="${esc(p.id)}" style="--tint:${c.tint}" aria-label="Ver ${esc(p.name)}">
      <img loading="lazy" src="${esc(imgOf(p))}" alt="" class="${p.image ? 'photo' : ''}">
      ${offer ? `<span class="tag">-${pct(p)}%</span>` : ''}${out ? '<span class="out">Sin stock</span>' : ''}
    </button>
    <div class="card-b">
      <p class="card-meta">${esc(p.brand || c.name)}</p>
      <h3 class="card-t"><button type="button" class="linkish" data-act="open" data-id="${esc(p.id)}">${esc(p.name)}</button></h3>
      <div class="price">${offer ? `<s>${money(p.oldPrice)}</s>` : ''}<strong>${money(p.price)}</strong></div>
      <button type="button" class="btn btn-primary" data-act="add" data-id="${esc(p.id)}" ${out ? 'disabled' : ''}>${out ? 'Sin stock' : 'Agregar al carrito'}</button>
    </div>
  </article>`;
}
const skeletons = n => `<div class="grid">${'<div class="skel"></div>'.repeat(n)}</div>`;

function sortList(list) {
  const s = state.sort, byNew = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
  const l = [...list];
  if (s === 'asc') l.sort((a, b) => a.price - b.price);
  else if (s === 'desc') l.sort((a, b) => b.price - a.price);
  else if (s === 'disc') l.sort((a, b) => (onOffer(b) ? pct(b) : 0) - (onOffer(a) ? pct(a) : 0));
  else if (s === 'az') l.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  else l.sort(byNew);
  return l;
}

function heroHTML() {
  const bs = state.banners.filter(b => b.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!bs.length) return '';
  if (state.hero >= bs.length) state.hero = 0;
  const slides = bs.map((b, i) => {
    const bg = b.color || '#0E1A2B', dark = lum(bg) > .6, fg = dark ? '#0E1A2B' : '#fff';
    const art = b.image ? `<img class="photo" src="${esc(b.image)}" alt="">` : `<img src="${esc(artUri(b.art || 'laptop', dark ? '#0E1A2B' : '#FFD21F'))}" alt="">`;
    const href = b.link === 'ofertas' ? '#/ofertas' : (CATS[b.link] ? '#/c/' + b.link : '#/');
    return `<div class="slide ${i === state.hero ? 'on' : ''}" style="--bg:${esc(bg)};--fg:${fg}" role="group" aria-label="Oferta ${i + 1} de ${bs.length}">
      <div><h2>${esc(b.title)}</h2>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ''}${b.cta ? `<a class="btn ${dark ? 'btn-ink' : 'btn-tag'}" href="${href}">${esc(b.cta)}</a>` : ''}</div>
      <div class="slide-art">${art}</div></div>`;
  }).join('');
  const cur = bs[state.hero], darkDots = lum(cur.color || '#0E1A2B') > .6;
  const dots = bs.length > 1 ? `<div class="dots ${darkDots ? 'dark' : ''}">${bs.map((_, i) => `<button type="button" data-act="hero" data-i="${i}" aria-label="Ir a la oferta ${i + 1}" aria-current="${i === state.hero}"></button>`).join('')}</div>` : '';
  return `<section class="hero wrap" aria-roledescription="carrusel" aria-label="Ofertas destacadas">${slides}${dots}</section>`;
}
function setHero(i) {
  const bs = state.banners.filter(b => b.active !== false);
  if (!bs.length) return;
  state.hero = (i + bs.length) % bs.length;
  $$('.slide').forEach((s, k) => s.classList.toggle('on', k === state.hero));
  const cur = [...bs].sort((a, b) => (a.order || 0) - (b.order || 0))[state.hero];
  const dots = $('.dots');
  if (dots) {
    dots.classList.toggle('dark', lum(cur.color || '#0E1A2B') > .6);
    $$('button', dots).forEach((b, k) => b.setAttribute('aria-current', k === state.hero));
  }
}
setInterval(() => {
  if (state.route.name !== 'home' || state.q || document.hidden || $('.hero:hover, .hero:focus-within')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  setHero(state.hero + 1);
}, 6500);

function storeHome() {
  const ps = activeProducts();
  if (state.error) return errorBox();
  if (!state.loaded.products) return heroHTML() + `<section class="sec wrap">${skeletons(8)}</section>`;
  const offers = sortList(ps.filter(onOffer)).slice(0, 8);
  const tiles = Object.entries(CATS).map(([k, c]) => {
    const n = ps.filter(p => p.category === k).length;
    return `<a class="tile" href="#/c/${k}" style="--tint:${c.tint}"><h3>${c.name}</h3><p>${esc(c.blurb)}</p><img src="${esc(artUri(c.art, c.acc))}" alt=""><span class="sr">${n} productos</span></a>`;
  }).join('');
  let html = heroHTML() + `<section class="sec wrap"><div class="sec-h"><h2>Comprá por sección</h2></div><div class="tiles">${tiles}</div></section>`;
  if (offers.length) html += `<section class="sec wrap"><div class="sec-h"><h2>Ofertas</h2><a href="#/ofertas">Ver todas</a></div><div class="grid">${offers.map(card).join('')}</div></section>`;
  for (const [k, c] of Object.entries(CATS)) {
    const l = sortList(ps.filter(p => p.category === k)).slice(0, 4);
    if (l.length) html += `<section class="sec wrap"><div class="sec-h"><h2>${c.name}</h2><a href="#/c/${k}">Ver todo en ${c.name}</a></div><div class="grid">${l.map(card).join('')}</div></section>`;
  }
  if (!ps.length) html += `<section class="sec wrap"><div class="empty"><h3>Estamos cargando el catálogo</h3><p>Todavía no hay productos publicados. Volvé en unos minutos.</p></div></section>`;
  return html;
}
function errorBox() {
  return `<section class="sec wrap"><div class="empty"><h3>No pudimos cargar la tienda</h3><p>${esc(state.error)}</p><button type="button" class="btn btn-primary" onclick="location.reload()">Reintentar</button></div></section>`;
}

function listing({ title, crumb, list, subs }) {
  if (state.error) return errorBox();
  let l = list;
  if (state.sub) l = l.filter(p => p.sub === state.sub);
  if (state.onlyOffers) l = l.filter(onOffer);
  if (state.inStock) l = l.filter(p => stockOf(p) > 0);
  l = sortList(l);
  const chips = subs && subs.length ? `<div class="chips" role="group" aria-label="Subcategorías"><button type="button" class="chip" data-act="sub" data-v="" aria-pressed="${!state.sub}">Todo</button>${subs.map(s => `<button type="button" class="chip" data-act="sub" data-v="${esc(s)}" aria-pressed="${state.sub === s}">${esc(s)}</button>`).join('')}</div>` : '';
  const tb = `<div class="toolbar"><span class="count" aria-live="polite">${l.length} ${l.length === 1 ? 'producto' : 'productos'}</span>
    <label><input type="checkbox" data-act="onlyOffers" ${state.onlyOffers ? 'checked' : ''}> Solo ofertas</label>
    <label><input type="checkbox" data-act="inStock" ${state.inStock ? 'checked' : ''}> Con stock</label>
    <label>Ordenar <select data-act="sort">${[['rel', 'Más nuevos'], ['asc', 'Menor precio'], ['desc', 'Mayor precio'], ['disc', 'Mayor descuento'], ['az', 'A a Z']].map(([v, t]) => `<option value="${v}" ${state.sort === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>`;
  const body = !state.loaded.products ? skeletons(8)
    : l.length ? `<div class="grid">${l.map(card).join('')}</div>`
    : `<div class="empty"><h3>No encontramos productos</h3><p>Probá con otros filtros o buscá por otro nombre.</p><button type="button" class="btn btn-primary" data-act="clear">Quitar filtros</button></div>`;
  return `<div class="wrap"><p class="crumb"><a href="#/">Inicio</a>${crumb ? ' / ' + crumb : ''}</p>
    <div class="list-h"><h1>${title}</h1></div>${chips}${tb}${body}</div>`;
}

function storeView() {
  const ps = activeProducts();
  if (state.q) {
    const q = state.q.toLowerCase();
    const list = ps.filter(p => [p.name, p.brand, p.sub, catOf(p).name, p.description].join(' ').toLowerCase().includes(q));
    return listing({ title: `Resultados para “${esc(state.q)}”`, crumb: 'Búsqueda', list });
  }
  const r = state.route;
  if (r.name === 'cat') {
    const list = ps.filter(p => p.category === r.cat);
    const subs = [...new Set(list.map(p => p.sub).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    return listing({ title: CATS[r.cat].name, crumb: CATS[r.cat].name, list, subs });
  }
  if (r.name === 'offers') return listing({ title: 'Ofertas', crumb: 'Ofertas', list: ps.filter(onOffer) });
  return storeHome();
}

function renderChrome() {
  const s = state.settings;
  document.title = `${s.storeName} · ${s.tagline || 'Tecnología y electrodomésticos'}`;
  $$('.js-name').forEach(e => e.textContent = s.storeName);
  const perks = (s.perks || []).filter(Boolean);
  $('#perks').hidden = !perks.length;
  $('#perks .wrap').innerHTML = perks.map(p => `<span>${esc(p)}</span>`).join('');
  const r = state.route, cur = state.q ? '' : (r.name === 'cat' ? r.cat : r.name === 'offers' ? 'ofertas' : 'home');
  $('#catNav ul').innerHTML =
    `<li><a href="#/" ${cur === 'home' ? 'aria-current="page"' : ''}>Inicio</a></li>` +
    Object.entries(CATS).map(([k, c]) => `<li><a href="#/c/${k}" ${cur === k ? 'aria-current="page"' : ''}>${c.name}</a></li>`).join('') +
    `<li><a class="hot" href="#/ofertas" ${cur === 'ofertas' ? 'aria-current="page"' : ''}>Ofertas</a></li>`;
  $('#footInfo').textContent = s.footerInfo || '';
  $('#footLocal').hidden = !s.footerInfo;
  $('#footTag').textContent = s.tagline || '';
  $('#footCats').innerHTML = Object.entries(CATS).map(([k, c]) => `<li><a href="#/c/${k}">${c.name}</a></li>`).join('') + '<li><a href="#/ofertas">Ofertas</a></li>';
  $('#demoBar').hidden = DB?.mode !== 'demo';
  renderCartBadge();
}

function render() {
  const admin = state.route.name === 'admin';
  document.body.classList.toggle('is-admin', admin);
  renderChrome();
  app.innerHTML = admin ? adminView() : storeView();
  if (admin) renderAdminBody();
}

/* ───────── Producto ───────── */
let pdQty = 1;
function openProduct(id) {
  const p = activeProducts().find(x => x.id === id);
  if (!p) return;
  pdQty = 1;
  const c = catOf(p), st = stockOf(p), offer = onOffer(p);
  const stock = st <= 0 ? '<p class="stock none">Sin stock</p>' : st <= 5 ? `<p class="stock low">Quedan ${st} unidades</p>` : '<p class="stock">Disponible</p>';
  const specs = String(p.specs || '').split('\n').map(s => s.trim()).filter(Boolean);
  $('#dlgProduct').innerHTML = `<button type="button" class="dlg-x" data-act="closeDlg" aria-label="Cerrar">×</button>
    <div class="pd"><div class="pd-img" style="--tint:${c.tint}"><img src="${esc(imgOf(p))}" alt="${esc(p.name)}">${offer ? `<span class="tag">-${pct(p)}%</span>` : ''}</div>
    <div class="pd-b"><p class="card-meta">${esc([p.brand, p.sub].filter(Boolean).join(' · ') || c.name)}</p><h2>${esc(p.name)}</h2>
      <div class="pd-price"><strong>${money(p.price)}</strong>${offer ? `<s>${money(p.oldPrice)}</s>` : ''}</div>${stock}
      ${p.description ? `<p class="muted">${esc(p.description)}</p>` : ''}
      ${specs.length ? `<ul class="specs">${specs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      <div class="buy"><div class="qty" role="group" aria-label="Cantidad"><button type="button" data-act="pdMinus" aria-label="Menos">−</button><output id="pdQ" aria-live="polite">1</output><button type="button" data-act="pdPlus" aria-label="Más">+</button></div>
      <button type="button" class="btn btn-primary" data-act="pdAdd" data-id="${esc(p.id)}" ${st <= 0 ? 'disabled' : ''}>Agregar al carrito</button></div></div></div>`;
  $('#dlgProduct').showModal();
  $('#dlgProduct').scrollTop = 0;
}

/* ───────── Carrito (panel lateral) ───────── */
function openCart() { state.cartStep = 'cart'; state.orderErr = ''; renderCart(); const d = $('#dlgCart'); if (!d.open) d.showModal(); }
function renderCart() {
  const d = $('#dlgCart'), lines = cartLines(), total = cartTotal();
  const head = (t, back) => `<div class="dr-h">${back ? `<button type="button" class="btn btn-line btn-sm" data-act="cartBack">Volver</button>` : `<h2>${t}</h2>`}<button type="button" class="dlg-x x" data-act="closeDlg" aria-label="Cerrar">×</button></div>`;
  if (state.cartStep === 'done') {
    d.innerHTML = head('Pedido') + `<div class="dr-body"><div class="done"><div class="ok" aria-hidden="true">✓</div><h3>¡Recibimos tu pedido!</h3><p>Te escribimos por WhatsApp para coordinar el pago y la entrega.</p><span class="code">${esc(state.doneCode)}</span></div></div><div class="dr-f"><button type="button" class="btn btn-primary" data-act="closeDlg">Seguir mirando productos</button></div>`;
    return;
  }
  if (!lines.length) {
    d.innerHTML = head(`Tu carrito`) + `<div class="dr-body"><div class="empty" style="margin-top:16px"><h3>Tu carrito está vacío</h3><p>Agregá productos y los vas a ver acá con el total.</p><button type="button" class="btn btn-primary" data-act="closeDlg">Ver productos</button></div></div>`;
    return;
  }
  if (state.cartStep === 'checkout') {
    const v = state.form || {};
    d.innerHTML = head('', true) + `<form id="checkoutForm" class="dr-body" style="padding-top:18px" novalidate>
      <h2 style="font:800 22px var(--font-d);margin-bottom:14px">Tus datos</h2>
      <div class="field"><label for="f-name">Nombre y apellido</label><input class="in" id="f-name" name="name" autocomplete="name" required value="${esc(v.name)}"></div>
      <div class="field"><label for="f-phone">Teléfono o WhatsApp</label><input class="in" id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required value="${esc(v.phone)}"><small>Te contactamos a este número para confirmar el pedido.</small></div>
      <div class="field"><span>¿Cómo lo recibís?</span><div class="radios"><label><input type="radio" name="delivery" value="retiro" ${v.delivery !== 'envio' ? 'checked' : ''}> Retiro en el local</label><label><input type="radio" name="delivery" value="envio" ${v.delivery === 'envio' ? 'checked' : ''}> Envío a domicilio</label></div></div>
      <div class="field" id="addrField" ${v.delivery === 'envio' ? '' : 'hidden'}><label for="f-addr">Dirección de entrega</label><input class="in" id="f-addr" name="address" autocomplete="street-address" value="${esc(v.address)}"></div>
      <div class="field"><label for="f-note">Comentarios (opcional)</label><textarea class="in" id="f-note" name="note" rows="2">${esc(v.note)}</textarea></div>
      <p class="err" id="orderErr" role="alert" ${state.orderErr ? '' : 'hidden'}>${esc(state.orderErr)}</p>
    </form>
    <div class="dr-f"><div class="total"><span>Total a pagar</span><strong>${money(total)}</strong></div>
    <button type="submit" form="checkoutForm" class="btn btn-primary" ${state.sending ? 'disabled' : ''}>${state.sending ? 'Enviando pedido…' : 'Confirmar pedido'}</button>
    <p class="note">El pago se coordina con el local al confirmar tu pedido.</p></div>`;
    return;
  }
  d.innerHTML = head(`Tu carrito (${cartCount()})`) + `<div class="dr-body">${lines.map(({ p, qty, sub }) => `<div class="line">
      <img src="${esc(imgOf(p))}" alt="" style="--tint:${catOf(p).tint}">
      <div><p class="line-t">${esc(p.name)}</p><p class="line-u">${money(p.price)} c/u</p>
      <div class="line-r"><div class="qty sm" role="group" aria-label="Cantidad de ${esc(p.name)}"><button type="button" data-act="lineMinus" data-id="${esc(p.id)}" aria-label="Menos">−</button><output>${qty}</output><button type="button" data-act="linePlus" data-id="${esc(p.id)}" aria-label="Más">+</button></div><span class="line-sub">${money(sub)}</span></div>
      <button type="button" class="rm" data-act="lineRm" data-id="${esc(p.id)}">Quitar</button></div></div>`).join('')}</div>
    <div class="dr-f"><div class="total"><span>Total</span><strong>${money(total)}</strong></div>
    <button type="button" class="btn btn-primary" data-act="checkout">Finalizar compra</button>
    <button type="button" class="rm" data-act="clearCart">Vaciar carrito</button></div>`;
}

function readCheckout(form) {
  const f = new FormData(form);
  return { name: String(f.get('name') || '').trim(), phone: String(f.get('phone') || '').trim(), delivery: f.get('delivery') === 'envio' ? 'envio' : 'retiro', address: String(f.get('address') || '').trim(), note: String(f.get('note') || '').trim() };
}
function waText(order, code) {
  const l = order.items.map(i => `• ${i.qty} x ${i.name} — ${money(i.price * i.qty)}`).join('\n');
  return `Hola, quiero hacer este pedido (${code}):\n${l}\nTotal: ${money(order.total)}\n\nNombre: ${order.customer.name}\nTeléfono: ${order.customer.phone}\n${order.customer.delivery === 'envio' ? 'Envío a: ' + order.customer.address : 'Retiro en el local'}${order.customer.note ? '\nComentarios: ' + order.customer.note : ''}`;
}
async function submitOrder(form) {
  if (state.sending) return;
  const c = readCheckout(form); state.form = c;
  const fail = m => { state.orderErr = m; renderCart(); $('#orderErr')?.focus?.(); };
  if (!c.name) return fail('Escribí tu nombre.');
  if (digits(c.phone).length < 7) return fail('Escribí un teléfono válido para poder contactarte.');
  if (c.delivery === 'envio' && !c.address) return fail('Escribí la dirección de entrega.');
  const lines = cartLines();
  if (!lines.length) return fail('Tu carrito está vacío.');
  const order = {
    customer: c,
    items: lines.map(({ p, qty }) => ({ id: p.id, name: p.name, price: p.price, qty })),
    itemCount: lines.reduce((a, l) => a + l.qty, 0),
    total: cartTotal()
  };
  let win = null;
  if (state.settings.linkFallback && digits(state.settings.waNumber)) win = window.open('', '_blank');
  state.sending = true; state.orderErr = ''; renderCart();
  try {
    const code = await DB.createOrder(order);
    state.sending = false; state.cart = {}; saveCart(); state.form = null; state.doneCode = code; state.cartStep = 'done';
    renderCartBadge(); renderCart();
    if (win) win.location.href = `https://wa.me/${digits(state.settings.waNumber)}?text=${encodeURIComponent(waText(order, code))}`;
  } catch (e) {
    console.error(e); if (win) win.close();
    state.sending = false;
    fail('No pudimos enviar el pedido. Revisá tu conexión e intentá de nuevo.');
  }
}

/* ───────── Eventos ───────── */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (t) {
    const id = t.dataset.id, a = t.dataset.act;
    if (a === 'open') openProduct(id);
    else if (a === 'add') addToCart(id);
    else if (a === 'hero') setHero(+t.dataset.i);
    else if (a === 'sub') { state.sub = t.dataset.v; render(); }
    else if (a === 'clear') { state.sub = ''; state.onlyOffers = false; state.inStock = false; state.q = ''; $('#q').value = ''; render(); }
    else if (a === 'closeDlg') t.closest('dialog').close();
    else if (a === 'pdMinus') { pdQty = Math.max(1, pdQty - 1); $('#pdQ').textContent = pdQty; }
    else if (a === 'pdPlus') { const p = state.products.find(x => x.id === $('[data-act=pdAdd]').dataset.id); pdQty = Math.min(pdQty + 1, Math.min(stockOf(p), 99)); $('#pdQ').textContent = pdQty; }
    else if (a === 'pdAdd') { addToCart(id, pdQty); $('#dlgProduct').close(); }
    else if (a === 'lineMinus') setQty(id, (state.cart[id] || 0) - 1);
    else if (a === 'linePlus') setQty(id, (state.cart[id] || 0) + 1);
    else if (a === 'lineRm') setQty(id, 0);
    else if (a === 'clearCart') askConfirm('¿Vaciar el carrito?', 'Vaciar').then(ok => { if (ok) { state.cart = {}; saveCart(); renderCartBadge(); renderCart(); } });
    else if (a === 'checkout') { state.cartStep = 'checkout'; renderCart(); }
    else if (a === 'cartBack') { state.cartStep = 'cart'; renderCart(); }
    else if (a.startsWith('adm')) adminClick(a, t, e);
    return;
  }
  if (e.target.tagName === 'DIALOG') e.target.close(); // clic en el fondo
});
$('#cartBtn').addEventListener('click', openCart);
document.addEventListener('change', e => {
  const t = e.target, a = t.dataset?.act;
  if (a === 'sort') { state.sort = t.value; render(); }
  else if (a === 'onlyOffers') { state.onlyOffers = t.checked; render(); }
  else if (a === 'inStock') { state.inStock = t.checked; render(); }
  else if (t.name === 'delivery' && t.closest('#checkoutForm')) { $('#addrField').hidden = t.value !== 'envio'; }
  else if (a?.startsWith('adm')) adminChange(a, t);
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.id === 'checkoutForm') { e.preventDefault(); submitOrder(f); }
  else if (f.dataset?.form) { e.preventDefault(); adminSubmit(f); }
  else if (f.id === 'loginForm') { e.preventDefault(); doLogin(f); }
  else if (f.id === 'searchForm') e.preventDefault();
});
$('#q').addEventListener('input', e => {
  state.q = e.target.value.trim();
  if (state.route.name === 'admin') { location.hash = '#/'; return; }
  state.sub = ''; render();
});

/* ───────── Arranque ───────── */
function loadPublic() {
  const bad = err => { state.error = 'No se pudo conectar con el catálogo. Revisá tu conexión e intentá de nuevo.'; state.loaded.products = true; render(); };
  DB.subscribe('products', l => { state.products = l; state.loaded.products = true; state.error = ''; softRender(); }, bad);
  DB.subscribe('banners', l => { state.banners = l; state.loaded.banners = true; softRender(); });
  DB.subscribe('settings', l => {
    const s = l.find(x => x.id === 'store');
    state.settings = { ...DEFAULT_SETTINGS, ...(s || {}) };
    if (typeof state.settings.perks === 'string') state.settings.perks = state.settings.perks.split('\n');
    softRender();
  });
}
let adminListeners = false;
function loadOrders() {
  if (state.ordersUnsub) return;
  let first = true;
  state.ordersUnsub = DB.subscribe('orders', l => {
    if (!first && l.length > state.orders.length) toast('Llegó un pedido nuevo', { label: 'Ver', fn: () => { state.admin.tab = 'orders'; location.hash = '#/admin'; render(); } });
    first = false; state.orders = l; softRender();
  });
}
/* Re-render que no interrumpe a quien está escribiendo en el panel */
let pendingRender = false;
function softRender() {
  if (state.route.name === 'admin') {
    renderChrome();
    if (document.activeElement?.closest?.('#adminBody input, #adminBody select')) { pendingRender = true; return; }
    $('#adminShell') && renderAdminBody();
    if (!$('#adminShell')) render();
    renderCartBadge();
    return;
  }
  // En la tienda, no tocar la pantalla si hay un diálogo con foco en un formulario
  render();
  if ($('#dlgCart').open) renderCart();
}
document.addEventListener('focusout', () => { if (pendingRender) setTimeout(() => { if (!document.activeElement?.closest?.('#adminBody input, #adminBody select')) { pendingRender = false; renderAdminBody(); } }, 50); });

(async function init() {
  state.route = parseHash();
  render();
  try { DB = await openDB(); }
  catch (e) {
    console.error(e);
    state.error = 'No se pudo cargar la tienda. Revisá tu conexión e intentá de nuevo.'; state.loaded.products = true; render(); return;
  }
  render();
  loadPublic();
  DB.auth.onChange(u => {
    state.user = u; state.authReady = true;
    if (u) loadOrders(); else { state.ordersUnsub && state.ordersUnsub(); state.ordersUnsub = null; state.orders = []; }
    if (state.route.name === 'admin') render();
  });
})();
