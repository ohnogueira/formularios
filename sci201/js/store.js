// Estado do formulário e persistência local (IndexedDB) no próprio aparelho.

const DB_NOME = 'sci201';
const DB_LOJA = 'formularios';
const CHAVE_ATUAL = 'atual';
export const VERSAO_DADOS = 1;

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function hojeISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return { data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, hora: `${p(d.getHours())}:${p(d.getMinutes())}` };
}
export const agora = hojeISO;

export function estadoVazio() {
  const { data, hora } = hojeISO();
  return {
    tipo: 'SCI-201',
    versao: VERSAO_DADOS,
    incidente: { nome: '', numero: '', data, hora },
    croqui: { imagem: null, tracos: [], largura: 1400, altura: 1000, norte: true, legenda: '' },
    resumo: '',
    preparadoPor: { nome: '', cargo: '', data: '', hora: '', assinatura: [] },
    objetivos: '',
    acoes: [],
    organizacao: {
      unificado: false,
      comandantes: [{ id: uid(), nome: '', instituicao: '' }],
      cargos: { ligacao: '', seguranca: '', infoPublica: '', operacoes: '', planejamento: '', logistica: '', adminFin: '' },
      extras: [],
    },
    recursos: [],
    atualizadoEm: new Date().toISOString(),
  };
}

// Garante que um objeto carregado (do aparelho ou de arquivo) tenha todos os campos esperados.
export function normalizar(obj) {
  const base = estadoVazio();
  if (!obj || typeof obj !== 'object') return base;
  const mesclar = (alvo, fonte) => {
    for (const k of Object.keys(alvo)) {
      if (!(k in fonte)) continue;
      const a = alvo[k];
      const f = fonte[k];
      if (a && typeof a === 'object' && !Array.isArray(a) && f && typeof f === 'object' && !Array.isArray(f)) {
        mesclar(a, f);
      } else if (Array.isArray(a)) {
        if (Array.isArray(f)) alvo[k] = f;
      } else if (f === null || typeof f === typeof a || a === null) {
        alvo[k] = f;
      }
    }
  };
  mesclar(base, obj);
  if (!base.organizacao.comandantes.length) base.organizacao.comandantes.push({ id: uid(), nome: '', instituicao: '' });
  return base;
}

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_LOJA);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function operacao(modo, fn) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_LOJA, modo);
    const req = fn(tx.objectStore(DB_LOJA));
    tx.oncomplete = () => { db.close(); resolve(req && req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function carregar() {
  try {
    const dados = await operacao('readonly', (s) => s.get(CHAVE_ATUAL));
    return dados ? normalizar(dados) : null;
  } catch (e) {
    console.warn('Falha ao carregar dados locais', e);
    return null;
  }
}

export async function salvar(estado) {
  estado.atualizadoEm = new Date().toISOString();
  await operacao('readwrite', (s) => s.put(estado, CHAVE_ATUAL));
}

export function obterCaminho(obj, caminho) {
  return caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function definirCaminho(obj, caminho, valor) {
  const partes = caminho.split('.');
  const ultimo = partes.pop();
  const alvo = partes.reduce((o, k) => o[k], obj);
  alvo[ultimo] = valor;
}
