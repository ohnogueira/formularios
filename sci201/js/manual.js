// Orientações de preenchimento transcritas do modelo "SCI 201 - Briefing do Incidente"
// (páginas de instruções ao final do formulário-modelo). Manter o texto fiel ao original.

export const MANUAL_GERAL = {
  titulo: 'SCI 201 - Briefing do Incidente',
  secoes: [
    {
      titulo: 'Propósito',
      texto:
        'O Formulário “Briefing do Incidente (SCI 201)” fornece ao Comandante do Incidente, ao Staff do Comando e Staff Geral, informações básicas sobre a situação do Incidente e os recursos empregados e/ou solicitados. Além de ser um documento que auxilia no briefing para uma eventual transferência de comando, o SCI 201 também serve como uma planilha descritiva das ações iniciais de resposta a um Incidente. Funciona como um registro permanente da resposta inicial ao Incidente.',
    },
    {
      titulo: 'Preparação',
      texto:
        'O formulário é preparado pelo atual Comandante do Incidente para apresentação ao Comandante do Incidente que irá assumir, juntamente com um briefing verbal mais detalhado.',
    },
    {
      titulo: 'Distribuição',
      texto:
        'Idealmente, o Formulário SCI 201 é confeccionado e distribuído antes do briefing inicial do Comando com seu Staff Geral e demais respondedores, conforme apropriado (Na Fase de Resposta Inicial – Fase Reativa, do Ciclo “P” de Planejamento Operacional. O “Mapa/Croquis” e “Ações, Estratégias e Táticas Atuais e Planejadas” das seções (páginas 1–2) do formulário de briefing são entregues à Unidade de Situação, enquanto a “Organização Atual” e “Resumo dos Recursos” das seções (páginas 3–4) são fornecidas à Unidade de Recursos.',
    },
    {
      titulo: 'Notas',
      lista: [
        'O Formulário SCI 201 pode servir como parte do Plano de Ação para Incidentes (PAI) inicial.',
        'Se forem necessárias páginas adicionais para qualquer página de formulário, use um Formulário SCI 201 em branco e repagine conforme necessário.',
      ],
    },
  ],
};

