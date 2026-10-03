// Geração do PDF no layout do modelo SCI-201 (A4, 4 páginas + continuações automáticas).
import { calcularLayout, desenharNoPDF, medidorJsPDF } from './org.js';
import { renderizar, carregarImagem } from './pad.js';

const PAG_L = 210;
const PAG_A = 297;
const M = 12; // margem
const L = PAG_L - 2 * M; // largura útil
const TOPO_CORPO = 37;
const ALT_RODAPE = 17;
const Y_RODAPE = PAG_A - M - ALT_RODAPE;
const BASE_CORPO = Y_RODAPE - 3;
const PT = 0.3528;

export function dataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}
const dh = (data, hora) => [dataBR(data), hora].filter(Boolean).join(' ');

function ctx(doc) {
  const fonte = (tam, negrito = false) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal');
    doc.setFontSize(tam);
  };
  const quebrar = (texto, tam, negrito, largura) => {
    fonte(tam, negrito);
    return doc.splitTextToSize(String(texto ?? ''), largura);
  };
  return { fonte, quebrar };
}

function cabecalho(doc, est) {
  const { fonte, quebrar } = ctx(doc);
  doc.setTextColor(0);
  fonte(12, true);
  doc.text('BRIEFING DO INCIDENTE (SCI-201)', PAG_L / 2, M + 5, { align: 'center' });
  const y = M + 8;
  const h = 14;
  const cols = [
    { w: 72, rotulo: '1. Nome do Incidente:', valor: est.incidente.nome },
    { w: 56, rotulo: '2. Número do Incidente:', valor: est.incidente.numero },
    {
      w: L - 128,
      rotulo: '3. Data/Hora de Início:',
      valor: `Data: ${dataBR(est.incidente.data) || '___/___/_____'}   Hora: ${est.incidente.hora || '___:___'}`,
    },
  ];
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  let x = M;
  for (const c of cols) {
    doc.rect(x, y, c.w, h);
    fonte(7, true);
    doc.text(c.rotulo, x + 1.5, y + 3.3);
    const linhas = quebrar(c.valor, 8.5, false, c.w - 3).slice(0, 2);
    fonte(8.5);
    doc.text(linhas, x + 1.5, y + 7.3);
    x += c.w;
  }
}

function rodape(doc, est, assinatura, rotuloPagina, folha, total) {
  const { fonte, quebrar } = ctx(doc);
  const p = est.preparadoPor;
  const y = Y_RODAPE;
  const h1 = ALT_RODAPE / 2;
  const w1 = 72;
  const w2 = 56;
  const w3 = L - w1 - w2;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(M, y, w1, h1);
  doc.rect(M + w1, y, w2, h1);
  doc.rect(M + w1 + w2, y, w3, ALT_RODAPE);
  doc.rect(M, y + h1, w1, h1);
  doc.rect(M + w1, y + h1, w2, h1);

  const celula = (x, yy, w, rotulo, valor) => {
    fonte(7, true);
    doc.text(rotulo, x + 1.5, yy + 3.2);
    const rw = doc.getTextWidth(rotulo) + 1;
    const linhas = quebrar(valor || '', 7.5, false, w - rw - 3);
    fonte(7.5);
    doc.text(linhas[0] || '', x + 1.5 + rw, yy + 3.2);
    if (linhas[1]) doc.text(linhas[1], x + 1.5, yy + 6.6);
  };
  celula(M, y, w1, '6. Preparado por: Nome:', p.nome);
  celula(M + w1, y, w2, 'Cargo/Função:', p.cargo);
  celula(M + w1, y + h1, w2, 'Data/Hora:', dh(p.data, p.hora));
  fonte(7, true);
  doc.text('Assinatura:', M + w1 + w2 + 1.5, y + 3.2);
  if (assinatura) {
    const aw = w3 - 22;
    const ah = Math.min(ALT_RODAPE - 2, aw / 3);
    doc.addImage(assinatura, 'PNG', M + w1 + w2 + 18, y + (ALT_RODAPE - ah) / 2, aw, ah);
  }
  fonte(8, true);
  doc.text(`SCI 201, ${rotuloPagina}`, M + 1.5, y + h1 + 5.5);
  fonte(7);
  doc.setTextColor(90);
  doc.text(`Folha ${folha} de ${total}`, PAG_L - M, PAG_A - M + 4, { align: 'right' });
  doc.setTextColor(0);
}

