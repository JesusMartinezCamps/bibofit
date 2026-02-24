
# Análisis Estructural: modalContent en Onboarding

## 1. Estructura de Datos
El `modalContent` se define como un objeto que alimenta al componente `<OnboardingModal />`. Su estructura base es:
- `title` (String): Título principal del modal.
- `description` (String): Texto descriptivo secundario.
- `videoUrl` (String, opcional): URL para incrustar un video explicativo.
- `tips` (Array de Strings, opcional): Lista de consejos rápidos.

## 2. Componentes Involucrados
- **`OnboardingWizard`**: Actúa como controlador. Evalúa si `currentStep.showModal` es verdadero y si `modalContent` existe. Gestiona el estado de visibilidad (`isModalDismissed`).
- **`OnboardingModal`**: Componente de presentación (UI) envuelto en `AnimatePresence` de Framer Motion. Recibe las propiedades de `modalContent` y una función `onNext` para cerrarse.

## 3. Animaciones (Framer Motion)
El modal se renderiza condicionalmente dentro de un `<AnimatePresence>`, lo que permite animar su entrada y salida (montaje/desmontaje). 
- Las animaciones típicas incluyen *fade-in* (`opacity: 0` a `1`) y *slide-up* (`y: 20` a `0`).

## 4. Flujo de Estados
1. El hook `useOnboarding` provee el `currentStep`.
2. Al cambiar de paso, el `useEffect` en `OnboardingWizard` reinicia `isModalDismissed` a `false`.
3. Si el paso tiene `showModal: true` y no ha sido descartado, se muestra el `<OnboardingModal>`.
4. Al hacer clic en "Entendido" o "Siguiente" dentro del modal, se llama a `dismissModal()`, actualizando el estado local y revelando el formulario del paso.