// Cada item: número do campo, título (como no formulário) e blocos de instrução.
// Blocos: { p: 'parágrafo' } | { lista: [...] } | { sub: 'Subcampo', p: '...' }
export const CAMPOS = {
  1: {
    titulo: 'Nome do Incidente',
    blocos: [{ p: 'Insira o nome designado ao Incidente.' }],
  },
  2: {
    titulo: 'Número do Incidente',
    blocos: [
      {
        p: 'Insira o número associado ao Incidente (Pode-se, por exemplo, referenciar o número SEI relativo ao registro específico do Incidente).',
      },
    ],
  },
  3: {
    titulo: 'Data/Hora de Início',
    blocos: [
      {
        p: 'Insira a data (dia/mês/ano) e o horário (Formato:00:00-24:00) em que se iniciou a confecção do Formulário.',
      },
    ],
  },
  4: {
    titulo:
      'MAPA/CROQUIS (incluir esboço, mostrando a área total das operações, o local/área do incidente impactado e ameaçado, outras áreas resultados de sobrevoo, trajetórias, linhas costeiras impactadas ou outros gráficos que retratam o status situacional e a localização geográfica dos recursos designados e/ou em empregos)',
    blocos: [
      {
        p: 'Mostre o perímetro do Incidente e outros gráficos representando o status situacional, designações dos recursos, das instalações e outras informações especiais em um desenho ou croquis com mapas anexados (caso haja). Utilize a simbologia comumente aceita em mapas e no SCI.',
      },
      {
        p: 'Se forem necessários pontos de referência geoespaciais específicos sobre o incidente no local ou em área fora da estrutura gerencial (organizacional) do SCI, essas informações devem ser descritas no Formulário “Resumo da Situação do Incidente (SCI 209)”.',
      },
      { p: 'O Norte geográfico deve estar no topo da página, salvo indicação em contrário.' },
    ],
  },
  5: {
    titulo:
      'Resumo da situação e briefing de saúde e segurança (Para briefings ou transferência de comando)',
    blocos: [
      {
        p: 'Reconhecer os potenciais riscos à saúde e a segurança e estabelecer medidas preventivas e/ou mitigadoras para proteger os respondedores e demais pessoas envolvidas no incidente. Ações esperadas: Eliminação de perigos (quando possível), fornecimento de equipamentos de proteção individual, alertas de riscos etc.',
      },
      { p: 'Instrução do manual: Autoexplicativo.' },
    ],
  },
  6: {
    titulo: 'Preparado por',
    blocos: [
      { lista: ['Nome', 'Cargo/Função', 'Assinatura', 'Data/Hora'] },
      {
        p: 'Insira o nome, cargo e/ou função (na estrutura do SCI, por exemplo: CI – Comandante do Incidente) de quem confecciona o formulário (com sua assinatura). Insira a data (dia/mês/ano) e o horário (Formato:00:00-24:00) em que se preparou o Formulário.',
      },
    ],
  },
  7: {
    titulo: 'Objetivos atuais e planejados',
    blocos: [
      {
        p: 'Insira os objetivos usados no incidente e anote qualquer problema específico áreas.',
      },
    ],
  },
  8: {
    titulo: 'Ações, estratégias e táticas atuais e planejadas',
    blocos: [
      { lista: ['Data/Horário', 'Ações'] },
      {
        p: 'Insira as ações, estratégias e táticas atuais e as planejadas e o tempo que elas levaram e/ou podem levar para atingir os objetivos. Se páginas adicionais forem necessárias, use uma folha em branco, ou outro Formulário SCI 201 (página 2), e ajuste os números das páginas.',
      },
      { p: 'Neste aplicativo, as páginas adicionais são criadas automaticamente no PDF.', app: true },
    ],
  },
  9: {
    titulo: 'Organização Atual (Insira as demais estruturas se necessárias)',
    blocos: [
      {
        lista: [
          'Comandante(s) do Incidente',
          'Oficial de Ligação',
          'Oficial de Segurança',
          'Oficial de Informações Públicas',
          'Chefe da Seção de Operações',
          'Chefe da Seção de Planejamento',
          'Chefe da Seção de Logística',
          'Chefe da Seção de Administração/Finanças',
        ],
      },
      { p: 'Insira no organograma os nomes das pessoas designadas em cada cargo/função.' },
      {
        lista: [
          'Modifique o gráfico conforme necessário e adicione quaisquer linhas/espaços necessários para Substitutos e/ou Assistentes do Staff do Comando e/ou do Staff Geral, Representantes das Agências e liste os Chefes de cada Seção.',
          'Se o Comando Unificado tiver sido ativado divida a caixa destinada ao Comandante do Incidente.',
          'Informe a instituição de cada um dos Comandantes do Incidente listados.',
        ],
      },
    ],
  },
  10: {
    titulo: 'Resumo dos Recursos',
    blocos: [
      {
        p: 'Insira as seguintes informações sobre os recursos designados em um incidente. Se forem necessárias páginas adicionais, use uma folha em branco ou outro Formulário SCI 201 (página 4) e ajuste os números das páginas.',
      },
      { p: 'Neste aplicativo, as páginas adicionais são criadas automaticamente no PDF.', app: true },
    ],
  },
  '10.recurso': {
    titulo: 'Recurso',
    blocos: [
      {
        p: 'Insira o número e a categoria, classe ou tipo apropriado de recurso despachado conforme convenção, ou definido pela instituição e/ou outra designação de recurso padronizada.',
      },
      {
        lista: [
          'Categoria: Embarcação/Aeronave (Asa Fixa/Asa Rotativa)/Veículo.',
          'Classe: Transporte de Passageiro/Transporte de Carga/Outros.',
          'Tipo: Número de Passageiro/Capacidade de Carga.',
        ],
      },
      { p: 'Exemplos:' },
      {
        lista: [
          'Helicóptero de transporte de passageiros com 5 lugares: HTP-5 – Helicóptero de Transporte de Passageiros com 5 lugares.',
          'Avião de Combate a Incêndios Florestais com 3.100 L de capacidade – AT 802F (nomenclatura de fábrica).',
        ],
      },
    ],
  },
  '10.identificador': {
    titulo: 'Identificador do Recurso',
    blocos: [
      {
        p: 'Insira o código utilizado por convenção, ou definido pela instituição e/ou outra designação de recurso padronizada (se houver).',
      },
      { p: 'Exemplo: Prefixo do avião de combate a incêndios florestais: PR-EBM.' },
    ],
  },
  '10.solicitacao': {
    titulo: 'Data/Hora da Solicitação',
    blocos: [
      {
        p: 'Insira a data (dia/mês/ano) e o horário (Formato:00:00-24:00) em que o recurso foi solicitado.',
      },
    ],
  },
  '10.hpc': {
    titulo: 'HPC',
    blocos: [
      {
        p: 'Insira a data (dia/mês/ano) e o horário (Formato:00:00-24:00) relativo ao Horário Previsto de Chegada do Recurso no incidente.',
      },
    ],
  },
  '10.local': {
    titulo: 'No Local',
    blocos: [{ p: 'Insira um “X” caso o recurso esteja no local do incidente.' }],
  },
  '10.notas': {
    titulo: 'Notas (Localização/Designação/Status)',
    blocos: [
      {
        p: 'Insira informações como, por exemplo, o local onde o recurso está sendo empregado e/ou o seu status (disponível, indisponível e /ou designado).',
      },
    ],
  },
};
