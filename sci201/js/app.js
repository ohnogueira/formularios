import { CAMPOS, MANUAL_GERAL } from './manual.js';
import { estadoVazio, normalizar, carregar, salvar, obterCaminho, definirCaminho, uid, agora } from './store.js';
import { Pad, prepararImagem, carregarImagem, girarImagem, girarTracos } from './pad.js';
import { calcularLayout, paraSVG, medidorJsPDF, opcoesSuperior } from './org.js';
import { gerarPDF, nomeArquivo } from './pdf.js';
import { imprimirPDF, limparAreaImpressao } from './imprimir.js';
import { paraPlano, dePlano, planoDeAninhado, aninhar, diferencas, mesclar, resumoAlteracoes } from './sync.js';
import * as nuvem from './nuvem.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let estado = estadoVazio();
let padCroqui = null;
let padAssinatura = null;
let passoAtual = 0;
const passos = $$('.passo');
let modo = 'inicio'; // 'inicio' | 'local' | 'nuvem'
let podeEditar = true;

// ---------------- Salvamento automático ----------------
let timerSalvar = null;
function alterado() {
  limparAreaImpressao();
  if (modo === 'nuvem') {
    if (podeEditar) agendarEnvio();
    return;
  }
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
  comFoco($('#lista-acoes'), renderAcoesBase);
  travar();
}
function renderAcoesBase() {
  const el = $('#lista-acoes');
  if (!estado.acoes.length) {
    el.innerHTML = '<p class="vazio">Nenhuma ação registrada. Toque em “+ Adicionar ação”.</p>';
    return;
  }
  el.innerHTML = estado.acoes
    .map(
      (a, i) => `
    <div class="item" data-id="${a.id}">
      <div class="item-topo"><span>Ação ${i + 1}</span><button class="btn pequeno perigo so-edicao" type="button" data-remover-acao="${a.id}">Remover</button></div>
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
  comFoco($('#lista-comandantes'), renderComandantesBase);
  travar();
}
function renderComandantesBase() {
  const org = estado.organizacao;
  $('#org-unificado').checked = org.unificado;
  const lista = org.unificado ? org.comandantes : org.comandantes.slice(0, 1);
  $('#lista-comandantes').innerHTML = lista
    .map(
      (c, i) => `
    <div class="item" data-id="${c.id}">
      ${org.unificado ? `<div class="item-topo"><span>Comandante ${i + 1}</span>${lista.length > 1 ? `<button class="btn pequeno perigo so-edicao" type="button" data-remover-cmd="${c.id}">Remover</button>` : ''}</div>` : ''}
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
  comFoco($('#lista-extras'), renderExtrasBase);
  travar();
}
function renderExtrasBase() {
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
      <div class="item-topo"><span>Cargo/função adicional</span><button class="btn pequeno perigo so-edicao" type="button" data-remover-extra="${e.id}">Remover</button></div>
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
  comFoco($('#lista-recursos'), renderRecursosBase);
  travar();
}
function renderRecursosBase() {
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
      <div class="item-topo"><span>Recurso ${i + 1}</span><button class="btn pequeno perigo so-edicao" type="button" data-remover-recurso="${r.id}">Remover</button></div>
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

// PDF e impressão disponíveis em qualquer etapa (topo da tela) e na etapa Finalizar.
let ultimoPDF = null;
let ocupado = false;
async function comPDF(acao, botoes, textoOcupado) {
  if (ocupado) return;
  ocupado = true;
  const originais = botoes.map((b) => b.textContent);
  botoes.forEach((b) => {
    b.disabled = true;
    b.textContent = textoOcupado;
  });
  try {
    const doc = await gerarPDF(estado);
    const nome = nomeArquivo(estado, 'pdf');
    ultimoPDF = new File([doc.output('blob')], nome, { type: 'application/pdf' });
    await acao(doc, nome);
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error(e);
      alert('Não foi possível concluir a operação. Detalhe: ' + e.message);
    }
  } finally {
    botoes.forEach((b, i) => {
      b.disabled = false;
      b.textContent = originais[i];
    });
    ocupado = false;
  }
}
const salvarPDF = (botao) => comPDF((doc, nome) => doc.save(nome), [botao], 'Gerando…');
const imprimir = (botao) => comPDF(() => imprimirPDF(ultimoPDF), [botao], 'Preparando…');
$('#btn-pdf').addEventListener('click', (ev) => salvarPDF(ev.currentTarget));
$('#btn-topo-pdf').addEventListener('click', (ev) => salvarPDF(ev.currentTarget));
$('#btn-imprimir').addEventListener('click', (ev) => imprimir(ev.currentTarget));
$('#btn-topo-imprimir').addEventListener('click', (ev) => imprimir(ev.currentTarget));
if (navigator.canShare) {
  try {
    const teste = new File(['x'], 't.pdf', { type: 'application/pdf' });
    if (navigator.canShare({ files: [teste] })) $('#btn-compartilhar').classList.remove('oculto');
  } catch { /* não suportado */ }
}
$('#btn-compartilhar').addEventListener('click', (ev) =>
  comPDF(() => navigator.share({ files: [ultimoPDF], title: ultimoPDF.name }), [ev.currentTarget], 'Gerando…'),
);

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
    const aviso = modo === 'nuvem'
      ? 'Importar este arquivo substituirá o conteúdo do incidente compartilhado (para todos). Continuar?'
      : 'Abrir este arquivo substituirá o formulário atual neste aparelho. Continuar?';
    if (!confirm(aviso)) return;
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

// ---------------- Estado na tela ----------------
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
  travar();
}