// Seção de texto corrido com continuação automática em novas páginas.
function secaoTexto(doc, titulo, texto, y, { alturaMin = 0, preencherAteBase = false } = {}) {
  const { fonte, quebrar } = ctx(doc);
  const TAM = 9.5;
  const lh = TAM * PT * 1.25;
  let linhas = quebrar(texto || '', TAM, false, L - 4);
  if (linhas.length === 1 && linhas[0] === '') linhas = [];
  let tit = titulo;
  let primeira = true;
  for (;;) {
    const linhasTit = quebrar(tit, 8, true, L - 4);
    const hTit = linhasTit.length * 8 * PT * 1.2 + 2.5;
    const disponivel = BASE_CORPO - y;
    const cabem = Math.max(0, Math.floor((disponivel - hTit - 3) / lh));
    if (cabem < 2 && linhas.length) {
      doc.addPage();
      y = TOPO_CORPO;
      continue;
    }
    const usar = linhas.splice(0, cabem);
    const ultima = linhas.length === 0;
    let h = hTit + usar.length * lh + 3;
    if (!ultima) h = disponivel;
    else {
      if (primeira) h = Math.max(h, alturaMin);
      if (preencherAteBase) h = disponivel;
      h = Math.min(h, disponivel);
    }
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(M, y, L, h);
    fonte(8, true);
    doc.text(linhasTit, M + 2, y + 3.6);
    fonte(TAM);
    if (usar.length) doc.text(usar, M + 2, y + hTit + TAM * PT);
    if (ultima) return y + h;
    doc.addPage();
    y = TOPO_CORPO;
    tit = `${titulo.replace(/:$/, '')} (continuação):`;
    primeira = false;
  }
}

function tituloSecao(doc, texto, y) {
  const { fonte, quebrar } = ctx(doc);
  const linhas = quebrar(texto, 8, true, L - 4);
  const h = linhas.length * 8 * PT * 1.2 + 2.5;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(M, y, L, h);
  fonte(8, true);
  doc.text(linhas, M + 2, y + 3.6);
  return y + h;
}

function tabela(doc, y, cabecalhoTabela, corpo, colunas, tituloCont) {
  const autoTable = doc.autoTable ? (o) => doc.autoTable(o) : (o) => window.jspdf_autotable?.autoTable?.(doc, o);
  autoTable({
    startY: y,
    head: [cabecalhoTabela],
    body: corpo,
    theme: 'grid',
    margin: { top: TOPO_CORPO + 6, bottom: PAG_A - BASE_CORPO, left: M, right: M },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.4, lineColor: 0, lineWidth: 0.2, textColor: 0, minCellHeight: 7, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold', fontSize: 7.5, valign: 'middle', halign: 'center' },
    columnStyles: colunas,
    rowPageBreak: 'avoid',
    didDrawPage: (d) => {
      if (d.pageNumber > 1 && tituloCont) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(tituloCont, M, TOPO_CORPO + 3.5);
      }
    },
  });
  return doc.lastAutoTable.finalY;
}

async function imagemCroqui(croqui) {
  if (!croqui.imagem && !croqui.tracos.length) return null;
  const fundo = croqui.imagem ? await carregarImagem(croqui.imagem) : null;
  return renderizar({ largura: croqui.largura, altura: croqui.altura, fundo, tracos: croqui.tracos, formato: 'image/jpeg', qualidade: 0.88 });
}

function imagemAssinatura(tracos) {
  if (!tracos?.length) return null;
  return renderizar({ largura: 900, altura: 300, tracos, formato: 'image/png', corFundo: null });
}

