-- Añade constraint de validación E.164 en profiles.phone.
-- Formato E.164 (ITU-T): + seguido de 7-15 dígitos (código país + número local).
-- Ejemplos válidos: +34600000000, +12025551234, +593987654321
-- El campo es nullable (teléfono opcional en el registro).

-- Limpiar valores existentes que no cumplan E.164 (datos de prueba o formatos legacy).
-- Se ponen a NULL para no perder el constraint por datos históricos inválidos.
update public.profiles
  set phone = null
  where phone is not null
    and phone !~ '^\+[1-9]\d{6,14}$';

alter table public.profiles
  add constraint profiles_phone_e164_check
  check (
    phone is null
    or phone ~ '^\+[1-9]\d{6,14}$'
  );