// Recria uma lista preservando o campo em edição (cursor), quando dados chegam de outra pessoa.
function comFoco(container, fn) {
  const ativo = document.activeElement;
  let info = null;
  if (ativo && container.contains(ativo)) {
    const item = ativo.closest('[data-id]');
    const attr = ['data-acao', 'data-rec', 'data-cmd', 'data-extra'].find((a) => ativo.hasAttribute(a));
    if (item && attr) info = { id: item.dataset.id, attr, valor: ativo.getAttribute(attr), ini: ativo.selectionStart, fim: ativo.selectionEnd };
  }
  fn();
  if (!info) return;
  const el = container.querySelector(`[data-id="${CSS.escape(info.id)}"] [${info.attr}="${info.valor}"]`);
  if (!el) return;
  el.focus();
  try {
    el.setSelectionRange(info.ini, info.fim);
  } catch { /* campo sem seleção de texto */ }
}

// Somente leitura: desabilita campos e esconde os comandos de edição.
function travar() {
  const leitura = !podeEditar;
  document.body.classList.toggle('somente-leitura', leitura);
  for (const el of $$('#conteudo .passo input, #conteudo .passo textarea, #conteudo .passo select')) el.disabled = leitura;
  if (padCroqui) padCroqui.ativo = !leitura;
  if (padAssinatura) padAssinatura.ativo = !leitura;
}

// ---------------- Modos e navegação entre telas ----------------
const params = new URLSearchParams(location.search);
function urlPara(consulta) {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  for (const [k, v] of Object.entries(consulta)) u.searchParams.set(k, v);
  if (params.has('emulador')) u.searchParams.set('emulador', '');
  return u.toString().replace(/=(&|$)/g, '$1');
}
const navegar = (consulta) => location.assign(urlPara(consulta));

function definirModo(m) {
  modo = m;
  document.body.classList.remove('modo-inicio', 'modo-local', 'modo-nuvem');
  document.body.classList.add('modo-' + m);
  $('#tela-inicio').classList.toggle('oculto', m !== 'inicio');
  $('#barra-modo').classList.toggle('oculto', m === 'inicio');
}

$('#btn-inicio').addEventListener('click', async () => {
  if (modo === 'nuvem') {
    enviar();
    descarregarHistorico();
    await nuvem.esperarEnvios(1500);
  }
  navegar({});
});
$('#btn-abrir-local').addEventListener('click', () => navegar({ local: '' }));

function abrirDialogo(titulo, subtitulo, html) {
  $('#dlg-titulo').innerHTML = `${esc(titulo)}${subtitulo ? `<small>${esc(subtitulo)}</small>` : ''}`;
  const corpo = $('#dlg-corpo');
  corpo.innerHTML = html;
  if (!dlg.open) dlg.showModal();
  corpo.scrollTop = 0;
  return corpo;
}

