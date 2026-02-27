export const INGREDIENT_LAYOUTS = {
  HEALTH: 'health',
  MACROS: 'macros',
  LIST: 'list',
};

export const LAYOUT_OPTIONS = [
  {
    id: INGREDIENT_LAYOUTS.HEALTH,
    name: 'Salud',
    description: 'Prioriza vitaminas, minerales y variedad de grupos de alimentos.',
  },
  {
    id: INGREDIENT_LAYOUTS.MACROS,
    name: 'Macros',
    description: 'Cuadra proteínas, carbohidratos y grasas con fuentes limpias.',
  },
  {
    id: INGREDIENT_LAYOUTS.LIST,
    name: 'Lista',
    description: 'Vista tipo settings para edición rápida ingrediente a ingrediente.',
  },
];
