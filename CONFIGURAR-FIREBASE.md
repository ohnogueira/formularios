# Configurar o modo compartilhado (Firebase)

Configuração feita **uma única vez**, pelo responsável pelo app, com a conta Google que será a dona dos dados (ohnogueira@gmail.com). Tempo estimado: 10 a 15 minutos. Plano gratuito (Spark), sem cartão de crédito.

> Os nomes dos menus do console do Firebase mudam com frequência. Se algum nome abaixo não aparecer igual, procure pelo item equivalente no menu lateral.

## 1. Criar o projeto

1. Acesse <https://console.firebase.google.com/> com a conta **ohnogueira@gmail.com**.
2. Clique em **Criar projeto** (ou *Add project*). Nome sugerido: `sci201`.
3. O Google Analytics **não é necessário**; pode desativar.
4. Aguarde a criação e clique em **Continuar**.

## 2. Ativar o login com conta Google

1. No menu lateral: **Authentication** (pode estar dentro de *Security* / *Segurança*) → **Vamos começar**, se aparecer.
2. Aba **Sign-in method** (Método de login) → **Google** → ative a chave **Ativar**.
3. Em *E-mail de suporte do projeto*, escolha ohnogueira@gmail.com → **Salvar**.
4. Ainda em Authentication, aba **Settings** (Configurações) → **Authorized domains** (Domínios autorizados) → **Adicionar domínio** → digite `ohnogueira.github.io` → **Adicionar**.

## 3. Criar o banco de dados (Cloud Firestore)

1. No menu lateral: **Firestore Database** (pode estar dentro de *Databases & Storage* / *Build*) → **Criar banco de dados**.
2. Se for perguntado, escolha a edição **Standard**.
3. Local: **southamerica-east1 (São Paulo)**. Este local não pode ser alterado depois.
4. Modo: **Produção** (*production mode*) → **Criar**.

## 4. Publicar as regras de acesso

1. Em Firestore, abra a aba **Regras** (*Rules*).
2. Apague todo o texto e cole o conteúdo do arquivo [`firestore.rules`](firestore.rules) deste repositório.
3. Clique em **Publicar**.

Essas regras garantem que:
- qualquer pessoa com o link de um incidente pode **consultar** o formulário (sem login);
- somente os e-mails autorizados (editores) podem **editar**;
- somente quem criou o incidente gerencia os editores e encerra/reabre o incidente;
- o histórico de alterações não pode ser alterado nem apagado.

## 5. Registrar o app Web e enviar a configuração

1. Clique na engrenagem ⚙ → **Configurações do projeto**.
2. Em **Seus apps**, clique no ícone **Web** (`</>`). Apelido: `SCI-201`. **Não** marque Firebase Hosting. Clique em **Registrar app**.
3. Aparecerá um trecho de código com `const firebaseConfig = { ... }`. Copie **somente o bloco entre chaves**, por exemplo:

   ```js
   {
     apiKey: "AIza...",
     authDomain: "sci201-xxxxx.firebaseapp.com",
     projectId: "sci201-xxxxx",
     storageBucket: "sci201-xxxxx.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   }
   ```

4. Envie esse bloco ao desenvolvedor (ou cole no arquivo `sci201/js/firebase-config.js`, no lugar de `null`).

Esses valores **não são senhas**: eles apenas identificam o projeto e ficam visíveis no app publicado. Quem controla o acesso aos dados são as regras do passo 4 ([documentação do Firebase](https://firebase.google.com/docs/projects/api-keys)).

## Limites do plano gratuito (Spark)

Fonte: <https://firebase.google.com/pricing>

| Recurso | Limite gratuito |
|---|---|
| Firestore: dados armazenados | 1 GiB |
| Firestore: leituras | 50.000 por dia |
| Firestore: gravações | 20.000 por dia |
| Authentication | 50.000 usuários ativos por mês |

O app não usa o Cloud Storage, que exige o plano pago (Blaze). As imagens do croquis são comprimidas e gravadas no próprio Firestore.

## Testes locais (desenvolvedor)

```bash
npx firebase-tools emulators:start --project demo-sci201 --only auth,firestore
python3 -m http.server 8765
# abrir http://localhost:8765/sci201/?emulador
```