const fmtData = (d) =>
  d ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

async function entrar() {
  try {
    await nuvem.entrar();
  } catch (e) {
    console.error(e);
    const msgs = {
      'auth/unauthorized-domain': 'Este endereço ainda não está autorizado no Firebase (Authentication → Configurações → Domínios autorizados).',
      'auth/network-request-failed': 'Sem conexão com a internet. O login exige internet.',
    };
    alert('Não foi possível entrar. ' + (msgs[e.code] || e.message || ''));
  }
}

// ---------------- Tela inicial ----------------
async function iniciarInicio() {
  definirModo('inicio');
  const alvo = $('#inicio-nuvem');
  if (!nuvem.configurado()) {
    alvo.innerHTML = '<p class="pendencias">O modo compartilhado ainda não foi configurado neste app. Use o formulário local.</p>';
    return;
  }
  alvo.innerHTML = '<p class="vazio">Carregando…</p>';
  try {
    await nuvem.iniciarNuvem();
  } catch (e) {
    console.error(e);
    alvo.innerHTML = '<p class="pendencias">Não foi possível carregar o modo compartilhado (verifique a internet). O formulário local funciona sem internet.</p>';
    return;
  }
  nuvem.aoMudarUsuario(() => renderInicioNuvem());
}

async function renderInicioNuvem() {
  const alvo = $('#inicio-nuvem');
  const u = nuvem.usuario();
  if (!u) {
    alvo.innerHTML = `
      <p>Para <strong>criar</strong> um incidente ou <strong>editar</strong>, entre com sua conta Google.<br>
      Para apenas <strong>consultar</strong>, basta abrir o link do incidente recebido.</p>
      <button class="btn primario" type="button" id="btn-entrar">Entrar com Google</button>`;
    $('#btn-entrar').onclick = entrar;
    return;
  }
  alvo.innerHTML = `
    <div class="conta"><span class="quem">Conectado como <strong>${esc(u.nome)}</strong><br><small>${esc(u.email)}</small></span>
      <button class="btn pequeno" type="button" id="btn-sair">Sair</button></div>
    <button class="btn primario" type="button" id="btn-novo-incidente">+ Novo incidente compartilhado</button>
    <div class="lista-incidentes" id="lista-incidentes"><p class="vazio">Carregando seus incidentes…</p></div>`;
  $('#btn-sair').onclick = () => nuvem.sair();
  $('#btn-novo-incidente').onclick = async (ev) => {
    ev.currentTarget.disabled = true;
    try {
      const id = await criarIncidenteCom(estadoVazio());
      await nuvem.esperarEnvios(3000);
      navegar({ i: id });
    } catch (e) {
      alert('Não foi possível criar o incidente. ' + e.message);
      ev.currentTarget.disabled = false;
    }
  };
  try {
    const lista = await nuvem.meusIncidentes();
    $('#lista-incidentes').innerHTML = lista.length
      ? lista
          .map(
            (i) => `<button class="incidente" type="button" data-abrir="${esc(i.id)}">
              <strong>${esc(i.nome || 'Incidente sem nome')}${i.encerrado ? '<span class="selo encerrado">Encerrado</span>' : '<span class="selo">Em andamento</span>'}${i.dono ? '<span class="selo dono">Criado por você</span>' : ''}</strong>
              <small>${i.numero ? `Nº ${esc(i.numero)} · ` : ''}Atualizado ${esc(fmtData(i.atualizadoEm))}${i.atualizadoPor ? ` por ${esc(i.atualizadoPor)}` : ''}</small>
            </button>`,
          )
          .join('')
      : '<p class="vazio">Nenhum incidente em que você seja editor.</p>';
    $('#lista-incidentes').onclick = (ev) => {
      const b = ev.target.closest('[data-abrir]');
      if (b) navegar({ i: b.dataset.abrir });
    };
  } catch (e) {
    console.error(e);
    $('#lista-incidentes').innerHTML = '<p class="vazio">Não foi possível carregar a lista (verifique a internet).</p>';
  }
}

