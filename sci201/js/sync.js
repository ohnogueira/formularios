// Conversão entre o estado local do formulário e o formato "plano" usado na sincronização
// (um mapa caminho -> valor). Permite enviar apenas os campos alterados e mesclar edições
// simultâneas de diferentes pessoas campo a campo (three-way merge).
import { estadoVazio } from './store.js';

// Listas de itens com id: cada item vira um mapa indexado pelo id (com o campo "ordem").
export const LISTAS = ['acoes', 'recursos', 'organizacao.comandantes', 'organizacao.extras'];
// Valores guardados inteiros (como texto JSON), pois o Firestore não aceita listas aninhadas.
const ATOMICOS = ['preparadoPor.assinatura'];
// Fora do documento principal (vão para documentos de anexo, por causa do limite de tamanho).
const EXCLUIDOS = ['croqui.imagem', 'croqui.tracos', 'croqui.largura', 'croqui.altura', 'atualizadoEm', 'tipo', 'versao'];

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function paraPlano(estado) {
  const plano = {};
  const visitar = (valor, caminho) => {
    if (EXCLUIDOS.includes(caminho)) return;
    if (ATOMICOS.includes(caminho)) {
      plano[caminho] = JSON.stringify(valor ?? []);
      return;
    }
    if (LISTAS.includes(caminho)) {
      (valor || []).forEach((item, i) => {
        for (const [k, v] of Object.entries(item)) {
          if (k === 'id') continue;
          plano[`${caminho}.${item.id}.${k}`] = v ?? null;
        }
        plano[`${caminho}.${item.id}.ordem`] = i;
      });
      return;
    }
    if (ehObjeto(valor)) {
      for (const [k, v] of Object.entries(valor)) visitar(v, caminho ? `${caminho}.${k}` : k);
      return;
    }
    plano[caminho] = valor ?? null;
  };
  visitar(estado, '');
  return plano;
}

export function dePlano(plano) {
  const est = estadoVazio();
  for (const l of LISTAS) definir(est, l, []);
  const itens = new Map(LISTAS.map((l) => [l, new Map()]));
  for (const [chave, valor] of Object.entries(plano)) {
    const lista = LISTAS.find((l) => chave.startsWith(l + '.'));
    if (lista) {
      const resto = chave.slice(lista.length + 1);
      const ponto = resto.indexOf('.');
      if (ponto < 0) continue;
      const id = resto.slice(0, ponto);
      const campo = resto.slice(ponto + 1);
      const m = itens.get(lista);
      if (!m.has(id)) m.set(id, { id });
      m.get(id)[campo] = valor;
      continue;
    }
    if (ATOMICOS.includes(chave)) {
      try {
        definir(est, chave, JSON.parse(valor || '[]'));
      } catch {
        definir(est, chave, []);
      }
      continue;
    }
    if (EXCLUIDOS.includes(chave)) continue;
    definirSeExiste(est, chave, valor);
  }
  for (const [lista, m] of itens) {
    const arr = [...m.values()].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    for (const it of arr) delete it.ordem;
    definir(est, lista, arr);
  }
  if (!est.organizacao.comandantes.length) est.organizacao.comandantes.push({ id: 'cmd1', nome: '', instituicao: '' });
  return est;
}

function definir(obj, caminho, valor) {
  const partes = caminho.split('.');
  const ultimo = partes.pop();
  let alvo = obj;
  for (const p of partes) {
    if (!ehObjeto(alvo[p])) alvo[p] = {};
    alvo = alvo[p];
  }
  alvo[ultimo] = valor;
}
function definirSeExiste(obj, caminho, valor) {
  // Ignora chaves desconhecidas (de versões futuras), sem quebrar o formulário.
  const partes = caminho.split('.');
  const ultimo = partes.pop();
  let alvo = obj;
  for (const p of partes) {
    if (!ehObjeto(alvo[p])) return;
    alvo = alvo[p];
  }
  if (ultimo in alvo) alvo[ultimo] = valor;
}

// Mapa aninhado do Firestore -> plano
export function planoDeAninhado(obj, prefixo = '', saida = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const c = prefixo ? `${prefixo}.${k}` : k;
    if (ehObjeto(v)) planoDeAninhado(v, c, saida);
    else saida[c] = v;
  }
  return saida;
}

// Plano -> mapa aninhado (para criar o documento)
export function aninhar(plano) {
  const r = {};
  for (const [k, v] of Object.entries(plano)) definir(r, k, v);
  return r;
}

function itemDaChave(chave) {
  const lista = LISTAS.find((l) => chave.startsWith(l + '.'));
  if (!lista) return null;
  const resto = chave.slice(lista.length + 1);
  return `${lista}.${resto.slice(0, resto.indexOf('.'))}`;
}

// Diferenças entre o último estado conhecido do servidor (base) e o estado atual.
export function diferencas(base, atual) {
  const alterados = {};
  const removidos = new Set();
  for (const [k, v] of Object.entries(atual)) if (base[k] !== v) alterados[k] = v;
  const itensAtuais = new Set(Object.keys(atual).map(itemDaChave).filter(Boolean));
  for (const k of Object.keys(base)) {
    if (k in atual) continue;
    const item = itemDaChave(k);
    if (item && !itensAtuais.has(item)) removidos.add(item);
    else removidos.add(k);
  }
  return { alterados, removidos: [...removidos] };
}

// Mescla: o que o usuário alterou localmente (e ainda não foi confirmado) prevalece;
// o restante passa a refletir o servidor.
export function mesclar(base, local, remoto) {
  const r = {};
  const chaves = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remoto)]);
  for (const k of chaves) {
    const sujo = base[k] !== local[k] || k in base !== k in local;
    const fonte = sujo ? local : remoto;
    if (k in fonte) r[k] = fonte[k];
  }
  return r;
}

const ROTULOS = [
  ['incidente.nome', '1. Nome do Incidente'],
  ['incidente.numero', '2. Número do Incidente'],
  ['incidente.', '3. Data/Hora de Início'],
  ['croqui', '4. Mapa/Croquis'],
  ['resumo', '5. Resumo da situação'],
  ['preparadoPor', '6. Preparado por'],
  ['objetivos', '7. Objetivos'],
  ['acoes', '8. Ações, estratégias e táticas'],
  ['organizacao', '9. Organização Atual'],
  ['recursos', '10. Resumo dos Recursos'],
];
export function rotuloCampo(chave) {
  return (ROTULOS.find(([p]) => chave.startsWith(p)) || [null, chave])[1];
}

// Resumo legível das alterações para o histórico.
export function resumoAlteracoes(alterados, removidos) {
  const campos = new Set();
  const detalhes = [];
  for (const [k, v] of Object.entries(alterados)) {
    campos.add(rotuloCampo(k));
    if (k.endsWith('.ordem')) continue;
    let valor = ATOMICOS.includes(k) ? '(assinatura alterada)' : v === true ? 'Sim' : v === false ? 'Não' : String(v ?? '');
    if (valor.length > 300) valor = valor.slice(0, 300) + '…';
    detalhes.push({ campo: `${rotuloCampo(k)} › ${k.split('.').pop()}`, valor });
  }
  for (const k of removidos) {
    campos.add(rotuloCampo(k));
    detalhes.push({ campo: rotuloCampo(k), valor: '(item removido)' });
  }
  return { campos: [...campos], detalhes: detalhes.slice(0, 40) };
}
