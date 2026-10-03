# Formulários SCI

## SCI-201 · Briefing do Incidente (`sci201/`)

Aplicativo web instalável (PWA) para preencher o Formulário SCI-201 e gerar o PDF no layout do modelo (4 páginas).

- Abre pelo link no notebook (Chrome/Edge) e no celular Android (Chrome); pode ser instalado como app.
- Funciona sem internet após o primeiro acesso.
- Os dados ficam salvos **somente no aparelho** de quem preenche (nenhum servidor, nenhum login).
- Botão **?** em cada campo com as orientações de preenchimento do modelo; botão **Guia** com o manual completo.
- Campo 4: anexar foto/imagem e desenhar por cima; indicador de Norte.
- Campo 6: assinatura com o dedo/mouse (opcional).
- Campo 9: organograma gerado automaticamente, com Comando Unificado e cargos adicionais.
- Campos 8 e 10: linhas ilimitadas; o PDF cria páginas de continuação automaticamente.
- Botões **PDF** e **Imprimir** no topo da tela, disponíveis em qualquer etapa, mesmo com o formulário incompleto. A impressão é idêntica ao PDF.
- Exporta PDF e um arquivo `.json` que pode ser reaberto (continuar depois / transferência de comando).

### Publicação (GitHub Pages)

1. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
2. Escolha a branch `main` e a pasta `/ (root)` e clique em **Save**.
3. Após alguns minutos, o app fica disponível em `https://ohnogueira.github.io/formularios/sci201/`.

### Atualizar o app

Ao alterar qualquer arquivo de `sci201/`, incremente `VERSAO` em `sci201/sw.js`. Assim, os aparelhos que já usam o app recebem o aviso “Nova versão disponível”.

### Estrutura

| Caminho | Conteúdo |
|---|---|
| `sci201/index.html` | Interface (6 etapas) |
| `sci201/js/manual.js` | Orientações de preenchimento transcritas do modelo |
| `sci201/js/app.js` | Lógica da interface |
| `sci201/js/pdf.js` | Geração do PDF |
| `sci201/js/org.js` | Organograma (campo 9) |
| `sci201/js/pad.js` | Desenho/assinatura |
| `sci201/js/store.js` | Armazenamento local (IndexedDB) |
| `sci201/sw.js` | Funcionamento offline |
| `sci201/js/imprimir.js` | Impressão (converte o PDF em páginas com pdf.js) |
| `sci201/vendor/` | jsPDF 4.2.1 e jsPDF-AutoTable 5.0.8 (MIT); pdf.js 6.4.299, build legacy (Apache-2.0); fontes Liberation Sans (licença em `vendor/pdfjs/standard_fonts/LICENSE_LIBERATION`) |