function anexosDe(est) {
  return {
    croquiImagem: { imagem: est.croqui.imagem || null, largura: est.croqui.largura, altura: est.croqui.altura },
    croquiDesenho: { tracos: JSON.stringify(est.croqui.tracos || []) },
  };
}
async function criarIncidenteCom(est) {
  return nuvem.criarIncidente({
    dados: aninhar(paraPlano(est)),
    ...anexosDe(est),
    nome: est.incidente.nome,
    numero: est.incidente.numero,
  });
}

// ---------------- Formulário local ----------------
async function iniciarLocal() {
  definirModo('local');
  podeEditar = true;
  const salvo = await carregar();
  await aplicarEstado(salvo || estadoVazio());
  if (salvo) setStatus('Salvo neste aparelho', true);
  else alterado();
  renderBarra();
}

async function localParaNuvem() {
  if (!nuvem.configurado()) return alert('O modo compartilhado ainda não foi configurado neste app.');
  try {
    await nuvem.iniciarNuvem();
    if (!nuvem.usuario()) {
      await entrar();
      if (!nuvem.usuario()) return;
    }
    if (!confirm('Criar um incidente compartilhado com os dados deste formulário? O formulário local continua salvo neste aparelho.')) return;
    const id = await criarIncidenteCom(estado);
    await nuvem.esperarEnvios(3000);
    navegar({ i: id });
  } catch (e) {
    console.error(e);
    alert('Não foi possível criar o incidente compartilhado. ' + (e.message || ''));
  }
}
$('#btn-local-para-nuvem').addEventListener('click', localParaNuvem);

// ---------------- Incidente compartilhado ----------------
let ctx = null; // { id, base, baseImg, baseDes, info, carregado }
const IMG_PADRAO = { imagem: null, largura: 1400, altura: 1000 };
const jsonImg = (c) => JSON.stringify({ imagem: c.imagem || null, largura: c.largura, altura: c.altura });

async function iniciarIncidente(id) {
  definirModo('nuvem');
  podeEditar = false;
  ctx = { id, base: null, baseImg: null, baseDes: null, info: null, carregado: false };
  await aplicarEstado(estadoVazio());
  setStatus('Carregando incidente…', false);
  renderBarra();
  if (!nuvem.configurado()) {
    renderBarra('O modo compartilhado não está configurado neste app.');
    return;
  }
  try {
    await nuvem.iniciarNuvem();
  } catch (e) {
    console.error(e);
    renderBarra('Não foi possível carregar o incidente. Verifique a internet e recarregue a página.');
    return;
  }
  nuvem.aoMudarUsuario(() => {
    atualizarPermissao();
    renderBarra();
  });
  nuvem.observarIncidente(id, { aoDados, aoImagem, aoDesenho, aoErro: (e) => {
    console.error(e);
    setStatus('Erro de conexão com o incidente', false);
  } });
}

function atualizarPermissao() {
  const u = nuvem.usuario();
  const i = ctx?.info;
  const antes = podeEditar;
  podeEditar = !!(u && i && ctx.carregado && i.editores.includes(u.email) && !i.encerrado);
  if (antes !== podeEditar) travar();
}

async function aoDados(dados, meta) {
  if (!dados) {
    renderBarra(meta.fromCache
      ? 'Sem conexão: este incidente ainda não foi aberto neste aparelho. Conecte-se à internet e recarregue.'
      : 'Incidente não encontrado. Verifique o link recebido.');
    setStatus('', false);
    return;
  }
  ctx.info = {
    nome: dados.nome, numero: dados.numero, donoUid: dados.donoUid, donoEmail: dados.donoEmail, donoNome: dados.donoNome,
    editores: dados.editores || [], encerrado: !!dados.encerrado,
    atualizadoEm: dados.atualizadoEm?.toDate?.() || null, atualizadoPor: dados.atualizadoPor || '',
  };
  const remoto = planoDeAninhado(dados.dados || {});
  if (!ctx.carregado) {
    ctx.carregado = true;
    ctx.base = remoto;
    const novo = dePlano(remoto);
    copiarCroqui(novo);
    await aplicarEstado(novo);
    let inicial = 0;
    try { inicial = Number(sessionStorage.getItem('sci201-passo')) || 0; } catch { /* sem armazenamento */ }
    irPara(inicial);
  } else {
    const local = paraPlano(estado);
    const mesclado = mesclar(ctx.base, local, remoto);
    ctx.base = remoto;
    aplicarRemoto(local, mesclado);
  }
  atualizarPermissao();
  renderBarra();
  ctx.meta = meta;
  statusNuvem();
}

