// Modo compartilhado: Firebase (Authentication com conta Google + Cloud Firestore).
// Um documento por incidente em "incidentes/{id}"; anexos do croquis e histórico em subcoleções.
import { FIREBASE_CONFIG, EMULADOR } from './firebase-config.js';

let fb = null;
let auth = null;
let db = null;

export const configurado = () => !!FIREBASE_CONFIG || EMULADOR;

export async function iniciarNuvem() {
  if (db) return;
  fb = await import('../vendor/firebase/firebase.mjs');
  const config = FIREBASE_CONFIG || { apiKey: 'demo', authDomain: 'demo-sci201.firebaseapp.com', projectId: 'demo-sci201', appId: 'demo' };
  const app = fb.initializeApp(config);
  auth = fb.initializeAuth(app, {
    persistence: [fb.indexedDBLocalPersistence, fb.browserLocalPersistence],
    popupRedirectResolver: fb.browserPopupRedirectResolver,
  });
  db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) });
  if (EMULADOR) {
    fb.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fb.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  try {
    await fb.getRedirectResult(auth);
  } catch (e) {
    console.warn('Login por redirecionamento falhou', e);
  }
}

export function aoMudarUsuario(cb) {
  return fb.onAuthStateChanged(auth, cb);
}

export function usuario() {
  const u = auth?.currentUser;
  if (!u) return null;
  return { uid: u.uid, email: (u.email || '').toLowerCase(), nome: u.displayName || u.email || '' };
}

export async function entrar() {
  const provedor = new fb.GoogleAuthProvider();
  provedor.setCustomParameters({ prompt: 'select_account' });
  try {
    await fb.signInWithPopup(auth, provedor);
  } catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) {
      await fb.signInWithRedirect(auth, provedor);
      return;
    }
    if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) return;
    throw e;
  }
}

export const sair = () => fb.signOut(auth);

// Somente nos testes com o Firebase Emulator: login simulado de uma conta Google.
export async function entrarEmulador(email, nome) {
  if (!EMULADOR) throw new Error('Disponível apenas no emulador');
  const token = JSON.stringify({ sub: email, email, email_verified: true, name: nome });
  await fb.signInWithCredential(auth, fb.GoogleAuthProvider.credential(token));
}

const refIncidente = (id) => fb.doc(db, 'incidentes', id);
const refAnexo = (id, nome) => fb.doc(db, 'incidentes', id, 'anexos', nome);

function registroHistorico(batch, id, u, acao, resumo) {
  const ref = fb.doc(fb.collection(db, 'incidentes', id, 'historico'));
  batch.set(ref, {
    em: fb.serverTimestamp(),
    uid: u.uid,
    email: u.email,
    nome: u.nome,
    acao,
    campos: resumo?.campos || [],
    detalhes: resumo?.detalhes || [],
  });
}

// Cria o incidente. O criador é o "dono" (normalmente o Comandante do Incidente) e o primeiro editor.
export async function criarIncidente({ dados, croquiImagem, croquiDesenho, nome, numero }) {
  const u = usuario();
  if (!u) throw new Error('É preciso entrar com a conta Google.');
  const ref = fb.doc(fb.collection(db, 'incidentes'));
  const batch = fb.writeBatch(db);
  batch.set(ref, {
    nome: nome || '',
    numero: numero || '',
    donoUid: u.uid,
    donoEmail: u.email,
    donoNome: u.nome,
    editores: [u.email],
    encerrado: false,
    criadoEm: fb.serverTimestamp(),
    atualizadoEm: fb.serverTimestamp(),
    atualizadoPor: u.nome,
    versao: 1,
    dados,
  });
  batch.set(refAnexo(ref.id, 'croquiImagem'), croquiImagem);
  batch.set(refAnexo(ref.id, 'croquiDesenho'), croquiDesenho);
  registroHistorico(batch, ref.id, u, 'Incidente criado', null);
  // Não aguarda a confirmação do servidor: sem internet, a criação fica na fila e é enviada depois.
  batch.commit().catch((e) => console.error('Falha ao criar incidente', e));
  return ref.id;
}

// Observa o incidente e seus anexos em tempo real. Retorna função para cancelar.
export function observarIncidente(id, { aoDados, aoImagem, aoDesenho, aoErro }) {
  const opcoes = { includeMetadataChanges: true };
  const cancelar = [
    fb.onSnapshot(refIncidente(id), opcoes, (s) => aoDados(s.exists() ? s.data({ serverTimestamps: 'estimate' }) : null, s.metadata), aoErro),
    fb.onSnapshot(refAnexo(id, 'croquiImagem'), (s) => aoImagem(s.exists() ? s.data() : null), aoErro),
    fb.onSnapshot(refAnexo(id, 'croquiDesenho'), (s) => aoDesenho(s.exists() ? s.data() : null), aoErro),
  ];
  return () => cancelar.forEach((c) => c());
}

// Envia somente os campos alterados (mescla campo a campo com as edições de outras pessoas).
export function enviarAlteracoes(id, alterados, removidos, resumo) {
  const u = usuario();
  const campos = { atualizadoEm: fb.serverTimestamp(), atualizadoPor: u.nome };
  for (const [k, v] of Object.entries(alterados)) campos[`dados.${k}`] = v;
  for (const k of removidos) campos[`dados.${k}`] = fb.deleteField();
  if ('incidente.nome' in alterados) campos.nome = alterados['incidente.nome'];
  if ('incidente.numero' in alterados) campos.numero = alterados['incidente.numero'];
  const batch = fb.writeBatch(db);
  batch.update(refIncidente(id), campos);
  if (resumo) registroHistorico(batch, id, u, 'Alteração', resumo);
  return batch.commit();
}

export function salvarAnexo(id, nome, dados) {
  const u = usuario();
  const batch = fb.writeBatch(db);
  batch.set(refAnexo(id, nome), dados);
  batch.update(refIncidente(id), { atualizadoEm: fb.serverTimestamp(), atualizadoPor: u.nome });
  return batch.commit();
}

export function registrarHistorico(id, resumo) {
  const batch = fb.writeBatch(db);
  registroHistorico(batch, id, usuario(), 'Alteração', resumo);
  return batch.commit();
}

// Aguarda a confirmação do servidor por até `ms` milissegundos (sem internet, não bloqueia).
export function esperarEnvios(ms = 2000) {
  if (!db) return Promise.resolve();
  return Promise.race([fb.waitForPendingWrites(db).catch(() => {}), new Promise((r) => setTimeout(r, ms))]);
}

export async function meusIncidentes() {
  const u = usuario();
  if (!u) return [];
  const q = fb.query(fb.collection(db, 'incidentes'), fb.where('editores', 'array-contains', u.email));
  const r = await fb.getDocs(q);
  return r.docs
    .map((d) => {
      const x = d.data({ serverTimestamps: 'estimate' });
      return {
        id: d.id,
        nome: x.nome,
        numero: x.numero,
        encerrado: !!x.encerrado,
        dono: x.donoUid === u.uid,
        atualizadoEm: x.atualizadoEm?.toDate?.() || null,
        atualizadoPor: x.atualizadoPor || '',
      };
    })
    .sort((a, b) => (b.atualizadoEm?.getTime() || 0) - (a.atualizadoEm?.getTime() || 0));
}

export function definirEditores(id, editores, resumoTexto) {
  const u = usuario();
  const batch = fb.writeBatch(db);
  batch.update(refIncidente(id), { editores, atualizadoEm: fb.serverTimestamp(), atualizadoPor: u.nome });
  registroHistorico(batch, id, u, resumoTexto, null);
  return batch.commit();
}

export function definirEncerrado(id, encerrado) {
  const u = usuario();
  const batch = fb.writeBatch(db);
  batch.update(refIncidente(id), { encerrado, atualizadoEm: fb.serverTimestamp(), atualizadoPor: u.nome });
  registroHistorico(batch, id, u, encerrado ? 'Incidente encerrado' : 'Incidente reaberto', null);
  return batch.commit();
}

export async function historico(id) {
  const q = fb.query(fb.collection(db, 'incidentes', id, 'historico'), fb.orderBy('em', 'desc'), fb.limit(300));
  const r = await fb.getDocs(q);
  return r.docs.map((d) => {
    const x = d.data({ serverTimestamps: 'estimate' });
    return { ...x, em: x.em?.toDate?.() || null };
  });
}