function setaNorte(doc, x, y) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.rect(x - 5, y, 10, 13, 'FD');
  doc.setFillColor(0, 0, 0);
  doc.triangle(x, y + 1.5, x + 3, y + 8.5, x - 3, y + 8.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('N', x, y + 12, { align: 'center' });
}

export async function gerarPDF(est) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `SCI-201 ${est.incidente.nome || ''}`.trim(), subject: 'Briefing do Incidente (SCI-201)', creator: 'SCI-201 App' });
  const { fonte, quebrar } = ctx(doc);
  const rotulos = [];
  const marcar = (base) => {
    const total = doc.getNumberOfPages();
    let primeira = true;
    for (let p = 1; p <= total; p++) {
      if (rotulos[p]) continue;
      rotulos[p] = primeira && !rotulos.some((r) => r && r.base === base) ? { base, texto: base } : { base, texto: `${base} (continuação)` };
      primeira = false;
    }
  };

  // ---------- Página 1: Mapa/Croquis + Resumo ----------
  const tit4 =
    '4. MAPA / CROQUIS (incluir esboço, mostrando a área total das operações, o local/área do incidente impactado e ameaçado, outras áreas resultados de sobrevoo, trajetórias, linhas costeiras impactadas ou outros gráficos que retratam o status situacional e a localização geográfica dos recursos designados e/ou em empregos):';
  const tit5 =
    '5. Resumo da situação e briefing de saúde e segurança (Para briefings ou transferência de comando): Reconhecer os potenciais riscos à saúde e a segurança e estabelecer medidas preventivas e/ou mitigadoras para proteger os respondedores e demais pessoas envolvidas no incidente. Ações esperadas: Eliminação de perigos (quando possível), fornecimento de equipamentos de proteção individual, alertas de riscos etc.';
  let y = TOPO_CORPO;
  const linhasT4 = quebrar(tit4, 8, true, L - 4);
  const hT4 = linhasT4.length * 8 * PT * 1.2 + 2.5;
  const linhasResumo = quebrar(est.resumo || '', 9.5, false, L - 4).length;
  const hT5 = quebrar(tit5, 8, true, L - 4).length * 8 * PT * 1.2 + 2.5;
  const hResumoDesejada = hT5 + Math.max(6, linhasResumo) * 9.5 * PT * 1.25 + 3;
  const legenda = (est.croqui.legenda || '').trim();
  const hLegenda = legenda ? 5 : 0;
  let hImagem = Math.max(105, Math.min(150, BASE_CORPO - y - hT4 - hLegenda - hResumoDesejada - 2));
  const temCroqui = est.croqui.imagem || est.croqui.tracos.length;
  if (temCroqui) {
    // Ajusta a altura da caixa à proporção da imagem (evita espaço vazio abaixo dela).
    const hProporcional = (L - 4) / (est.croqui.largura / est.croqui.altura) + 2;
    hImagem = Math.max(60, Math.min(hImagem, hProporcional));
  }
  const hCaixa4 = hT4 + hImagem + hLegenda + 2;
  doc.setLineWidth(0.3);
  doc.rect(M, y, L, hCaixa4);
  fonte(8, true);
  doc.text(linhasT4, M + 2, y + 3.6);
  const img = await imagemCroqui(est.croqui);
  if (img) {
    const areaW = L - 4;
    const areaH = hImagem - 2;
    const prop = est.croqui.largura / est.croqui.altura;
    let w = areaW;
    let h = w / prop;
    if (h > areaH) {
      h = areaH;
      w = h * prop;
    }
    const ix = M + 2 + (areaW - w) / 2;
    const iy = y + hT4 + 1;
    doc.addImage(img, 'JPEG', ix, iy, w, h);
    doc.setDrawColor(150);
    doc.setLineWidth(0.2);
    doc.rect(ix, iy, w, h);
    if (est.croqui.norte) setaNorte(doc, ix + w - 8, iy + 2);
  }
  if (legenda) {
    fonte(7.5);
    doc.text(quebrar(`Legenda/observações: ${legenda}`, 7.5, false, L - 4)[0], M + 2, y + hT4 + hImagem + 3.5);
  }
  y += hCaixa4;
  secaoTexto(doc, tit5, est.resumo, y, { preencherAteBase: true });
  marcar('Página 1');

  // ---------- Página 2: Objetivos + Ações ----------
  doc.addPage();
  y = secaoTexto(doc, '7. Objetivos atuais e planejados:', est.objetivos, TOPO_CORPO, { alturaMin: 55 });
  if (BASE_CORPO - y < 30) {
    doc.addPage();
    y = TOPO_CORPO;
  }
  y = tituloSecao(doc, '8. Ações, estratégias e táticas atuais e planejadas:', y);
  const acoes = est.acoes.map((a) => [dh(a.data, a.hora), a.texto || '']);
  const linhasVaziasAcoes = Math.max(0, Math.floor((BASE_CORPO - y - 8) / 7) - acoes.length);
  if (acoes.length < 4) for (let i = 0; i < linhasVaziasAcoes; i++) acoes.push(['', '']);
  tabela(doc, y, ['Data/Horário', 'Ações'], acoes, { 0: { cellWidth: 34 }, 1: { cellWidth: 'auto' } }, '8. Ações, estratégias e táticas atuais e planejadas (continuação):');
  marcar('Página 2');

  // ---------- Página 3: Organização ----------
  doc.addPage();
  y = tituloSecao(doc, '9. Organização Atual (Insira as demais estruturas se necessárias):', TOPO_CORPO);
  const layout = calcularLayout(est.organizacao, L - 6, medidorJsPDF());
  const areaH = BASE_CORPO - y - 6;
  const escala = Math.min(1, areaH / layout.altura);
  const ox = M + 3 + ((L - 6) - layout.largura * escala) / 2;
  desenharNoPDF(doc, layout, ox, y + 4, escala);
  doc.setLineWidth(0.3);
  doc.setDrawColor(0);
  doc.rect(M, y, L, BASE_CORPO - y);
  marcar('Página 3');

  // ---------- Página 4: Recursos ----------
  doc.addPage();
  y = tituloSecao(doc, '10. Resumo dos Recursos', TOPO_CORPO);
  const recursos = est.recursos.map((r) => [
    r.recurso || '',
    r.identificador || '',
    dh(r.solData, r.solHora),
    dh(r.hpcData, r.hpcHora),
    r.noLocal ? 'X' : '',
    r.notas || '',
  ]);
  if (recursos.length < 4) {
    const vazias = Math.max(0, Math.floor((BASE_CORPO - y - 12) / 8) - recursos.length);
    for (let i = 0; i < vazias; i++) recursos.push(['', '', '', '', '', '']);
  }
  tabela(
    doc,
    y,
    ['Recurso', 'Identificador do Recurso', 'Data/Hora Solicitação', 'HPC', 'No Local', 'Notas: (Localização/ Designação/Status)'],
    recursos,
    {
      0: { cellWidth: 36 },
      1: { cellWidth: 28 },
      2: { cellWidth: 24 },
      3: { cellWidth: 24 },
      4: { cellWidth: 13, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 'auto' },
    },
    '10. Resumo dos Recursos (continuação):',
  );
  marcar('Página 4');

  // ---------- Cabeçalho e rodapé em todas as folhas ----------
  const assinatura = imagemAssinatura(est.preparadoPor.assinatura);
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    cabecalho(doc, est);
    rodape(doc, est, assinatura, rotulos[p]?.texto || '', p, total);
  }
  return doc;
}

export function nomeArquivo(est, ext) {
  const limpar = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40);
  const partes = ['SCI201', limpar(est.incidente.nome) || 'incidente', (est.incidente.data || '').replace(/-/g, '')].filter(Boolean);
  return `${partes.join('_')}.${ext}`;
}