function statusNuvem() {
  const meta = ctx?.meta;
  if (!meta) return;
  if (!navigator.onLine) {
    setStatus(meta.hasPendingWrites ? 'Sem internet — alterações guardadas, serão enviadas ao reconectar' : 'Sem internet — exibindo a última versão recebida', false);
  } else if (meta.hasPendingWrites) setStatus('Enviando alterações…', false);
  else if (meta.fromCache) setStatus('Conectando…', false);
  else setStatus('Sincronizado', true);
}
window.addEventListener('online', () => modo === 'nuvem' && statusNuvem());
window.addEventListener('offline', () => modo === 'nuvem' && statusNuvem());

function copiarCroqui(novo) {
  Object.assign(novo.croqui, {
    imagem: estado.croqui.imagem, largura: estado.croqui.largura, altura: estado.croqui.altura, tracos: estado.croqui.tracos,
  });
}

function aplicarRemoto(localPlano, mesclado) {
  const mudou = Object.keys({ ...localPlano, ...mesclado }).filter((k) => localPlano[k] !== mesclado[k]);
  if (!mudou.length) return;
  const novo = dePlano(mesclado);
  copiarCroqui(novo);
  estado = novo;
  for (const el of $$('[data-bind]')) {
    if (el === document.activeElement) continue;
    const v = obterCaminho(estado, el.dataset.bind);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.value !== (v ?? '')) el.value = v ?? '';
  }
  atualizarNorte();
  padAssinatura.definirTracos(estado.preparadoPor.assinatura);
  const toca = (p) => mudou.some((k) => k.startsWith(p));
  if (toca('acoes.')) renderAcoes();
  if (toca('recursos.')) renderRecursos();
  if (toca('organizacao.')) {
    renderComandantes();
    renderExtras();
    renderOrgPreview();
  }
  limparAreaImpressao();
  if (passos[passoAtual]?.dataset.passo === 'finalizar') renderPendencias();
}

function aoImagem(d) {
  const remoto = JSON.stringify(d ? { imagem: d.imagem ?? null, largura: d.largura ?? 1400, altura: d.altura ?? 1000 } : IMG_PADRAO);
  const local = jsonImg(estado.croqui);
  if ((ctx.baseImg === null || local === ctx.baseImg) && remoto !== local) {
    Object.assign(estado.croqui, JSON.parse(remoto));
    iniciarCroqui();
  }
  ctx.baseImg = remoto;
}

function aoDesenho(d) {
  const remoto = d?.tracos || '[]';
  const local = JSON.stringify(estado.croqui.tracos);
  if ((ctx.baseDes === null || local === ctx.baseDes) && remoto !== local) {
    try {
      estado.croqui.tracos = JSON.parse(remoto);
    } catch {
      estado.croqui.tracos = [];
    }
    padCroqui.definirTracos(estado.croqui.tracos);
  }
  ctx.baseDes = remoto;
}

