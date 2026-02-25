# Análisis de Flujo de Datos: Asignación de Dieta y Pérdida de Overrides

## 1. Resumen Ejecutivo
El análisis del flujo de datos desde el `MealAdjustmentStep` hasta la creación del plan de dieta confirma que **los cambios realizados en la resolución de conflictos (recipeOverrides) se pierden durante la comunicación con la Edge Function**.

Aunque la interfaz de usuario gestiona correctamente la eliminación/modificación de ingredientes conflictivos y estos datos llegan intactos hasta el servicio de asignación, **no se envían a la Edge Function de balanceo**. La Edge Function, al recibir solo IDs de recetas, consulta la base de datos original (recuperando los ingredientes conflictivos), realiza el cálculo sobre ellos y devuelve resultados que sobrescriben las modificaciones del usuario.

## 2. Diagrama de Flujo de Datos (Trace)

### Etapa 1: Interfaz de Usuario (`MealAdjustmentStep.jsx` y `ConflictResolutionDialog.jsx`)
- **Estado Inicial**: El usuario detecta conflictos. `ConflictResolutionDialog` permite editar recetas.
- **Acción**: `updateRecipeInState` actualiza el mapa `recipeOverrides`.
  - *Dato*: `Map<RecipeID, RecipeObject>` donde `RecipeObject` contiene `custom_ingredients` filtrados (sin el ingrediente conflictivo).
- **Confirmación**: `handleFinish` llama a `runAssignment(template, recipeOverrides)`.
- **Resultado**: ✅ Los datos salen de la capa de UI correctamente modificados.

### Etapa 2: Hook de Lógica (`useOnboardingDietAssignment.js`)
- **Función**: `assignDietFromOnboarding`.
- **Acción**: Recibe `onboardingData` que incluye `recipeOverrides`.
- **Llamada**: Ejecuta `assignDietPlanToUser(userId, planData, true, recipeOverrides)`.
- **Resultado**: ✅ Los datos pasan intactos a la capa de servicio.

### Etapa 3: Servicio de Asignación (`dietAssignmentService.js`) - **PUNTO CRÍTICO 1**
- **Función**: `assignDietPlanToUser`.
- **Paso 1**: `applyRecipeOverrides` fusiona las recetas originales con los overrides.
  - *Variable*: `fullTemplateRecipes` contiene ahora las recetas modificadas (sin ingredientes conflictivos). ✅
- **Paso 2**: `buildGroupedRecipesFromTemplateRecipes` extrae los IDs.
  - *Variable*: `groupedRecipes` se convierte en `{ mealId: [RecipeID1, RecipeID2] }`. ⚠️ **Aquí se pierde el detalle del contenido.**
- **Paso 3**: `buildMacroBalancingParams` recibe `groupedRecipes` (solo IDs).
- **Paso 4**: `callMacroBalancingEdgeFunction` se invoca con un payload que contiene solo IDs de recetas. ❌ **Los ingredientes modificados no se envían.**

### Etapa 4: Edge Function (`auto-balance-macros-dietPlans`) - (Inferencia por comportamiento)
- **Input**: Recibe `recipe_ids`.
- **Proceso**:
  1. No recibe definiciones de ingredientes en el payload.
  2. Consulta la base de datos `diet_plan_recipes` o `recipes` usando los IDs recibidos.
  3. Obtiene la receta original (que incluye el ingrediente conflictivo, e.g., "Cacahuetes").
  4. Calcula los gramos necesarios para cumplir los macros usando los ingredientes originales.
- **Output**: Devuelve una lista de ingredientes balanceados (incluyendo "Cacahuetes" con sus gramos calculados).

### Etapa 5: Creación del Plan (`dietAssignmentService.js`) - **PUNTO CRÍTICO 2**
- **Función**: `createUserDietFromTemplate`.
- **Lógica**: