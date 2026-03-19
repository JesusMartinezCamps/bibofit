/**
 * guideBlocks.js
 *
 * Single source of truth for all contextual guide blocks.
 * To add a new block: add an entry here + call triggerBlock('new-id') in the target component.
 * To modify a block: edit its steps array — no logic changes needed.
 *
 * Icon fields accept either:
 *   - string  → rendered as emoji/text
 *   - { name: string, className: string } → lucide icon resolved via GuideIcon
 *
 * Step fields:
 *   title        — short headline
 *   content      — explanation text
 *   icon         — (optional) icon shown next to the step title in the tooltip
 *   targetId     — (optional) DOM id of the element to highlight in future spotlight mode
 */

export const GUIDE_BLOCK_IDS = {
  DASHBOARD: 'dashboard',
  DIET_PLAN: 'diet-plan',
  SHOPPING_LIST: 'shopping-list',
  RECIPE_VIEW: 'recipe-view',
  RECIPE_EDIT: 'recipe-edit',
  VARIANT_TREE: 'variant-tree',
  CHAT: 'chat',
  WEIGHT_HISTORY: 'weight-history',
  MY_PLAN: 'my-plan',
  SNACK_SELECTOR: 'snack-selector',
  FREE_RECIPE_SELECTOR: 'free-recipe-selector',
};