// Envio das alterações (somente campos alterados) e histórico agrupado por minuto.
let timerEnvio = null;
let timerHist = null;
let ultimoHist = 0;
const hist = { campos: new Set(), detalhes: new Map() };
function agendarEnvio() {
  setStatus('Alterações pendentes…', false);
  clearTimeout(timerEnvio);
  timerEnvio = setTimeout(enviar, 1500);
}
function acumularHistorico(r) {
  r.campos.forEach((c) => hist.campos.add(c));
  r.detalhes.forEach((d) => hist.detalhes.set(d.campo, d.valor));
}
function tirarHistorico(forcar) {
  if (!hist.campos.size) return null;
  if (!forcar && Date.now() - ultimoHist < 60000) {
    clearTimeout(timerHist);
    timerHist = setTimeout(descarregarHistorico, 61000);
    return null;
  }
  ultimoHist = Date.now();
  const r = { campos: [...hist.campos], detalhes: [...hist.detalhes].slice(-40).map(([campo, valor]) => ({ campo, valor })) };
  hist.campos.clear();
  hist.detalhes.clear();
  return r;
}
function descarregarHistorico() {
  if (!ctx || !podeEditar) return;
  const r = tirarHistorico(true);
  if (r) nuvem.registrarHistorico(ctx.id, r).catch(erroEnvio);
}
function erroEnvio(e) {
  console.error(e);
  setStatus(e.code === 'permission-denied' ? 'Sem permissão para editar este incidente' : 'Erro ao enviar alterações', false);
}
function enviar() {
  clearTimeout(timerEnvio);
  if (!ctx?.carregado || !podeEditar) return;
  const atual = paraPlano(estado);
  const { alterados, removidos } = diferencas(ctx.base, atual);
  const temDados = Object.keys(alterados).length || removidos.length;
  if (temDados) acumularHistorico(resumoAlteracoes(alterados, removidos));
  const img = jsonImg(estado.croqui);
  const imgMudou = ctx.baseImg !== null && img !== ctx.baseImg;
  const des = JSON.stringify(estado.croqui.tracos);
  let desMudou = ctx.baseDes !== null && des !== ctx.baseDes;
  if (desMudou && des.length > 900000) {
    desMudou = false;
    alert('O desenho do croquis ficou grande demais para ser compartilhado. Use “Desfazer” ou “Apagar desenho” e simplifique o desenho.');
  }
  if (imgMudou || desMudou) {
    acumularHistorico({ campos: ['4. Mapa/Croquis'], detalhes: [{ campo: '4. Mapa/Croquis', valor: imgMudou ? '(imagem alterada)' : '(desenho alterado)' }] });
  }
  const r = tirarHistorico(false);
  if (temDados) {
    ctx.base = atual;
    nuvem.enviarAlteracoes(ctx.id, alterados, removidos, r).catch(erroEnvio);
  } else if (r) nuvem.registrarHistorico(ctx.id, r).catch(erroEnvio);
  if (imgMudou) {
    ctx.baseImg = img;
    nuvem.salvarAnexo(ctx.id, 'croquiImagem', JSON.parse(img)).catch(erroEnvio);
  }
  if (desMudou) {
    ctx.baseDes = des;
    nuvem.salvarAnexo(ctx.id, 'croquiDesenho', { tracos: des }).catch(erroEnvio);
  }
}
window.addEventListener('pagehide', () => {
  if (modo === 'nuvem') {
    enviar();
    descarregarHistorico();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && modo === 'nuvem') {
    enviar();
    descarregarHistorico();
  }
});

