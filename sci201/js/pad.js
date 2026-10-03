// Área de desenho à mão livre (croquis e assinatura), com suporte a toque, caneta e mouse.
// Os traços são guardados em coordenadas normalizadas (0–1) para independer da resolução.

export class Pad {
  constructor(canvas, { tracos = [], cor = '#111111', espessura = 0.006, fundo = null, aoMudar = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tracos = tracos;
    this.cor = cor;
    this.espessura = espessura;
    this.fundo = fundo; // HTMLImageElement | null
    this.aoMudar = aoMudar;
    this.atual = null;
    this.ativo = true; // falso no modo somente leitura
    this._ligarEventos();
    this.redesenhar();
  }

  _ponto(ev) {
    const r = this.canvas.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width;
    const y = (ev.clientY - r.top) / r.height;
    return [Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000, Math.round(Math.min(1, Math.max(0, y)) * 1000) / 1000];
  }

  _ligarEventos() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (ev) => {
      if (!this.ativo || (ev.button !== undefined && ev.button > 0)) return;
      ev.preventDefault();
      c.setPointerCapture(ev.pointerId);
      this.atual = { cor: this.cor, esp: this.espessura, pts: [this._ponto(ev)] };
      this.tracos.push(this.atual);
      this.redesenhar();
    });
    c.addEventListener('pointermove', (ev) => {
      if (!this.atual) return;
      ev.preventDefault();
      const eventos = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
      for (const e of eventos) {
        const p = this._ponto(e);
        const u = this.atual.pts[this.atual.pts.length - 1];
        // Descarta pontos muito próximos (reduz o tamanho dos dados sem perda visível).
        if (Math.abs(p[0] - u[0]) + Math.abs(p[1] - u[1]) >= 0.002) this.atual.pts.push(p);
      }
      this.redesenhar();
    });
    const fim = () => {
      if (!this.atual) return;
      this.atual = null;
      this.aoMudar();
    };
    c.addEventListener('pointerup', fim);
    c.addEventListener('pointercancel', fim);
  }

  definirTracos(tracos) {
    this.tracos = tracos;
    this.redesenhar();
  }

  desfazer() {
    if (!this.tracos.length) return;
    this.tracos.pop();
    this.redesenhar();
    this.aoMudar();
  }

  limpar() {
    this.tracos.length = 0;
    this.redesenhar();
    this.aoMudar();
  }

  redesenhar() {
    desenhar(this.ctx, this.canvas.width, this.canvas.height, this.fundo, this.tracos);
  }

  get vazio() {
    return !this.tracos.length && !this.fundo;
  }
}

export function desenhar(ctx, w, h, fundo, tracos, corFundo = '#ffffff') {
  ctx.save();
  if (corFundo) {
    ctx.fillStyle = corFundo;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }
  if (fundo) ctx.drawImage(fundo, 0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const t of tracos) {
    ctx.strokeStyle = t.cor;
    ctx.fillStyle = t.cor;
    const lw = Math.max(1, t.esp * w);
    ctx.lineWidth = lw;
    if (t.pts.length === 1) {
      ctx.beginPath();
      ctx.arc(t.pts[0][0] * w, t.pts[0][1] * h, lw / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(t.pts[0][0] * w, t.pts[0][1] * h);
    for (let i = 1; i < t.pts.length; i++) ctx.lineTo(t.pts[i][0] * w, t.pts[i][1] * h);
    ctx.stroke();
  }
  ctx.restore();
}

// Gera imagem (dataURL) a partir de fundo + traços.
export function renderizar({ largura, altura, fundo = null, tracos = [], formato = 'image/jpeg', qualidade = 0.88, corFundo = '#ffffff' }) {
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = altura;
  desenhar(c.getContext('2d'), largura, altura, fundo, tracos, corFundo);
  return c.toDataURL(formato, qualidade);
}

export function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Reduz a imagem enviada para no máximo `max` px no maior lado (economiza espaço e deixa o PDF leve).
// O resultado fica abaixo de ~700 KB para caber num documento do modo compartilhado (limite de 1 MiB).
export async function prepararImagem(arquivo, max = 1600) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await carregarImagem(url);
    const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return comprimir(c);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Gira imagem 90° no sentido horário.
export async function girarImagem(dataURL) {
  const img = await carregarImagem(dataURL);
  const c = document.createElement('canvas');
  c.width = img.naturalHeight;
  c.height = img.naturalWidth;
  const ctx = c.getContext('2d');
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  return comprimir(c);
}

const LIMITE_IMAGEM = 700 * 1024;
function comprimir(canvas) {
  let c = canvas;
  for (;;) {
    for (const q of [0.85, 0.75, 0.65, 0.55]) {
      const dataURL = c.toDataURL('image/jpeg', q);
      if (dataURL.length <= LIMITE_IMAGEM) return { dataURL, largura: c.width, altura: c.height };
    }
    const menor = document.createElement('canvas');
    menor.width = Math.round(c.width * 0.8);
    menor.height = Math.round(c.height * 0.8);
    menor.getContext('2d').drawImage(c, 0, 0, menor.width, menor.height);
    c = menor;
  }
}

// Rotação horária dos traços normalizados: (x, y) -> (1 - y, x)
export function girarTracos(tracos, larguraAntiga, larguraNova) {
  const fator = larguraAntiga / larguraNova; // mantém a espessura visual
  for (const t of tracos) {
    t.pts = t.pts.map(([x, y]) => [Math.round((1 - y) * 1000) / 1000, x]);
    t.esp = t.esp * fator;
  }
}
