# Refactor Login/Signup (2026-03-01)

## Cambios implementados

1. Flujo de alta con espera de confirmación
- Tras `signup`, si la cuenta requiere verificación por email, el usuario se envía a `/auth/check-email`.
- Esta pantalla explica los pasos y permite reenviar el correo de confirmación.

2. Flujo de confirmación dedicado
- El enlace de confirmación ahora apunta a `/auth/confirmed`.
- Esa ruta muestra estado de cuenta confirmada y redirige automáticamente según perfil:
  - onboarding pendiente -> `/assign-diet-plan`
  - admin -> `/admin-panel/advisories`
  - coach -> `/coach-dashboard`
  - resto -> `/dashboard`

3. Corrección en login
- `login()` ahora devuelve el usuario enriquecido con perfil/rol (no solo `auth.user`).
- Se evita redirigir en render dentro de `LoginPage`; la redirección es por `useEffect`.

4. Plantilla de email renovada
- Nuevo archivo: `supabase/templates/confirm-signup.html`.
- Estética alineada con Bibofit (fondo oscuro, acento verde, botón principal claro).

## Pendiente en Supabase Dashboard (manual)

1. Auth -> URL Configuration
- Asegurar que `https://bibofit.com/auth/confirmed` está permitido en redirect URLs.

2. Auth -> Email Templates -> Confirm signup
- Pegar el contenido de `supabase/templates/confirm-signup.html`.

3. Verificar en producción
- Registro nuevo -> `/auth/check-email`
- Click en email -> `/auth/confirmed` -> redirección correcta según onboarding/rol.
