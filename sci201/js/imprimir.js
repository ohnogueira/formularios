// Impressão: converte o PDF gerado em imagens de página (pdf.js) e chama a impressão do navegador.
// Assim o documento impresso é idêntico ao PDF, no notebook e no Android.

const base = new URL('../vendor/pdfjs/', import.meta.url).href;
const MENSAGEM_PADRAO = '<p class="aviso-impressao">Para imprimir o SCI-201, use o botão “Imprimir” do aplicativo.</p>';

// Volta a área de impressão à mensagem padrão (chamado quando o formulário é alterado,
// para que um Ctrl+P posterior não imprima uma versão desatualizada).
export function limparAreaImpressao() {
  const area = document.getElementById('area-impressao');
  if (area.firstElementChild?.tagName !== 'P') area.innerHTML = MENSAGEM_PADRAO;
}

export async function imprimirPDF(blob) {
  const pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
  const tarefa = pdfjs.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    standardFontDataUrl: base + 'standard_fonts/',
  });
  const pdf = await tarefa.promise;
  const imagens = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i);
    const viewport = pagina.getViewport({ scale: 2.2 }); // ~158 dpi
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    await pagina.render({ canvas, canvasContext: ctx, viewport }).promise;
    const img = new Image();
    img.alt = `Folha ${i}`;
    img.src = canvas.toDataURL('image/png');
    await img.decode();
    imagens.push(img);
  }
  await tarefa.destroy();
  const area = document.getElementById('area-impressao');
  area.replaceChildren(...imagens);
  window.print();
}