// ---------------- Barra de situação (modo local / compartilhado) ----------------
function renderBarra(erro) {
  const b = $('#barra-modo');
  b.className = 'barra-modo so-form';
  if (modo === 'local') {
    b.classList.add('local');
    b.innerHTML = `<div class="texto"><strong>Formulário local</strong>Salvo somente neste aparelho. Funciona sem internet.</div>
      ${nuvem.configurado() ? '<div class="acoes-linha"><button class="btn pequeno azul" type="button" data-barra="compartilhar">Compartilhar com a equipe</button></div>' : ''}`;
    return;
  }
  if (erro) {
    b.classList.add('leitura');
    b.innerHTML = `<div class="texto"><strong>Incidente compartilhado</strong>${esc(erro)}</div>`;
    return;
  }
  const i = ctx?.info;
  if (!i) {
    b.innerHTML = '<div class="texto"><strong>Incidente compartilhado</strong>Carregando…</div>';
    return;
  }
  const u = nuvem.usuario();
  const atualizado = i.atualizadoEm ? `Atualizado em ${esc(fmtData(i.atualizadoEm))}${i.atualizadoPor ? ` por ${esc(i.atualizadoPor)}` : ''}.` : '';
  const ehEditor = u && i.editores.includes(u.email);
  const ehDono = u && u.uid === i.donoUid;
  const botoes = ['<button class="btn pequeno" type="button" data-barra="link">Link de consulta</button>'];
  let texto;
  if (i.encerrado) {
    b.classList.add('encerrado');
    texto = `<strong>Incidente encerrado — somente consulta</strong>${atualizado}`;
  } else if (podeEditar) {
    texto = `<strong>Incidente compartilhado · você está editando</strong>Conectado como ${esc(u.nome)}. As alterações aparecem em tempo real para quem tem o link. ${atualizado}`;
  } else if (u) {
    b.classList.add('leitura');
    texto = `<strong>Somente consulta</strong>A conta ${esc(u.email)} não está autorizada a editar. Peça ao Comandante do Incidente para incluí-la. ${atualizado}`;
  } else {
    b.classList.add('leitura');
    texto = `<strong>Somente consulta · atualizado em tempo real</strong>${atualizado}`;
    botoes.push('<button class="btn pequeno azul" type="button" data-barra="entrar">Entrar para editar</button>');
  }
  if (ehEditor) {
    botoes.push(`<button class="btn pequeno" type="button" data-barra="editores">${ehDono ? 'Editores' : 'Ver editores'}</button>`);
    botoes.push('<button class="btn pequeno" type="button" data-barra="historico">Histórico</button>');
  }
  if (u) botoes.push('<button class="btn pequeno" type="button" data-barra="sair">Sair</button>');
  b.innerHTML = `<div class="texto">${texto}</div><div class="acoes-linha">${botoes.join('')}</div>`;
}

$('#barra-modo').addEventListener('click', (ev) => {
  const acao = ev.target.closest('[data-barra]')?.dataset.barra;
  if (!acao) return;
  if (acao === 'compartilhar') localParaNuvem();
  if (acao === 'entrar') entrar();
  if (acao === 'sair') nuvem.sair();
  if (acao === 'link') dialogoLink();
  if (acao === 'editores') dialogoEditores();
  if (acao === 'historico') dialogoHistorico();
});

function linkConsulta() {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('i', ctx.id);
  if (params.has('emulador')) u.searchParams.set('emulador', '');
  return u.toString().replace(/=(&|$)/g, '$1');
}

function dialogoLink() {
  const link = linkConsulta();
  const nome = ctx.info?.nome || 'Incidente';
  const texto = `SCI-201 · ${nome}: ${link}`;
  const corpo = abrirDialogo('Link de consulta', nome, `
    <p>Qualquer pessoa com este link pode <strong>consultar, imprimir e gerar o PDF</strong> do SCI-201 deste incidente, sem login, com atualização em tempo real.</p>
    <p>Para <strong>editar</strong>, a pessoa precisa entrar com uma conta Google autorizada pelo Comandante do Incidente (botão “Editores”).</p>
    <div class="link-caixa"><input type="text" readonly value="${esc(link)}" aria-label="Link do incidente"><button class="btn pequeno" type="button" data-l="copiar">Copiar</button></div>
    <div class="acoes-linha">
      <a class="btn pequeno" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>
      ${navigator.share ? '<button class="btn pequeno" type="button" data-l="compartilhar">Compartilhar…</button>' : ''}
    </div>
    <p class="fonte">Atenção: não publique o link em locais abertos. Quem tiver o link consegue ler o formulário.</p>`);
  corpo.onclick = async (ev) => {
    const a = ev.target.closest('[data-l]')?.dataset.l;
    if (a === 'copiar') {
      try {
        await navigator.clipboard.writeText(link);
        ev.target.textContent = 'Copiado';
      } catch {
        corpo.querySelector('input').select();
      }
    }
    if (a === 'compartilhar') navigator.share({ title: `SCI-201 · ${nome}`, text: texto, url: link }).catch(() => {});
  };
}