export const GUIDE_BLOCKS = [
  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    section: 'Inicio',
    title: 'Tu Dashboard',
    route: '/dashboard',
    icon: { name: 'AppIcon', className: 'h-6 w-6 text-primary' },
    steps: [
      {
        title: 'Tu progreso en el calendario',
        icon: { name: 'Calendar', className: 'h-4 w-4 text-emerald-500' },
        content:
          'El calendario refleja tu progreso diario. Pulsa en cualquier día para revisar tu dieta y/o entreno de esa jornada.',
        targetId: 'dashboard-calendar',
      },
      {
        title: 'Cambia la densidad de información',
        icon: { name: 'Eye', className: 'h-4 w-4 text-muted-foreground' },
        content:
          'Usa el botón del ojo para alternar entre una vista compacta y una vista detallada con más información visible.',
        targetId: 'dashboard-eye-toggle',
      },
    ],
  },

  // ─── DIET PLAN ────────────────────────────────────────────────────────────────
  {
    id: 'diet-plan',
    section: 'Dieta',
    title: 'Plan de Dieta',
    route: '/plan/dieta',
    icon: { name: 'Apple', className: 'h-6 w-6 text-green-500' },
    steps: [
      {
        title: 'Navega por tu semana',
        icon: { name: 'Calendar', className: 'h-4 w-4 text-emerald-500' },
        content:
          'El visualizador superior muestra tu semana de un vistazo. Navega entre días pulsando las flechas. Los puntos de colores son señales rápidas: 🟣 registraste tu peso, 🟠 añadiste un picoteo, 🟢 marcaste una receta como comida.',
        targetId: 'diet-plan-week-viewer',
      },
      {
        title: 'Registro de peso',
        icon: { name: 'Scale', className: 'h-4 w-4 text-violet-500' },
        content:
          'Los botones de Registro de Peso te permiten trackear tu evolución física día a día. Con la constancia, Bibofit irá ajustando tu plan para maximizar resultados.',
        targetId: 'diet-plan-weight-log',
      },
      {
        title: 'Visualizador de macros',
        icon: { name: 'BarChart3', className: 'h-4 w-4 text-primary' },
        content:
          'Esta sección lleva un registro acumulado de todo lo que has introducido como comida durante el día, para que siempre tengas bajo control tus calorías y macronutrientes.',
        targetId: 'diet-plan-macro-viewer',
      },
      {
        title: 'Comidas del día',
        icon: { name: 'UtensilsCrossed', className: 'h-4 w-4 text-foreground' },
        content:
          'Tu dieta está dividida en los momentos del día que configuraste. Usa el buscador inteligente para navegar entre recetas: filtra por alimento, familia nutricional, estilo de receta, dificultad y mucho más.',
        targetId: 'diet-plan-meals',
      },
      {
        title: 'Más o menos detalle',
        icon: { name: 'Eye', className: 'h-4 w-4 text-muted-foreground' },
        content:
          'Usa el botón del ojo para cambiar la densidad de la información visible y adaptarla a tu preferencia.',
        targetId: 'diet-plan-eye-toggle',
      },
      {
        title: 'Planificación Semanal',
        icon: { name: 'Calendar', className: 'h-4 w-4 text-primary' },
        content:
          'En la sección de Planificación Semanal puedes decidir qué recetas quieres comer en los próximos días. Bibofit ajustará automáticamente tu Lista de la Compra Inteligente para que no te falte nada.',
        targetId: 'diet-plan-weekly-planner',
      },
    ],
  },

  // ─── SHOPPING LIST ────────────────────────────────────────────────────────────
  {
    id: 'shopping-list',
    section: 'Compra',
    title: 'Lista de la Compra',
    route: '/shopping-list',
    icon: { name: 'ShoppingCart', className: 'h-6 w-6 text-primary' },
    steps: [
      {
        title: 'Tu lista privada',
        icon: { name: 'Lock', className: 'h-4 w-4 text-violet-500' },
        content:
          'Aquí tienes una lista completamente tuya que puedes personalizar a tu gusto: añade cualquier producto que necesites, con o sin recetas.',
        targetId: 'shopping-list-private',
      },
      {
        title: 'Dos vistas, toda la información',
        icon: { name: 'LayoutList', className: 'h-4 w-4 text-foreground' },
        content:
          'La vista "Lista" muestra todos tus alimentos en un solo sitio. La vista "Comidas Planificadas" es la sección inteligente: se genera automáticamente a partir de las recetas que hayas planificado en la semana.',
        targetId: 'shopping-list-tabs',
      },
      {
        title: 'El buscador inteligente',
        icon: { name: 'Search', className: 'h-4 w-4 text-primary' },
        content:
          'No busques en el supermercado sin él. Usa el buscador para encontrar alimentos rápido, reorganizar tu lista y hacerte la compra más fácil y eficiente.',
        targetId: 'shopping-list-search',
      },
    ],
  },

  // ─── RECIPE VIEW ──────────────────────────────────────────────────────────────
  {
    id: 'recipe-view',
    section: 'Recetas',
    title: 'Vista de Receta',
    route: '/plan/dieta',
    icon: { name: 'ChefHat', className: 'h-6 w-6 text-amber-500' },
    steps: [
      {
        title: 'Dos vistas de receta',
        icon: { name: 'Eye', className: 'h-4 w-4 text-muted-foreground' },
        content:
          'Cada receta tiene dos modos: la Vista Rápida, perfecta para consultar y cocinar, y la Configuración, donde puedes hacer ajustes más precisos a los ingredientes.',
        targetId: 'recipe-view-mode-toggle',
      },
      {
        title: 'El multiplicador',
        icon: { name: 'Repeat2', className: 'h-4 w-4 text-foreground' },
        content:
          '¿Quieres cocinar para varios días a la vez? El multiplicador recalcula las cantidades de todos los ingredientes para las porciones que necesites. No modifica la receta original, es solo una ayuda práctica para cocinar más.',
        targetId: 'recipe-view-multiplier',
      },
      {
        title: 'Gestiona los ingredientes',
        icon: { name: 'ArrowRightLeft', className: 'h-4 w-4 text-blue-500' },
        content:
          'En el listado de ingredientes puedes ver todos los detalles nutricionales. Pulsa las flechas azules para cambiar un ingrediente por otro, o la cruz roja para eliminarlo.',
        targetId: 'recipe-view-ingredients',
      },
      {
        title: 'Añade ingredientes',
        icon: { name: 'Plus', className: 'h-4 w-4 text-primary' },
        content:
          'Pulsa el botón "+" para añadir nuevos ingredientes a la receta. El buscador inteligente te ayuda a encontrar exactamente lo que buscas.',
        targetId: 'recipe-view-add-ingredient',
      },
      {
        title: 'Autocuadre de macros',
        icon: { name: 'Bot', className: 'h-4 w-4 text-cyan-500' },
        content:
          'El botón de Autocuadre es tu aliado más potente: ajusta automáticamente las cantidades de cada ingrediente con la fórmula Bibofit para que la receta siempre cubra tus macronutrientes, sin perder flexibilidad en la dieta.',
        targetId: 'recipe-view-autobalance',
      },
      {
        title: 'Guardar cambios',
        icon: { name: 'GitBranch', className: 'h-4 w-4 text-cyan-500' },
        content:
          'Cuando modifiques una receta tienes dos opciones: crear una Nueva Variante (conservas la original y guardas la nueva) o Guardar los Cambios en esa misma versión. Ojo: las recetas originales del plan y las que ya están marcadas como comida no se pueden modificar para mantener la trazabilidad de tu registro calórico.',
        targetId: 'recipe-view-save',
      },
    ],
  },

  // ─── RECIPE EDIT MODE ─────────────────────────────────────────────────────────
  {
    id: 'recipe-edit',
    section: 'Recetas',
    title: 'Modo Configuración',
    route: '/plan/dieta',
    icon: { name: 'Settings', className: 'h-6 w-6 text-muted-foreground' },
    steps: [
      {
        title: 'Modo Configuración avanzada',
        icon: { name: 'Settings', className: 'h-4 w-4 text-muted-foreground' },
        content:
          'En este modo tienes acceso a información nutricional más precisa de cada alimento. También puedes modificar los metadatos de la receta: preparación, dificultad, estilo culinario y tiempo de elaboración.',
        targetId: 'recipe-settings-form',
      },
    ],
  },

  // ─── VARIANT TREE ─────────────────────────────────────────────────────────────
  {
    id: 'variant-tree',
    section: 'Recetas',
    title: 'Árbol de Variantes',
    route: '/profile/variantes-recetas',
    icon: { name: 'GitBranch', className: 'h-6 w-6 text-cyan-500' },
    steps: [
      {
        title: 'Recetas originales: la base de tu plan',
        icon: { name: 'Lock', className: 'h-4 w-4 text-amber-500' },
        content:
          'Tu plan de dieta parte de las recetas originales de Bibofit. Son inmutables: representan la propuesta óptima para cuidar tu salud, maximizar tus resultados y disfrutar de la comida. Nunca se modifican.',
        targetId: 'variant-tree-original',
      },
      {
        title: 'Tus variantes: total libertad',
        icon: { name: 'GitBranch', className: 'h-4 w-4 text-cyan-500' },
        content:
          'Cada variante que creas queda registrada como una nueva versión. Tienes un historial completo y puedes volver a cualquier versión anterior en cualquier momento. La potencia de Bibofit está aquí: experimenta en la cocina a tu gusto y usa el Autocuadre de macros para mantenerte siempre en la línea de tu plan.',
        targetId: 'variant-tree-list',
      },
    ],
  },

  // ─── CHAT ─────────────────────────────────────────────────────────────────────
  {
    id: 'chat',
    section: 'Comunidad',
    title: 'Centro de Comunicación',
    route: '/communication',
    icon: { name: 'MessageSquare', className: 'h-6 w-6 text-primary' },
    steps: [
      {
        title: 'IA al servicio de personas',
        icon: { name: 'Bot', className: 'h-4 w-4 text-cyan-500' },
        content:
          'Bibofit es una app inteligente desarrollada con IA, pero está diseñada para personas. Aquí puedes contactar directamente con el admin —el mismo programador y dietista que ha desarrollado la app— para resolver dudas, reportar errores o hacer sugerencias.',
        targetId: 'chat-main',
      },
      {
        title: 'Novedades y comunidad',
        icon: { name: 'Bell', className: 'h-4 w-4 text-amber-500' },
        content:
          'Mantente al tanto de las últimas actualizaciones de Bibofit en este espacio. Próximamente también podrás conectar y compartir con otros usuarios de la comunidad.',
        targetId: 'chat-news',
      },
    ],
  },

  // ─── WEIGHT HISTORY ───────────────────────────────────────────────────────────
  {
    id: 'weight-history',
    section: 'Progreso',
    title: 'Historial de Peso',
    route: '/profile/weight-history',
    icon: { name: 'Scale', className: 'h-6 w-6 text-violet-500' },
    steps: [
      {
        title: 'Tu evolución en un vistazo',
        icon: { name: 'TrendingUp', className: 'h-4 w-4 text-violet-500' },
        content:
          'Aquí puedes visualizar toda tu evolución de peso a lo largo del tiempo. Ver el progreso acumulado es uno de los mayores motivadores para seguir en el camino.',
        targetId: 'weight-history-chart',
      },
    ],
  },

  // ─── MY PLAN ──────────────────────────────────────────────────────────────────
  {
    id: 'my-plan',
    section: 'Dieta',
    title: 'Mi Plan',
    route: '/my-plan',
    icon: { name: 'CalendarCheck', className: 'h-6 w-6 text-primary' },
    steps: [
      {
        title: 'Tu Centro de Gestión de la Dieta',
        icon: { name: 'CalendarCheck', className: 'h-4 w-4 text-primary' },
        content:
          'Aquí tienes el control total sobre tu plan: modifica las Calorías Totales, ajusta el Reparto de Macronutrientes, personaliza la Distribución de Macros por momento del día, o añade Nuevas Recetas a tu menú.',
        targetId: 'my-plan-main',
      },
    ],
  },

  // ─── SNACK SELECTOR ───────────────────────────────────────────────────────────
  {
    id: 'snack-selector',
    section: 'Dieta',
    title: 'Picoteo',
    route: '/plan/dieta',
    icon: { name: 'Apple', className: 'h-6 w-6 text-orange-500' },
    steps: [
      {
        title: 'Máxima flexibilidad en tu dieta',
        icon: { name: 'Apple', className: 'h-4 w-4 text-orange-500' },
        content:
          'Los picoteos están aquí para darte libertad real. Bibofit entiende cómo actuamos las personas y no te fuerza a seguir dietas estrictas. Añade aquí todo lo que comas entre horas y lleva un registro honesto.',
        targetId: 'snack-selector-list',
      },
      {
        title: 'Equivalencia Automática',
        icon: { name: 'Bot', className: 'h-4 w-4 text-cyan-500' },
        content:
          'Después de añadir un picoteo, puedes hacer una Equivalencia Automática: Bibofit equilibra las calorías de ese picoteo reduciendo una comida futura, para que siempre te mantengas en tus calorías y logres tus objetivos sin sentirte culpable.',
        targetId: 'snack-selector-equivalence',
      },
    ],
  },

  // ─── FREE RECIPE SELECTOR ─────────────────────────────────────────────────────
  {
    id: 'free-recipe-selector',
    section: 'Recetas',
    title: 'Recetas Libres',
    route: '/plan/dieta',
    icon: { name: 'UtensilsCrossed', className: 'h-6 w-6 text-blue-500' },
    steps: [
      {
        title: 'Tus recetas favoritas, en tu plan',
        icon: { name: 'UtensilsCrossed', className: 'h-4 w-4 text-blue-500' },
        content:
          'Aquí tienes total libertad para añadir cualquiera de tus recetas favoritas. Bibofit ajusta automáticamente las cantidades para que cubran los macronutrientes de tu plan, combinando flexibilidad total con la precisión que necesitas para lograr tus objetivos.',
        targetId: 'free-recipe-selector-list',
      },
    ],
  },
];

/**
 * Returns a block config by its id.
 */
export const getGuideBlock = (blockId) =>
  GUIDE_BLOCKS.find((b) => b.id === blockId) ?? null;

/**
 * All block IDs in declaration order.
 */
export const ALL_BLOCK_IDS = GUIDE_BLOCKS.map((b) => b.id);
