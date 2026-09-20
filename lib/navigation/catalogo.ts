import type { Role } from "@/lib/auth/types";

/**
 * Registro de navegação — a ÚNICA lista de destinos do app do tenant.
 *
 * Antes disto, três listas descreviam o mesmo conjunto e divergiam: `NAV_ITEMS`
 * no Sidebar, `LINKS` no hub de Configurações e `TABS` na área de IA. Sete telas
 * só eram alcançáveis por dentro da própria seção e uma não tinha link nenhum.
 *
 * Sidebar, hubs e a paleta ⌘K são PROJEÇÕES puras deste array — nenhum deles
 * decide o que existe, só desenha o que sai daqui. Tela nova aparece nos três
 * sem editar três arquivos, e `tests/unit/navegacao-completude.test.ts` reprova
 * o CI se uma rota nascer fora daqui.
 *
 * Doutrina: docs/doctrine/sistema-vivo.md — "por qual porta se chega até mim?"
 */

export type NavGroupId = "inicio" | "atendimento" | "crm" | "recrutamento" | "ia" | "canais" | "analise" | "organizacao";

export interface NavGroup {
  id: NavGroupId;
  label: string;
  /**
   * Hub do grupo, quando ele tem telas demais para caber no sidebar.
   * O rótulo é declarado junto do href porque não é derivável: "Ver tudo em IA"
   * é útil, "Ver tudo em Organização" seria gratuito quando a tela já se chama
   * Configurações e o usuário a conhece por esse nome.
   */
  hub?: { href: string; label: string };
}

export interface NavMetadata {
  href: string;
  label: string;
  /** Aparece no card do hub e é texto buscável no ⌘K. Nunca vazio. */
  description: string;
  icon: string;
  group: NavGroupId;
  /** Obrigatória em grupo com hub — é o agrupamento por jornada dentro dele. */
  section?: string;
  /** Ausente = viewer. Ver a regra de escolha abaixo. */
  minRole?: Role;
  /** Ausente = só no hub. `true` = uso diário, sobe para o sidebar. */
  sidebar?: boolean;
  /** false = rota preservada no catalogo, mas escondida das superficies V1. */
  v1Visible?: boolean;
  healthDot?: boolean;
}

/**
 * Grupos por OBJETIVO, na ordem de uso: o que se abre toda hora primeiro, o que
 * se ajusta uma vez por mês por último.
 */
export const NAV_GROUPS: NavGroup[] = [
  { id: "inicio", label: "Início" },
  { id: "atendimento", label: "Atendimento" },
  { id: "crm", label: "Comercial", hub: { href: "/app/crm", label: "Ver tudo em Comercial" } },
  {
    id: "recrutamento",
    label: "Recrutamento",
    hub: { href: "/app/recrutamento", label: "Ver tudo em Recrutamento" },
  },
  { id: "ia", label: "Automação & IA", hub: { href: "/app/ai", label: "Ver tudo em IA" } },
  { id: "canais", label: "Canais" },
  { id: "analise", label: "Análise", hub: { href: "/app/analise", label: "Ver tudo em Análise" } },
  {
    id: "organizacao",
    label: "Configurações",
    hub: { href: "/app/settings", label: "Configurações" },
  },
];

/**
 * Grupo cujo hub vive no RODAPÉ fixo do sidebar, fora da área que rola.
 */
export const GRUPO_NO_RODAPE: NavGroupId = "organizacao";

