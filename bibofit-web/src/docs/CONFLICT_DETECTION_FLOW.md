
# Flujo Actual de Detección de Conflictos

## 1. Captura de restricciones en onboarding
- **DietRestrictionsStep.jsx**: Permite al usuario seleccionar condiciones médicas e intolerancias/alergias. Estos datos se guardan en las tablas `user_sensitivities` y `user_medical_conditions`.
- **DietPreferencesStep.jsx**: Permite al usuario seleccionar alimentos preferidos y no deseados. Se almacenan en `preferred_foods` y `non_preferred_foods`.

## 2. Flujo en MealAdjustmentStep (o durante asignación de plan)
- Las restricciones del usuario se obtienen globalmente a través del contexto o hooks específicos (`useAuth`, `usePlanItems`).
- Las recetas de la plantilla o plan se cargan (vía `useDietTimelineEvents` o consultas directas a `diet_plan_recipes`).
- Cada ingrediente de cada receta se evalúa contra las restricciones del usuario utilizando la función `getConflictInfo` ubicada en `src/lib/restrictionChecker.js`.

## 3. Manejo actual de conflictos
- **Detección Visual**: Los conflictos se detectan y se muestran alertas en la interfaz (ej. iconos rojos en ingredientes).
- **ConflictResolutionDialog.jsx**: Muestra un resumen de las recetas con conflictos y obliga al usuario/coach a revisarlas.
- **AdminRecipeModal.jsx**: Se abre desde el diálogo de resolución para permitir la edición manual de la receta. El usuario debe buscar un ingrediente sustituto manualmente, eliminar el conflictivo y agregar el nuevo.

## 4. Envío de datos finales
- Tras la resolución manual, el flujo continúa.
- `assignDietPlanToUser` (en `dietAssignmentService.js`) se encarga de empaquetar los datos.
- Las recetas, ahora con sus ingredientes modificados (custom_ingredients), se envían a la base de datos para crear el plan definitivo.

## 5. Puntos críticos identificados
- `restrictionChecker.js`: Es puramente detectivo. Dice "hay conflicto", pero no ofrece soluciones.
- La resolución es 100% manual, lo que ralentiza la creación de planes, especialmente cuando hay sustituciones obvias (ej. leche entera por leche sin lactosa).
- No hay un sistema de aprendizaje o base de conocimientos que mapee ingredientes equivalentes de forma estructurada.
