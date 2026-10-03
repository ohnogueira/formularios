import { CAMPOS, MANUAL_GERAL } from './manual.js';
import { estadoVazio, normalizar, carregar, salvar, obterCaminho, definirCaminho, uid, agora } from './store.js';
import { Pad, prepararImagem, carregarImagem, girarImagem, girarTracos } from './pad.js';
import { calcularLayout, paraSVG, medidorJsPDF, opcoesSuperior } from './org.js';
import { gerarPDF, nomeArquivo } from './pdf.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let estado = estadoVazio();
let padCroqui = null;
let padAssinatura = null;
let passoAtual = 0;
const passos = $$('.passo');

// ---------------- Salvamento automático ----------------
let timerSalvar = null;
function alterado() {
  setStatus('Salvando…', false);
  clearTimeout(timerSalvar);
  timerSalvar = setTimeout(async () => {
    try {
      await salvar(estado);
      setStatus('Salvo neste aparelho', true);
    } catch (e) {
      console.error(e);
      setStatus('Não foi possível salvar no aparelho', false);
    }
  }, 400);
}
function setStatus(texto, ok) {
  const s = $('#status');
  s.textContent = texto;
  s.classList.toggle('ok', ok);
}

// ---------------- Orientações (pop-up) ----------------
const dlg = $('#dlg-ajuda');
function renderBlocos(blocos) {
  return blocos
    .map((b) => {
      if (b.lista) return `<ul>${b.lista.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
      return `<p${b.app ? ' class="app"' : ''}>${esc(b.p)}</p>`;
    })
    .join('');
}
function abrirAjuda(chave) {
  const c = CAMPOS[chave];
  if (!c) return;
  const [num, sub] = String(chave).split('.');
  $('#dlg-titulo').innerHTML = sub
    ? `Campo ${esc(num)} · ${esc(c.titulo)}<small>${esc(CAMPOS[num].titulo)}</small>`
    : `Campo ${esc(num)}<small>${esc(c.titulo)}</small>`;
  let html = renderBlocos(c.blocos);
  if (String(chave) === '10') {
    html += ['10.recurso', '10.identificador', '10.solicitacao', '10.hpc', '10.local', '10.notas']
      .map((k) => `<details><summary>${esc(CAMPOS[k].titulo)}</summary>${renderBlocos(CAMPOS[k].blocos)}</details>`)
      .join('');
  }
  html += '<p class="fonte">Fonte: instruções de preenchimento do modelo “SCI 201 – Briefing do Incidente”.</p>';
  $('#dlg-corpo').innerHTML = html;
  dlg.showModal();
  $('#dlg-corpo').scrollTop = 0;
}
function abrirGuia() {
  $('#dlg-titulo').innerHTML = `Guia de preenchimento<small>${esc(MANUAL_GERAL.titulo)}</small>`;
  let html = MANUAL_GERAL.secoes
    .map((s) => `<h4>${esc(s.titulo)}</h4>${s.lista ? renderBlocos([{ lista: s.lista }]) : `<p>${esc(s.texto)}</p>`}`)
    .join('');
  html += '<h4>Instruções por campo</h4>';
  for (const n of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']) {
    let corpo = renderBlocos(CAMPOS[n].blocos);
    if (n === '10') {
      corpo += ['10.recurso', '10.identificador', '10.solicitacao', '10.hpc', '10.local', '10.notas']
        .map((k) => `<p><strong>${esc(CAMPOS[k].titulo)}:</strong></p>${renderBlocos(CAMPOS[k].blocos)}`)
        .join('');
    }
    html += `<details><summary>${n}. ${esc(CAMPOS[n].titulo)}</summary>${corpo}</details>`;
  }
  html += `<h4>Como usar este app</h4>
    <ul>
      <li>Os dados são salvos automaticamente <strong>apenas neste aparelho</strong>. Nada é enviado para a internet.</li>
      <li>Após o primeiro acesso, o app funciona sem internet. Para instalar: no Android (Chrome), menu ⋮ → “Instalar app” ou “Adicionar à tela inicial”; no notebook (Chrome/Edge), ícone de instalação na barra de endereço.</li>
      <li>Toque no botão <strong>?</strong> ao lado de cada campo para ver a orientação de preenchimento.</li>
      <li>Na etapa “Finalizar”: baixe o PDF ou salve o arquivo do formulário para continuar depois ou repassar na transferência de comando.</li>
    </ul>
    <p class="fonte">Fonte: instruções de preenchimento do modelo “SCI 201 – Briefing do Incidente”.</p>`;
  $('#dlg-corpo').innerHTML = html;
  dlg.showModal();
  $('#dlg-corpo').scrollTop = 0;
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-campo]');
  if (b) abrirAjuda(b.dataset.campo);
});
$('#btn-guia').addEventListener('click', abrirGuia);
$('#dlg-fechar').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', (ev) => {
  if (ev.target === dlg) dlg.close();
});

// ---------------- Navegação entre etapas ----------------
function montarPassos() {
  const nav = $('#passos');
  nav.innerHTML = passos.map((p, i) => `<button type="button" data-ir="${i}">${esc(p.dataset.titulo)}</button>`).join('');
  nav.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ir]');
    if (b) irPara(Number(b.dataset.ir));
  });
}
function irPara(i) {
  passoAtual = Math.max(0, Math.min(passos.length - 1, i));
  passos.forEach((p, j) => p.classList.toggle('ativo', j === passoAtual));
  $$('#passos button').forEach((b, j) => {
    if (j === passoAtual) {
      b.setAttribute('aria-current', 'step');
      b.scrollIntoView({ block: 'nearest', inline: 'center' });
    } else b.removeAttribute('aria-current');
  });
  $('#btn-anterior').disabled = passoAtual === 0;
  $('#btn-proximo').classList.toggle('oculto', passoAtual === passos.length - 1);
  if (passos[passoAtual].dataset.passo === 'finalizar') renderPendencias();
  if (passos[passoAtual].dataset.passo === 'organizacao') renderOrgPreview();
  window.scrollTo({ top: 0 });
  try { sessionStorage.setItem('sci201-passo', String(passoAtual)); } catch { /* sem armazenamento */ }
}
$('#btn-anterior').addEventListener('click', () => irPara(passoAtual - 1));
$('#btn-proximo').addEventListener('click', () => irPara(passoAtual + 1));

// ---------------- Campos simples (data-bind) ----------------
function preencherCampos() {
  for (const el of $$('[data-bind]')) {
    const v = obterCaminho(estado, el.dataset.bind);
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v ?? '';
  }
  atualizarNorte();
}
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.dataset || !el.dataset.bind) return;
  definirCaminho(estado, el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
  if (el.dataset.bind === 'croqui.norte') atualizarNorte();
  if (el.hasAttribute('data-org')) renderOrgPreview();
  alterado();
});
document.addEventListener('change', (ev) => {
  if (ev.target.type === 'checkbox' && ev.target.dataset.bind) ev.target.dispatchEvent(new Event('input', { bubbles: true }));
});
$$('[data-agora]').forEach((b) =>
  b.addEventListener('click', () => {
    const alvo = estado[b.dataset.agora];
    Object.assign(alvo, agora());
    preencherCampos();
    alterado();
  }),
);

// ---------------- Campo 4: Croquis ----------------
let imagemCroqui = null;
function atualizarNorte() {
  $('#indicador-norte').classList.toggle('oculto', !estado.croqui.norte);
}
async function iniciarCroqui() {
  const c = estado.croqui;
  const canvas = $('#tela-croqui');
  canvas.width = c.largura;
  canvas.height = c.altura;
  imagemCroqui = c.imagem ? await carregarImagem(c.imagem) : null;
  if (!padCroqui) {
    padCroqui = new Pad(canvas, { tracos: c.tracos, fundo: imagemCroqui, aoMudar: alterado });
  } else {
    padCroqui.fundo = imagemCroqui;
    padCroqui.definirTracos(c.tracos);
  }
}
$$('#croqui-ferramentas .cor').forEach((b, i) => {
  b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
  b.addEventListener('click', () => {
    $$('#croqui-ferramentas .cor').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    padCroqui.cor = b.dataset.cor;
  });
});
$('#croqui-espessura').addEventListener('change', (ev) => (padCroqui.espessura = Number(ev.target.value)));
$('#croqui-desfazer').addEventListener('click', () => padCroqui.desfazer());
$('#croqui-limpar').addEventListener('click', () => {
  if (estado.croqui.tracos.length && confirm('Apagar todo o desenho feito sobre o croquis?')) padCroqui.limpar();
});
$('#croqui-arquivo').addEventListener('change', async (ev) => {
  const arq = ev.target.files[0];
  ev.target.value = '';
  if (!arq) return;
  if (estado.croqui.tracos.length && !confirm('Ao trocar a imagem, o desenho atual será apagado. Continuar?')) return;
  try {
    const { dataURL, largura, altura } = await prepararImagem(arq);
    Object.assign(estado.croqui, { imagem: dataURL, largura, altura });
    estado.croqui.tracos.length = 0;
    await iniciarCroqui();
    alterado();
  } catch (e) {
    alert('Não foi possível abrir a imagem. Tente outro arquivo (JPG ou PNG).');
  }
});
$('#croqui-girar').addEventListener('click', async () => {
  const c = estado.croqui;
  const larguraAntiga = c.largura;
  if (c.imagem) {
    const r = await girarImagem(c.imagem);
    Object.assign(c, { imagem: r.dataURL, largura: r.largura, altura: r.altura });
  } else {
    [c.largura, c.altura] = [c.altura, c.largura];
  }
  girarTracos(c.tracos, larguraAntiga, c.largura);
  await iniciarCroqui();
  alterado();
});
$('#croqui-remover-imagem').addEventListener('click', async () => {
  if (!estado.croqui.imagem) return;
  if (!confirm('Remover a imagem anexada? (O desenho permanece.)')) return;
  Object.assign(estado.croqui, { imagem: null, largura: 1400, altura: 1000 });
  await iniciarCroqui();
  alterado();
});

// ---------------- Campo 6: Assinatura ----------------
function iniciarAssinatura() {
  const canvas = $('#tela-assinatura');
  if (!padAssinatura) {
    padAssinatura = new Pad(canvas, { tracos: estado.preparadoPor.assinatura, espessura: 0.007, cor: '#0d2a6b', aoMudar: alterado });
  } else padAssinatura.definirTracos(estado.preparadoPor.assinatura);
}
$('#assinatura-desfazer').addEventListener('click', () => padAssinatura.desfazer());
$('#assinatura-limpar').addEventListener('click', () => padAssinatura.limpar());

// ---------------- Campo 8: Ações ----------------
function renderAcoes() {
  const el = $('#lista-acoes');
  if (!estado.acoes.length) {
    el.innerHTML = '<p class="vazio">Nenhuma ação registrada. Toque em “+ Adicionar ação”.</p>';
    return;
  }
  el.innerHTML = estado.acoes
    .map(
      (a, i) => `
    <div class="item" data-id="${a.id}">
      <div class="item-topo"><span>Ação ${i + 1}</span><button class="btn pequeno perigo" type="button" data-remover-acao="${a.id}">Remover</button></div>
      <div class="grade g2">
        <label class="campo"><span>Data</span><input type="date" data-acao="data" value="${esc(a.data)}"></label>
        <label class="campo"><span>Horário</span><input type="time" data-acao="hora" value="${esc(a.hora)}"></label>
      </div>
      <label class="campo"><span>Ações</span><textarea data-acao="texto" rows="3">${esc(a.texto)}</textarea></label>
    </div>`,
    )
    .join('');
}
$('#lista-acoes').addEventListener('input', (ev) => {
  const campo = ev.target.dataset.acao;
  if (!campo) return;
  const id = ev.target.closest('.item').dataset.id;
  estado.acoes.find((a) => a.id === id)[campo] = ev.target.value;
  alterado();
});
$('#lista-acoes').addEventListener('click', (ev) => {
  const id = ev.target.dataset.removerAcao;
  if (!id) return;
  const a = estado.acoes.find((x) => x.id === id);
  if ((a.texto || '').trim() && !confirm('Remover esta ação?')) return;
  estado.acoes = estado.acoes.filter((x) => x.id !== id);
  renderAcoes();
  alterado();
});
$('#add-acao').addEventListener('click', () => {
  const { data, hora } = agora();
  estado.acoes.push({ id: uid(), data, hora, texto: '' });
  renderAcoes();
  alterado();
  const ultimo = $('#lista-acoes .item:last-child textarea');
  ultimo?.focus();
});
$('#ordenar-acoes').addEventListener('click', () => {
  estado.acoes.sort((a, b) => `${a.data || '9999'}T${a.hora || '99'}`.localeCompare(`${b.data || '9999'}T${b.hora || '99'}`));
  renderAcoes();
  alterado();
});

// ---------------- Campo 9: Organização ----------------
function renderComandantes() {
  const org = estado.organizacao;
  $('#org-unificado').checked = org.unificado;
  const lista = org.unificado ? org.comandantes : org.comandantes.slice(0, 1);
  $('#lista-comandantes').innerHTML = lista
    .map(
      (c, i) => `
    <div class="item" data-id="${c.id}">
      ${org.unificado ? `<div class="item-topo"><span>Comandante ${i + 1}</span>${lista.length > 1 ? `<button class="btn pequeno perigo" type="button" data-remover-cmd="${c.id}">Remover</button>` : ''}</div>` : ''}
      <div class="grade g2">
        <label class="campo"><span>Nome</span><input type="text" data-cmd="nome" value="${esc(c.nome)}"></label>
        <label class="campo"><span>Instituição</span><input type="text" data-cmd="instituicao" value="${esc(c.instituicao)}"></label>
      </div>
    </div>`,
    )
    .join('');
  $('#add-comandante').classList.toggle('oculto', !org.unificado);
}
$('#org-unificado').addEventListener('change', (ev) => {
  const org = estado.organizacao;
  org.unificado = ev.target.checked;
  if (org.unificado && org.comandantes.length < 2) org.comandantes.push({ id: uid(), nome: '', instituicao: '' });
  renderComandantes();
  renderOrgPreview();
  alterado();
});
$('#add-comandante').addEventListener('click', () => {
  estado.organizacao.comandantes.push({ id: uid(), nome: '', instituicao: '' });
  renderComandantes();
  renderOrgPreview();
  alterado();
});
$('#lista-comandantes').addEventListener('input', (ev) => {
  const campo = ev.target.dataset.cmd;
  if (!campo) return;
  const id = ev.target.closest('.item').dataset.id;
  estado.organizacao.comandantes.find((c) => c.id === id)[campo] = ev.target.value;
  renderOrgPreview();
  alterado();
});
$('#lista-comandantes').addEventListener('click', (ev) => {
  const id = ev.target.dataset.removerCmd;
  if (!id) return;
  estado.organizacao.comandantes = estado.organizacao.comandantes.filter((c) => c.id !== id);
  renderComandantes();
  renderOrgPreview();
  alterado();
});

function renderExtras() {
  const org = estado.organizacao;
  if (!org.extras.length) {
    $('#lista-extras').innerHTML = '';
    return;
  }
  $('#lista-extras').innerHTML = org.extras
    .map((e) => {
      const ops = opcoesSuperior(org, e.id)
        .map((o) => `<option value="${esc(o.valor)}"${o.valor === e.superior ? ' selected' : ''}>${esc(o.rotulo)}</option>`)
        .join('');
      return `
    <div class="item" data-id="${e.id}">
      <div class="item-topo"><span>Cargo/função adicional</span><button class="btn pequeno perigo" type="button" data-remover-extra="${e.id}">Remover</button></div>
      <div class="grade g3">
        <label class="campo"><span>Cargo/Função</span><input type="text" data-extra="cargo" list="lista-extras-cargos" value="${esc(e.cargo)}"></label>
        <label class="campo"><span>Nome</span><input type="text" data-extra="nome" value="${esc(e.nome)}"></label>
        <label class="campo"><span>Subordinado a</span><select data-extra="superior">${ops}</select></label>
      </div>
    </div>`;
    })
    .join('');
}
function atualizarSelectsExtras() {
  // Atualiza os rótulos das opções sem recriar os campos de texto (mantém o foco).
  for (const sel of $$('#lista-extras select[data-extra="superior"]')) {
    const id = sel.closest('.item').dataset.id;
    const atual = estado.organizacao.extras.find((e) => e.id === id).superior;
    sel.innerHTML = opcoesSuperior(estado.organizacao, id)
      .map((o) => `<option value="${esc(o.valor)}"${o.valor === atual ? ' selected' : ''}>${esc(o.rotulo)}</option>`)
      .join('');
  }
}
$('#add-extra').addEventListener('click', () => {
  estado.organizacao.extras.push({ id: uid(), cargo: '', nome: '', superior: 'ci-staff' });
  renderExtras();
  renderOrgPreview();
  alterado();
  $('#lista-extras .item:last-child input')?.focus();
});
$('#lista-extras').addEventListener('input', (ev) => {
  const campo = ev.target.dataset.extra;
  if (!campo) return;
  const id = ev.target.closest('.item').dataset.id;
  estado.organizacao.extras.find((e) => e.id === id)[campo] = ev.target.value;
  if (campo !== 'superior') atualizarSelectsExtras();
  renderOrgPreview();
  alterado();
});
$('#lista-extras').addEventListener('click', (ev) => {
  const id = ev.target.dataset.removerExtra;
  if (!id) return;
  const org = estado.organizacao;
  const removido = org.extras.find((e) => e.id === id);
  // Subordinados do cargo removido passam ao superior dele.
  for (const e of org.extras) if (e.superior === id) e.superior = removido.superior;
  org.extras = org.extras.filter((e) => e.id !== id);
  renderExtras();
  renderOrgPreview();
  alterado();
});

let timerOrg = null;
function renderOrgPreview() {
  clearTimeout(timerOrg);
  timerOrg = setTimeout(() => {
    if (!window.jspdf) return;
    const layout = calcularLayout(estado.organizacao, 180, medidorJsPDF());
    $('#org-preview').innerHTML = paraSVG(layout);
  }, 120);
}

// ---------------- Campo 10: Recursos ----------------
function renderRecursos() {
  const el = $('#lista-recursos');
  if (!estado.recursos.length) {
    el.innerHTML = '<p class="vazio">Nenhum recurso registrado. Toque em “+ Adicionar recurso”.</p>';
    return;
  }
  const aj = (k, rot) => `<button class="ajuda mini" type="button" data-campo="10.${k}" aria-label="Como preencher: ${rot}">?</button>`;
  el.innerHTML = estado.recursos
    .map(
      (r, i) => `
    <div class="item" data-id="${r.id}">
      <div class="item-topo"><span>Recurso ${i + 1}</span><button class="btn pequeno perigo" type="button" data-remover-recurso="${r.id}">Remover</button></div>
      <div class="grade g2">
        <div class="campo"><span class="rotulo">Recurso ${aj('recurso', 'Recurso')}</span><input type="text" data-rec="recurso" value="${esc(r.recurso)}" placeholder="Ex.: HTP-5" aria-label="Recurso"></div>
        <div class="campo"><span class="rotulo">Identificador do Recurso ${aj('identificador', 'Identificador do Recurso')}</span><input type="text" data-rec="identificador" value="${esc(r.identificador)}" placeholder="Ex.: PR-EBM" aria-label="Identificador do Recurso"></div>
      </div>
      <div class="rotulo">Data/Hora da Solicitação ${aj('solicitacao', 'Data/Hora da Solicitação')}</div>
      <div class="grade g2">
        <input type="date" data-rec="solData" value="${esc(r.solData)}" aria-label="Data da solicitação">
        <input type="time" data-rec="solHora" value="${esc(r.solHora)}" aria-label="Hora da solicitação">
      </div>
      <div class="rotulo" style="margin-top:10px">HPC – Horário Previsto de Chegada ${aj('hpc', 'HPC')}</div>
      <div class="grade g2">
        <input type="date" data-rec="hpcData" value="${esc(r.hpcData)}" aria-label="Data prevista de chegada">
        <input type="time" data-rec="hpcHora" value="${esc(r.hpcHora)}" aria-label="Hora prevista de chegada">
      </div>
      <label class="check"><input type="checkbox" data-rec="noLocal"${r.noLocal ? ' checked' : ''}> No Local (recurso já está no local do incidente) ${aj('local', 'No Local')}</label>
      <div class="campo"><span class="rotulo">Notas (Localização/Designação/Status) ${aj('notas', 'Notas')}</span><textarea data-rec="notas" rows="2" aria-label="Notas">${esc(r.notas)}</textarea></div>
    </div>`,
    )
    .join('');
}
$('#lista-recursos').addEventListener('input', (ev) => {
  const campo = ev.target.dataset.rec;
  if (!campo) return;
  const id = ev.target.closest('.item').dataset.id;
  estado.recursos.find((r) => r.id === id)[campo] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
  alterado();
});
$('#lista-recursos').addEventListener('change', (ev) => {
  if (ev.target.type === 'checkbox' && ev.target.dataset.rec) ev.target.dispatchEvent(new Event('input', { bubbles: true }));
});
$('#lista-recursos').addEventListener('click', (ev) => {
  const id = ev.target.dataset.removerRecurso;
  if (!id) return;
  const r = estado.recursos.find((x) => x.id === id);
  if ((r.recurso || r.identificador || r.notas) && !confirm('Remover este recurso?')) return;
  estado.recursos = estado.recursos.filter((x) => x.id !== id);
  renderRecursos();
  alterado();
});
$('#add-recurso').addEventListener('click', () => {
  const { data, hora } = agora();
  estado.recursos.push({ id: uid(), recurso: '', identificador: '', solData: data, solHora: hora, hpcData: '', hpcHora: '', noLocal: false, notas: '' });
  renderRecursos();
  alterado();
  $('#lista-recursos .item:last-child input')?.focus();
});

// ---------------- Finalizar ----------------
function renderPendencias() {
  const e = estado;
  const p = [];
  if (!e.incidente.nome.trim()) p.push('1. Nome do Incidente');
  if (!e.incidente.numero.trim()) p.push('2. Número do Incidente');
  if (!e.incidente.data || !e.incidente.hora) p.push('3. Data/Hora de Início');
  if (!e.croqui.imagem && !e.croqui.tracos.length) p.push('4. Mapa/Croquis');
  if (!e.resumo.trim()) p.push('5. Resumo da situação e briefing de saúde e segurança');
  if (!e.preparadoPor.nome.trim() || !e.preparadoPor.cargo.trim()) p.push('6. Preparado por (nome e cargo/função)');
  if (!e.preparadoPor.data || !e.preparadoPor.hora) p.push('6. Preparado por (data/hora)');
  if (!e.objetivos.trim()) p.push('7. Objetivos atuais e planejados');
  if (!e.acoes.some((a) => (a.texto || '').trim())) p.push('8. Ações, estratégias e táticas');
  if (!e.organizacao.comandantes.some((c) => c.nome.trim())) p.push('9. Comandante(s) do Incidente');
  if (!e.recursos.length) p.push('10. Resumo dos Recursos');
  $('#pendencias').innerHTML = p.length
    ? `<div class="pendencias"><strong>Campos ainda não preenchidos</strong> (o PDF pode ser gerado assim mesmo, com os espaços em branco):<ul>${p.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`
    : '<div class="tudo-ok">Todos os campos principais foram preenchidos.</div>';
}

let ultimoPDF = null;
async function criarPDF() {
  const btn = $('#btn-pdf');
  btn.disabled = true;
  const texto = btn.textContent;
  btn.textContent = 'Gerando PDF…';
  try {
    const doc = await gerarPDF(estado);
    const nome = nomeArquivo(estado, 'pdf');
    ultimoPDF = new File([doc.output('blob')], nome, { type: 'application/pdf' });
    return { doc, nome };
  } finally {
    btn.disabled = false;
    btn.textContent = texto;
  }
}
$('#btn-pdf').addEventListener('click', async () => {
  try {
    const { doc, nome } = await criarPDF();
    doc.save(nome);
  } catch (e) {
    console.error(e);
    alert('Não foi possível gerar o PDF. Detalhe: ' + e.message);
  }
});
if (navigator.canShare) {
  try {
    const teste = new File(['x'], 't.pdf', { type: 'application/pdf' });
    if (navigator.canShare({ files: [teste] })) $('#btn-compartilhar').classList.remove('oculto');
  } catch { /* não suportado */ }
}
$('#btn-compartilhar').addEventListener('click', async () => {
  try {
    await criarPDF();
    await navigator.share({ files: [ultimoPDF], title: ultimoPDF.name });
  } catch (e) {
    if (e.name !== 'AbortError') alert('Não foi possível compartilhar. Use “Baixar PDF”.');
  }
});

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$('#btn-salvar-arquivo').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(estado)], { type: 'application/json' });
  baixar(blob, nomeArquivo(estado, 'json'));
});
$('#abrir-arquivo').addEventListener('change', async (ev) => {
  const arq = ev.target.files[0];
  ev.target.value = '';
  if (!arq) return;
  try {
    const dados = JSON.parse(await arq.text());
    if (dados.tipo !== 'SCI-201') throw new Error('Arquivo não é um formulário SCI-201 deste app.');
    if (!confirm('Abrir este arquivo substituirá o formulário atual neste aparelho. Continuar?')) return;
    await aplicarEstado(normalizar(dados));
    alterado();
    irPara(0);
  } catch (e) {
    alert('Não foi possível abrir o arquivo. ' + (e.message || ''));
  }
});
$('#btn-novo').addEventListener('click', async () => {
  if (!confirm('Apagar o formulário atual e iniciar um novo? Esta ação não pode ser desfeita.')) return;
  await aplicarEstado(estadoVazio());
  alterado();
  irPara(0);
});

// ---------------- Inicialização ----------------
async function aplicarEstado(novo) {
  estado = novo;
  preencherCampos();
  await iniciarCroqui();
  iniciarAssinatura();
  renderAcoes();
  renderComandantes();
  renderExtras();
  renderRecursos();
  renderOrgPreview();
}

async function iniciar() {
  montarPassos();
  const salvo = await carregar();
  await aplicarEstado(salvo || estadoVazio());
  if (salvo) setStatus('Salvo neste aparelho', true);
  else alterado();
  let inicial = 0;
  try { inicial = Number(sessionStorage.getItem('sci201-passo')) || 0; } catch { /* sem armazenamento */ }
  irPara(inicial);
}
iniciar();

// ---------------- PWA: instalação e atualização ----------------
let eventoInstalar = null;
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  eventoInstalar = ev;
  $('#btn-instalar').classList.remove('oculto');
});
$('#btn-instalar').addEventListener('click', async () => {
  if (!eventoInstalar) return;
  eventoInstalar.prompt();
  await eventoInstalar.userChoice;
  eventoInstalar = null;
  $('#btn-instalar').classList.add('oculto');
});
window.addEventListener('appinstalled', () => $('#btn-instalar').classList.add('oculto'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      const avisar = (sw) => {
        $('#aviso-atualizacao').classList.remove('oculto');
        $('#btn-atualizar').onclick = () => sw.postMessage('atualizar');
      };
      if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing;
        novo?.addEventListener('statechange', () => {
          if (novo.state === 'installed' && navigator.serviceWorker.controller) avisar(novo);
        });
      });
      let recarregando = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recarregando) return;
        recarregando = true;
        location.reload();
      });
    } catch (e) {
      console.warn('Service worker não registrado', e);
    }
  });
}
