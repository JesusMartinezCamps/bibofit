
# Guía de Implementación: Resolución de Conflictos Asistida

## Resumen Ejecutivo
El proceso actual de asignación de dietas se bloquea frecuentemente en la resolución manual de conflictos por intolerancias o preferencias (ej. alergia a la lactosa). Esta implementación introduce un sistema de mapeo de sustituciones (`food_substitution_mappings`) que automatiza reemplazos seguros o los sugiere al profesional, reduciendo drásticamente el tiempo de intervención manual.

## Pasos de Implementación Realizados

1. **Estructura de Base de Datos**:
   - Se creó la tabla `food_substitution_mappings` mediante un bloque SQL.
   - Se añadieron índices para optimizar las consultas y políticas RLS (Admins escriben, otros leen).

2. **Lógica de Back-end (Edge Function)**:
   - Se implementó `get-substitutions-for-food` para recuperar sustituciones ordenadas por nivel de confianza (`confidence_score`).

3. **Lógica de Front-end (Core)**:
   - Se actualizó `src/lib/restrictionChecker.js` añadiendo `getConflictWithSubstitutions()`. Esta función no solo detecta el conflicto, sino que busca sustitutos seguros evaluando las restricciones del usuario contra los candidatos.

4. **Estado y Manejo UI**:
   - Se creó el hook `useConflictResolution.js` que categoriza los conflictos en tres cubos: Automáticos, Pendientes de Confirmación, y Manuales.
   - Se diseñó el componente visual `ConflictSummary.jsx` para mostrar progreso.
   - Se implementó la vista `MealAdjustmentStep.jsx` que consume el hook y presenta las opciones al usuario de forma estructurada.

## Poblando Datos de Ejemplo (Siguiente paso sugerido)
Para que el sistema funcione, los administradores deben cargar mapeos. Ejemplos SQL:

