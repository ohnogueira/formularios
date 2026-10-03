// Organograma do campo 9: modelo, cálculo de layout (em mm) e renderização em SVG (tela) e jsPDF (PDF).

export const CARGOS_PADRAO = [
  { id: 'ligacao', cargo: 'Oficial de Ligação', grupo: 'staff' },
  { id: 'seguranca', cargo: 'Oficial de Segurança', grupo: 'staff' },
  { id: 'infoPublica', cargo: 'Oficial de Informações Públicas', grupo: 'staff' },
  { id: 'operacoes', cargo: 'Chefe da Seção de Operações', grupo: 'secao' },
  { id: 'planejamento', cargo: 'Chefe da Seção de Planejamento', grupo: 'secao' },
  { id: 'logistica', cargo: 'Chefe da Seção de Logística', grupo: 'secao' },
  { id: 'adminFin', cargo: 'Chefe da Seção de Administração/Finanças', grupo: 'secao' },
];

export const SUPERIOR_CI_STAFF = 'ci-staff';
export const SUPERIOR_CI_SECAO = 'ci-secao';

// Lista de opções "Subordinado a" para um cargo extra (exclui ele próprio e seus subordinados).
export function opcoesSuperior(org, idExtra) {
  const proibidos = new Set();
  if (idExtra) {
    proibidos.add(idExtra);
    let mudou = true;
    while (mudou) {
      mudou = false;
      for (const e of org.extras) {
        if (!proibidos.has(e.id) && proibidos.has(e.superior)) {
          proibidos.add(e.id);
          mudou = true;
        }
      }
    }
  }
  const ops = [
    { valor: SUPERIOR_CI_STAFF, rotulo: 'Comandante do Incidente (junto ao Staff do Comando)' },
    { valor: SUPERIOR_CI_SECAO, rotulo: 'Comandante do Incidente (nova Seção no Staff Geral)' },
  ];
  for (const c of CARGOS_PADRAO) ops.push({ valor: c.id, rotulo: c.cargo });
  for (const e of org.extras) {
    if (proibidos.has(e.id)) continue;
    ops.push({ valor: e.id, rotulo: (e.cargo || 'Cargo sem nome') + (e.nome ? ` – ${e.nome}` : '') });
  }
  return ops;
}

function montarArvore(org) {
  const nos = new Map();
  for (const c of CARGOS_PADRAO) nos.set(c.id, { cargo: c.cargo, nome: org.cargos[c.id] || '', filhos: [] });
  for (const e of org.extras) nos.set(e.id, { cargo: e.cargo || '', nome: e.nome || '', filhos: [] });
  const staff = CARGOS_PADRAO.filter((c) => c.grupo === 'staff').map((c) => nos.get(c.id));
  const secoes = CARGOS_PADRAO.filter((c) => c.grupo === 'secao').map((c) => nos.get(c.id));
  for (const e of org.extras) {
    const no = nos.get(e.id);
    if (e.superior === SUPERIOR_CI_SECAO) secoes.push(no);
    else if (e.superior && e.superior !== SUPERIOR_CI_STAFF && nos.has(e.superior) && e.superior !== e.id) nos.get(e.superior).filhos.push(no);
    else staff.push(no);
  }
  const comandantes = org.unificado ? org.comandantes : org.comandantes.slice(0, 1);
  return { comandantes, staff, secoes };
}

const PT_MM = 0.3528;
const PAD = 1.6;
const ALT_LINHA = 1.18;

