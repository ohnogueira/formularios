// Configuração do projeto Firebase (modo compartilhado).
// Copie aqui o objeto "firebaseConfig" do app Web: Console do Firebase → Configurações do projeto → Seus apps.
// Estes valores identificam o projeto e não são senhas; o acesso aos dados é controlado pelas regras (firestore.rules).
export const FIREBASE_CONFIG = null;

// Testes locais com o Firebase Emulator Suite: abrir o app em http://localhost:.../sci201/?emulador
export const EMULADOR =
  ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('emulador');