function dialogoEditores() {
  const i = ctx.info;
  const u = nuvem.usuario();
  const ehDono = u && u.uid === i.donoUid;
  const desenhar = () => {
    const linhas = i.editores
      .map((e) => `<div class="editor-linha"><span>${esc(e)}${e === i.donoEmail ? ' <span class="selo dono">Criador</span>' : ''}</span>
        ${ehDono && e !== i.donoEmail ? `<button class="btn pequeno perigo" type="button" data-rem="${esc(e)}">Remover</button>` : ''}</div>`)
      .join('');
    const corpo = abrirDialogo('Editores do incidente', i.nome || '', `
      <p>Somente estas contas Google podem editar o SCI-201 deste incidente (por exemplo: Comandante do Incidente e Líder de Documentação).</p>
      ${linhas}
      ${ehDono ? `
        <form id="form-editor" class="acoes-linha" style="margin-top:12px">
          <input type="email" required placeholder="e-mail da conta Google" aria-label="E-mail do novo editor" style="flex:1 1 220px">
          <button class="btn pequeno azul" type="submit">Autorizar</button>
        </form>
        <h4>Situação do incidente</h4>
        <p>${i.encerrado ? 'Encerrado: ninguém edita.' : 'Em andamento.'}</p>
        <button class="btn pequeno ${i.encerrado ? '' : 'perigo'}" type="button" data-enc="1">${i.encerrado ? 'Reabrir incidente' : 'Encerrar incidente'}</button>` : '<p class="fonte">Somente quem criou o incidente pode alterar a lista de editores.</p>'}`);
    corpo.onclick = async (ev) => {
      const rem = ev.target.closest('[data-rem]')?.dataset.rem;
      if (rem && confirm(`Remover a permissão de edição de ${rem}?`)) {
        await nuvem.definirEditores(ctx.id, i.editores.filter((e) => e !== rem), `Editor removido: ${rem}`).catch(erroEnvio);
        desenhar();
      }
      if (ev.target.closest('[data-enc]')) {
        const novo = !i.encerrado;
        if (!confirm(novo ? 'Encerrar o incidente? O formulário ficará somente para consulta.' : 'Reabrir o incidente para edição?')) return;
        enviar();
        await nuvem.definirEncerrado(ctx.id, novo).catch(erroEnvio);
        desenhar();
      }
    };
    const form = corpo.querySelector('#form-editor');
    if (form) {
      form.onsubmit = async (ev) => {
        ev.preventDefault();
        const email = form.querySelector('input').value.trim().toLowerCase();
        if (!email || i.editores.includes(email)) return;
        await nuvem.definirEditores(ctx.id, [...i.editores, email], `Editor autorizado: ${email}`).catch(erroEnvio);
        desenhar();
      };
    }
  };
  desenhar();
}

async function dialogoHistorico() {
  const corpo = abrirDialogo('Histórico de alterações', ctx.info?.nome || '', '<p class="vazio">Carregando…</p>');
  try {
    const itens = await nuvem.historico(ctx.id);
    corpo.innerHTML = itens.length
      ? itens
          .map((h) => `<div class="hist-item">
            <div class="quando">${esc(fmtData(h.em))} · ${esc(h.nome || '')} (${esc(h.email || '')})</div>
            <strong>${esc(h.acao)}</strong>${h.campos?.length ? `: ${esc(h.campos.join('; '))}` : ''}
            ${h.detalhes?.length ? `<details><summary>Detalhes</summary><ul>${h.detalhes.map((d) => `<li><strong>${esc(d.campo)}:</strong> ${esc(d.valor)}</li>`).join('')}</ul></details>` : ''}
          </div>`)
          .join('')
      : '<p class="vazio">Nenhum registro.</p>';
  } catch (e) {
    console.error(e);
    corpo.innerHTML = '<p class="vazio">Não foi possível carregar o histórico (verifique a internet).</p>';
  }
}

// ---------------- Inicialização ----------------
async function iniciar() {
  limparAreaImpressao();
  montarPassos();
  const id = params.get('i');
  if (id) await iniciarIncidente(id);
  else if (params.has('local')) {
    await iniciarLocal();
    let inicial = 0;
    try { inicial = Number(sessionStorage.getItem('sci201-passo')) || 0; } catch { /* sem armazenamento */ }
    irPara(inicial);
  } else await iniciarInicio();
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