// medir(texto, tamPt, negrito, larguraMM) => string[]
export function calcularLayout(org, larguraTotal, medir) {
  const { comandantes, staff, secoes } = montarArvore(org);
  const elementos = [];
  const linha = (x1, y1, x2, y2) => elementos.push({ tipo: 'linha', x1, y1, x2, y2 });

  const conteudo = (partes, w) => {
    const linhas = [];
    for (const p of partes) {
      if (!p.t) continue;
      for (const l of medir(p.t, p.tam, p.negrito, w - PAD * 2)) linhas.push({ t: l, tam: p.tam, negrito: p.negrito });
    }
    const h = PAD * 2 + linhas.reduce((s, l) => s + l.tam * PT_MM * ALT_LINHA, 0);
    return { linhas, h };
  };
  const caixa = (x, y, w, partes, minH = 10, hFixa = null) => {
    const c = conteudo(partes, w);
    const h = hFixa ?? Math.max(minH, c.h + 3.5);
    elementos.push({ tipo: 'caixa', x, y, w, h, linhas: c.linhas });
    return h;
  };
  const partesNo = (no) => [
    { t: no.cargo, tam: 6.5, negrito: true },
    { t: no.nome, tam: 7.5, negrito: false },
  ];

  // Caixa do Comandante do Incidente (dividida em caso de Comando Unificado)
  const n = Math.max(1, comandantes.length);
  const larguraCI = Math.min(larguraTotal * 0.72, Math.max(66, n * 48));
  const larguraCelula = larguraCI / n;
  const xCI = (larguraTotal - larguraCI) / 2;
  const partesCI = comandantes.map((c) => [
    { t: org.unificado ? 'Comandante do Incidente (Comando Unificado)' : 'Comandante do Incidente', tam: 6.5, negrito: true },
    { t: c.nome, tam: 7.5, negrito: false },
    { t: c.instituicao ? `Instituição: ${c.instituicao}` : '', tam: 6.5, negrito: false },
  ]);
  const altCI = Math.max(14, ...partesCI.map((p) => conteudo(p, larguraCelula).h + 3.5));
  partesCI.forEach((p, i) => caixa(xCI + i * larguraCelula, 0, larguraCelula, p, 14, altCI));

  const tronco = larguraTotal / 2;

  // Staff do Comando: coluna à direita do tronco
  const xStaff = tronco + 6;
  const larguraStaff = Math.min(72, larguraTotal / 2 - 8);
  let y = altCI + 5;
  const desenharStaff = (no, prof, pai) => {
    const recuo = prof * 5;
    const x = xStaff + recuo;
    const h = caixa(x, y, larguraStaff - recuo, partesNo(no));
    const meio = y + h / 2;
    if (!pai) linha(tronco, meio, x, meio);
    else {
      linha(pai.x + 2.5, pai.y + pai.h, pai.x + 2.5, meio);
      linha(pai.x + 2.5, meio, x, meio);
    }
    const atual = { x, y, h };
    y += h + 3;
    for (const f of no.filhos) desenharStaff(f, prof + 1, atual);
  };
  for (const no of staff) desenharStaff(no, 0, null);

  // Staff Geral: barra horizontal com uma coluna por Seção
  const yBarra = Math.max(altCI + 6, y + 2);
  linha(tronco, altCI, tronco, yBarra);
  const ns = secoes.length;
  const larguraColuna = larguraTotal / Math.max(1, ns);
  let base = yBarra;
  if (ns) {
    linha(larguraColuna / 2, yBarra, larguraTotal - larguraColuna / 2, yBarra);
    secoes.forEach((secao, i) => {
      const cx = larguraColuna * (i + 0.5);
      const x0 = i * larguraColuna + 1.5;
      const w0 = larguraColuna - 3;
      let yc = yBarra + 4;
      linha(cx, yBarra, cx, yc);
      const desenharSecao = (no, prof, pai) => {
        const recuo = Math.min(prof * 4, w0 * 0.4);
        const x = x0 + recuo;
        const h = caixa(x, yc, w0 - recuo, partesNo(no));
        const meio = yc + h / 2;
        if (pai) {
          linha(pai.x + 2, pai.y + pai.h, pai.x + 2, meio);
          linha(pai.x + 2, meio, x, meio);
        }
        const atual = { x, y: yc, h };
        yc += h + 3;
        for (const f of no.filhos) desenharSecao(f, prof + 1, atual);
      };
      desenharSecao(secao, 0, null);
      base = Math.max(base, yc);
    });
  }
  return { largura: larguraTotal, altura: Math.max(base, y), elementos };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

export function paraSVG(layout) {
  const partes = [];
  for (const e of layout.elementos) {
    if (e.tipo === 'linha') {
      partes.push(`<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="#333" stroke-width="0.3"/>`);
    }
  }
  for (const e of layout.elementos) {
    if (e.tipo !== 'caixa') continue;
    partes.push(`<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="#fff" stroke="#333" stroke-width="0.35"/>`);
    let yy = e.y + PAD;
    for (const l of e.linhas) {
      const tam = l.tam * PT_MM;
      yy += tam * ALT_LINHA;
      partes.push(`<text x="${e.x + e.w / 2}" y="${yy - tam * 0.28}" font-size="${tam}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"${l.negrito ? ' font-weight="700"' : ''}>${esc(l.t)}</text>`);
    }
  }
  const m = 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${layout.largura + 2 * m} ${layout.altura + 2 * m}" role="img" aria-label="Organograma">${partes.join('')}</svg>`;
}

export function desenharNoPDF(doc, layout, ox, oy, escala) {
  doc.setDrawColor(40);
  doc.setLineWidth(0.3 * escala);
  for (const e of layout.elementos) {
    if (e.tipo === 'linha') doc.line(ox + e.x1 * escala, oy + e.y1 * escala, ox + e.x2 * escala, oy + e.y2 * escala);
  }
  doc.setLineWidth(0.35 * escala);
  for (const e of layout.elementos) {
    if (e.tipo !== 'caixa') continue;
    doc.setFillColor(255, 255, 255);
    doc.rect(ox + e.x * escala, oy + e.y * escala, e.w * escala, e.h * escala, 'FD');
    let yy = e.y + PAD;
    for (const l of e.linhas) {
      const tam = l.tam * PT_MM;
      yy += tam * ALT_LINHA;
      doc.setFont('helvetica', l.negrito ? 'bold' : 'normal');
      doc.setFontSize(l.tam * escala);
      doc.text(l.t, ox + (e.x + e.w / 2) * escala, oy + (yy - tam * 0.28) * escala, { align: 'center' });
    }
  }
}

// Medidor de texto baseado nas métricas da fonte Helvetica do jsPDF (mesma usada no PDF).
let docMedicao = null;
export function medidorJsPDF() {
  const { jsPDF } = window.jspdf;
  if (!docMedicao) docMedicao = new jsPDF({ unit: 'mm', format: 'a4' });
  return (texto, tam, negrito, largura) => {
    docMedicao.setFont('helvetica', negrito ? 'bold' : 'normal');
    docMedicao.setFontSize(tam);
    return docMedicao.splitTextToSize(String(texto), Math.max(5, largura));
  };
}