export const NAV_CATALOG = [
  // ---- Início — Visão executiva & operacional ----
  {
    href: "/app",
    label: "Dashboard",
    description: "Visão executiva e operacional do seu dia, comercial e recrutamento.",
    icon: "House",
    group: "inicio",
    sidebar: true,
  },

  // ---- Atendimento — onde o operador passa o dia ----
  {
    href: "/app/inbox",
    label: "Conversas",
    description: "As conversas de WhatsApp, com você e a IA atendendo lado a lado.",
    icon: "Inbox",
    group: "atendimento",
    sidebar: true,
  },
  {
    href: "/app/radar",
    label: "Radar",
    description: "Quem esfriou e ainda está aberto — o que corre risco de morrer sem resposta.",
    icon: "ClockCountdown",
    group: "atendimento",
    sidebar: true,
  },
  {
    href: "/app/agenda",
    label: "Agenda",
    description: "O que está marcado, com quem, e quem atende — seu e da equipe.",
    icon: "CalendarBlank",
    group: "atendimento",
    sidebar: true,
  },
  {
    href: "/app/templates",
    label: "Respostas rápidas",
    description: "Scripts salvos para responder mais rápido, seus ou da equipe.",
    icon: "FileText",
    group: "atendimento",
    sidebar: true,
  },

  // ---- CRM — o dia a dia comercial ----
  {
    href: "/app/crm/empresas",
    label: "Empresas",
    description: "Empresas clientes B2B, contatos vinculados e posições abertas.",
    icon: "Buildings",
    group: "crm",
    section: "O dia a dia da venda",
    sidebar: true,
  },
  {
    href: "/app/contacts",
    label: "Contatos",
    description: "As pessoas do outro lado da conversa e seu histórico.",
    icon: "Users",
    group: "crm",
    section: "O dia a dia da venda",
    sidebar: true,
  },
  {
    href: "/app/kanban",
    label: "Oportunidades",
    description: "Seus funis de venda — clique em um para abrir o quadro de clientes.",
    icon: "Kanban",
    group: "crm",
    section: "O dia a dia da venda",
    sidebar: true,
  },
  {
    href: "/app/tasks",
    label: "Tarefas",
    description: "O que ficou combinado, com prazo — e o que já venceu sem ninguém fazer.",
    icon: "ListChecks",
    group: "crm",
    section: "O dia a dia da venda",
    sidebar: true,
  },
  {
    href: "/app/products",
    label: "Produtos",
    v1Visible: false,
    description: "O catálogo da loja, com o preço que o atendente de IA responde.",
    icon: "Storefront",
    group: "crm",
    section: "Preparar a venda",
  },
  {
    href: "/app/settings/tenant/pipelines",
    label: "Etapas do funil",
    description: "As colunas de cada funil, o vocabulário do negócio e os motivos de perda.",
    icon: "Funnel",
    group: "crm",
    section: "Preparar a venda",
    minRole: "manager",
  },

  // ---- Recrutamento — R&S e Banco de Talentos ----
  {
    href: "/app/recrutamento/talentos",
    label: "Banco de Talentos",
    description: "Candidatos cadastrados, histórico profissional e currículos versionados.",
    icon: "UsersThree",
    group: "recrutamento",
    section: "Gestão de Talentos",
    sidebar: true,
  },
  {
    href: "/app/recrutamento/curriculos",
    label: "Currículos",
    description: "Acervo de arquivos e versões de currículos em armazenamento seguro.",
    icon: "FileText",
    group: "recrutamento",
    section: "Gestão de Talentos",
    sidebar: true,
  },
  {
    href: "/app/recrutamento/vagas",
    label: "Vagas",
    description: "Posições abertas para empresas clientes e acompanhamento de processo.",
    icon: "ClipboardText",
    group: "recrutamento",
    section: "Processos Seletivos",
    sidebar: true,
  },
  {
    href: "/app/recrutamento/candidaturas",
    label: "Candidaturas",
    description: "Visão consolidada de todas as candidaturas ativas e histórico.",
    icon: "ListChecks",
    group: "recrutamento",
    section: "Processos Seletivos",
    sidebar: true,
  },
  {
    href: "/app/recrutamento/pipeline",
    label: "Funil de Seleção",
    description: "Quadro com as 10 etapas seletivas de 01 Recebido a 10 Desistiu.",
    icon: "Kanban",
    group: "recrutamento",
    section: "Processos Seletivos",
    sidebar: true,
  },

  // ---- Agente de IA — montar, ensinar, acompanhar ----
  {
    href: "/app/ai/agents",
    label: "Assistentes",
    description: "Quem atende por você: instruções, modelo, ferramentas e publicação.",
    icon: "Robot",
    group: "ia",
    section: "Montar o agente",
    minRole: "manager",
    sidebar: true,
  },
  {
    href: "/app/ai/followups",
    label: "Follow-ups",
    description: "Como o agente retoma uma conversa que esfriou, para nenhuma morrer no silêncio.",
    icon: "FlowArrow",
    group: "ia",
    section: "Montar o agente",
    minRole: "manager",
    sidebar: true,
  },
  {
    href: "/app/ai/routers",
    label: "Roteadores",
    description: "Qual agente pega qual conversa, e quando o humano assume.",
    icon: "Signpost",
    group: "ia",
    section: "Montar o agente",
    minRole: "manager",
  },
  {
    href: "/app/ai/credentials",
    label: "Credenciais",
    description: "A chave do provedor de IA que os agentes usam para pensar.",
    icon: "Key",
    group: "ia",
    section: "Montar o agente",
    minRole: "manager",
  },
  {
    // O sistema chama modelo em 23 lugares e, até esta tela, a escolha vivia
    // espalhada por três pilhas de código e sete variáveis de ambiente — não
    // havia onde responder "quem usa IA aqui, e com qual chave?".
    href: "/app/ai/providers",
    label: "Provedores",
    description: "Qual inteligência atende cada parte do sistema — e o que acontece se ela falhar.",
    icon: "Plugs",
    group: "ia",
    section: "Montar o agente",
    minRole: "manager",
    // SEM `sidebar: true`, como as outras nove telas deste grupo. Adicionar as
    // duas telas novas à sidebar estourou a dobra em 900px — medido pelo e2e
    // `navegacao.spec.ts`, que existe justamente porque agrupar o menu o faz
    // crescer. Configurar provedor é tarefa de poucas vezes; o caminho é o hub
    // "Ver tudo em IA", igual a Credenciais, Conhecimento, Memória e Skills.
  },
  {
    href: "/app/ai/knowledge/sources",
    label: "Conhecimento",
    description: "Os materiais que o agente consulta antes de responder sobre o seu negócio.",
    icon: "BookOpen",
    group: "ia",
    section: "Ensinar o agente",
    minRole: "manager",
  },
  {
    href: "/app/ai/memory",
    label: "Memória",
    description: "O que o agente já aprendeu sobre a sua operação e reaproveita.",
    icon: "Brain",
    group: "ia",
    section: "Ensinar o agente",
    minRole: "manager",
  },
  {
    href: "/app/ai/skills",
    label: "Skills",
    description: "As ações que o agente pode executar sozinho durante o atendimento.",
    icon: "PuzzlePiece",
    group: "ia",
    section: "Ensinar o agente",
    minRole: "manager",
  },
  {
    href: "/app/ai/cases",
    label: "Casos",
    description: "Os atendimentos que o agente conduziu, do início ao desfecho.",
    icon: "ClipboardText",
    group: "ia",
    section: "Acompanhar o agente",
    minRole: "agent",
  },
  {
    href: "/app/ai/inbox",
    label: "Alertas",
    description: "O que a IA encontrou e precisa de uma decisão sua.",
    icon: "Flag",
    group: "ia",
    section: "Acompanhar o agente",
  },
  {
    // Órfã: nenhum lugar do app linkava para cá. O flywheel gerava propostas de
    // melhoria do agente e a fila só era vista por quem soubesse a URL.
    href: "/app/ai/proposals",
    label: "Propostas",
    description: "Melhorias que a IA sugere para si mesma, esperando sua decisão.",
    icon: "Lightbulb",
    group: "ia",
    section: "Acompanhar o agente",
  },
  {
    // A tela de Uso responde "quanto gastei". Esta responde a pergunta que não
    // tinha lugar nenhum: "o agente parou de responder, o que aconteceu?".
    // Antes da migration 0128 ela seria impossível de construir com honestidade
    // — llm_calls só registrava sucesso.
    href: "/app/ai/runs",
    label: "Execuções",
    description: "O que a IA fez — e, quando falhou, o que aconteceu e o que fazer.",
    icon: "ListChecks",
    group: "ia",
    section: "Acompanhar o agente",
    minRole: "manager",
    // Idem: fora da sidebar para o menu não passar da dobra. Quem vem para cá
    // está diagnosticando, e chega pelo hub ou pelo link do aviso na Central.
  },
  {
    href: "/app/ai/usage",
    label: "Uso e orçamento",
    description: "Quanto a IA consumiu e qual é o teto de gasto do mês.",
    icon: "Gauge",
    group: "ia",
    section: "Acompanhar o agente",
    minRole: "manager",
  },

  // ---- Canais — por onde as mensagens entram e saem ----
  {
    href: "/app/connections",
    label: "Conexões",
    // Cobre os DOIS caminhos desde o PR #105: número por QR e canal oficial da
    // Meta (com os templates dele), cada um numa aba. A descrição cita "oficial"
    // e "Meta" de propósito — é por esses nomes que se procura no ⌘K, e a busca
    // varre a descrição além do rótulo.
    description:
      "Seus números de WhatsApp: por QR ou canal oficial da Meta, com saúde, reconexão e templates.",
    icon: "PlugsConnected",
    group: "canais",
    minRole: "admin",
    sidebar: true,
    healthDot: true,
  },
  {
    // Não tinha link nenhum no app inteiro: só se chegava digitando a URL.
    href: "/app/integrations/nuvemshop",
    label: "Nuvemshop",
    v1Visible: false,
    description: "Conecte a loja para trazer pedidos e clientes para dentro do CRM.",
    icon: "Storefront",
    group: "canais",
    // A página não filtra por papel, mas as Server Actions de conectar e
    // desconectar exigem admin — mostrar a um viewer seria oferecer botão morto.
    minRole: "admin",
    // Não participa da navegação V1. O destino permanece no catálogo para
    // preservar a porta da rota e a completude do registro, sem expor a
    // integração nas projeções de menu ou pesquisa.
  },
  {
    href: "/app/webhooks",
    label: "Webhooks",
    description: "Avise outros sistemas quando algo acontecer aqui dentro.",
    icon: "WebhooksLogo",
    group: "organizacao",
    section: "Integrações",
    minRole: "manager",
  },

  // ---- Análise — olhar o sistema funcionando ----
  {
    href: "/app/metrics",
    label: "Desempenho",
    description: "Funil e performance por atendente nos últimos 30 dias.",
    icon: "ChartBar",
    group: "analise",
    section: "Os números do período",
    sidebar: true,
  },
  {
    href: "/app/ads/meta",
    label: "Meta Ads",
    v1Visible: false,
    description: "Quanto custou cada resultado das campanhas que trazem gente para cá.",
    icon: "Megaphone",
    group: "analise",
    section: "Os números do período",
    minRole: "manager",
  },
  {
    // Irmã de "Desempenho", não a mesma coisa: lá é DESFECHO (funil agora,
    // ganho/perdido por atendente); aqui é o TRABALHO que aconteceu no
    // período, com quem fez cada coisa. Um mês inteiro atendido pela IA e um
    // mês inteiro atendido pela equipe têm o mesmo desfecho e histórias
    // opostas — só esta tela distingue as duas.
    href: "/app/activities",
    label: "Atividades",
    description:
      "Relatório do que a equipe e os agentes fizeram no período: quanto, quem e de que tipo.",
    icon: "ClockCounterClockwise",
    group: "analise",
    section: "Os números do período",
    sidebar: true,
  },
  {
    // Observabilidade, não configuração: por isso não fica junto dos agentes.
    href: "/app/ai/evolution",
    label: "Evolução da IA",
    description: "Se o agente está melhorando, onde ele erra e o que falta ensinar.",
    icon: "ChartLineUp",
    group: "analise",
    section: "O histórico que se consulta",
    minRole: "manager",
  },
  {
    href: "/app/audit",
    label: "Audit Log",
    description: "Quem fez o quê, quando — o histórico que não se apaga.",
    icon: "ClockCounterClockwise",
    group: "analise",
    section: "O histórico que se consulta",
    minRole: "manager",
  },

  // ---- Organização — conta, empresa, acesso ----
  {
    href: "/app/settings/tenant/agenda",
    label: "Tipos de agendamento",
    description: "O que se pode marcar, quanto dura, onde acontece e quem atende.",
    icon: "CalendarBlank",
    group: "organizacao",
    section: "Sua empresa",
  },
  {
    href: "/app/settings/profile",
    label: "Perfil",
    description: "Seu nome, idioma, fuso horário e avatar.",
    icon: "UserCircle",
    group: "organizacao",
    section: "Sua conta",
  },
  {
    href: "/app/settings/security",
    label: "Segurança",
    description: "Verificação em duas etapas, códigos de recuperação e sessões.",
    icon: "ShieldCheck",
    group: "organizacao",
    section: "Sua conta",
  },
  {
    href: "/app/settings/notifications",
    label: "Notificações",
    description: "Por onde e sobre o quê você quer ser avisado.",
    icon: "Bell",
    group: "organizacao",
    section: "Sua conta",
  },
  {
    href: "/app/team",
    label: "Equipe",
    description: "Quem trabalha aqui, com qual papel e quanta conversa cada um aguenta.",
    icon: "UsersThree",
    group: "organizacao",
    section: "Sua empresa",
  },
  {
    // A porta que faltava (issue #144): rodízio de atendimento e restrição de
    // visibilidade existiam inteiros no backend e não tinham NENHUMA tela — só
    // dava para ligar com UPDATE à mão no banco.
    href: "/app/settings/atendimento",
    label: "Distribuição de atendimento",
    description: "Quem recebe cada cliente novo, e o que cada atendente enxerga.",
    icon: "UsersThree",
    group: "organizacao",
    section: "Sua empresa",
    minRole: "manager",
  },
  {
    href: "/app/settings/tenant",
    label: "Organização",
    description: "Dados da empresa, retenção de dados e encarregado de LGPD.",
    icon: "Buildings",
    group: "organizacao",
    section: "Sua empresa",
    minRole: "admin",
  },
  {
    // Mora em Organização e não em Canais de propósito: o que se configura aqui
    // é a CONTA DE ANÚNCIOS da empresa — dinheiro e identidade comercial, ao lado
    // de billing e API tokens. Canais é por onde se FALA com o cliente, e os dois
    // eixos são independentes (dá para receber lead de anúncio num número servido
    // por qualquer transporte). Ver `lib/plataformas-de-anuncio/types.ts`.
    href: "/app/settings/conversoes",
    label: "Conversões",
    v1Visible: false,
    description:
      "Devolver ao anúncio as vendas que ele trouxe, para ele aprender a procurar mais clientes parecidos.",
    icon: "ChartLineUp",
    group: "organizacao",
    section: "Sua empresa",
    // `admin` pelo mesmo critério das vizinhas: o token grava na conta de
    // anúncios da empresa, e quem o troca decide para onde vai o dinheiro de
    // mídia. Um `manager` ficaria acima de billing na mesma prancheta.
    minRole: "admin",
  },
  {
    // Vizinha de Conversões, e SEPARADA dela de propósito. As duas conectam "a
    // Meta" e a tentação de fundi-las é real — mas são credenciais de escopos
    // diferentes, em tabelas diferentes (0214), com consequências opostas
    // quando vencem: o token de leitura vencido deixa uma tela vazia, o de
    // conversões vencido faz a empresa parar de reportar vendas sem sintoma.
    // Uma tela só, com dois campos de token parecidos, é como se cola o token
    // errado no campo errado e se perde uma semana achando que quebrou.
    href: "/app/settings/meta-ads",
    label: "Meta Ads",
    v1Visible: false,
    description: "Conectar a conta de anúncios para ler o desempenho das campanhas.",
    icon: "Megaphone",
    group: "organizacao",
    section: "Sua empresa",
    // `admin` pelo mesmo critério da vizinha, mesmo o token sendo só de
    // leitura: ele expõe orçamento e performance da conta inteira, e quem
    // apenas LÊ a tela (`manager`) não precisa poder trocar a credencial.
    minRole: "admin",
  },
  {
    href: "/app/settings/marca",
    label: "Marca",
    description: "O nome e a cor que sua empresa mostra dentro do sistema.",
    icon: "Palette",
    group: "organizacao",
    section: "Sua empresa",
    // `admin` pelo mesmo motivo da linha de cima: o que se edita ali é
    // identidade da empresa, e dá-lo a `manager` o colocaria abaixo de billing e
    // de API tokens na mesma prancheta.
    minRole: "admin",
    // SEM `sidebar`: fica só no hub. Trocar a marca é tarefa de uma vez, e
    // agrupar o menu já o fez crescer — duas telas a mais estouraram a dobra em
    // 900px, medido pelo e2e `navegacao.spec.ts`.
  },
  {
    href: "/app/settings/billing",
    label: "Billing",
    v1Visible: false,
    description: "Plano e cobrança.",
    icon: "Receipt",
    group: "organizacao",
    section: "Sua empresa",
    minRole: "admin",
  },
  {
    href: "/app/lgpd/requests",
    label: "LGPD",
    description: "Pedidos de exportação e exclusão de dados feitos por clientes.",
    icon: "ScalesSimple",
    group: "organizacao",
    section: "Dados e acesso",
    minRole: "admin",
  },
  {
    href: "/app/settings/api-tokens",
    label: "API Tokens",
    description: "Chaves para outro sistema conversar com o seu CRM.",
    icon: "Lock",
    group: "organizacao",
    section: "Dados e acesso",
    minRole: "admin",
  },
] as const satisfies readonly NavMetadata[];

export type NavDestinationId = (typeof NAV_CATALOG)[number]["href"];
