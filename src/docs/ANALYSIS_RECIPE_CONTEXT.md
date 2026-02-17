
# Análisis de Contexto: Template vs Plan Activo

Este documento detalla cómo los componentes `RecipeView` y `RecipeEditorModal` distinguen (o deberían distinguir) entre la edición de una plantilla (`isTemplate = true`) y un plan de dieta activo asignado a un usuario.

## 1. RecipeView.jsx

### Estado Actual y Análisis
*   **Indiferencia al Origen:** El componente está diseñado principalmente para la presentación. No recibe props explícitas como `planId` o `isTemplate` en su versión original, renderizándose basándose únicamente en la estructura del objeto `recipe`.
*   **Gestión de Restricciones:** Calcula conflictos basándose en `userRestrictions`.
    *   *Plan Activo:* Las restricciones provienen del perfil del usuario (`userId`).
    *   *Template:* Las restricciones son teóricas o "objetivo" (definidas en el plan), no de un usuario real.
*   **Funcionalidad "Auto-balance":** Depende de `mealTargetMacros`.
    *   *Plan Activo:* `user_day_meals` existen y tienen objetivos calculados (calorías, proteínas, etc.).
    *   *Template:* Por defecto, las plantillas no suelen tener `user_day_meals` con objetivos personalizados calculados (se usa un TDEE base), por lo que la funcionalidad de auto-cuadrado no tiene un "target" válido contra el cual operar.

### Recomendación Aplicada
*   Se ha añadido la prop `isTemplate` para deshabilitar explícitamente funcionalidades dependientes de usuarios específicos (como el auto-balanceo) y mostrar indicadores visuales.

## 2. RecipeEditorModal.jsx

### Identificación de Contexto
*   Originalmente utilizaba `isAdminView` como interruptor principal para habilitar la edición.
*   **Limitación Identificada:** `isAdminView` es `true` tanto para editar un Template como para editar el plan de un cliente desde el panel de admin. Esto causaba ambigüedad en la lógica de guardado.

### Flujo de Datos y Lógica de Guardado
El hook `useRecipeEditor` gestiona la lógica de `handleSubmit`.

#### Escenario A: Plan de Cliente (Admin View)
*   **Objetivo:** Crear una variante personalizada de la receta para este usuario específico, manteniendo la receta original intacta en la base de datos de recetas globales o privadas.
*   **Acción:** `INSERT` en la tabla `diet_plan_recipes` (función `saveDietPlanRecipe`).
*   **Resultado:** Se crea una nueva instancia de la receta vinculada a ese plan y día.

#### Escenario B: Template (Admin View)
*   **Objetivo:** Modificar la definición de la receta dentro de la estructura de la plantilla. No se desea crear "copias" o "variantes" infinitas cada vez que se guarda, sino refinar la receta existente en la plantilla.
*   **Acción (Anterior):** Realizaba un `INSERT`, creando duplicados o variantes innecesarias en la plantilla.
*   **Acción (Corregida):** `UPDATE` sobre la fila existente en `diet_plan_recipes` (función `updateDietPlanRecipeCustomization`).

## 3. Implementación de la Solución

Se han realizado los siguientes cambios para soportar esta distinción:

1.  **Propagación:** `RecipeEditorModal` ahora acepta una prop `isTemplate`.
2.  **Lógica Condicional (`useRecipeEditor.js`):**
    