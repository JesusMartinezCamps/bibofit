-- Añade candado por ingrediente para que el autocuadre respete cantidades fijadas por el usuario.
-- DEFAULT false → ningún ingrediente existente queda bloqueado.
ALTER TABLE recipe_ingredients
  ADD COLUMN locked boolean NOT NULL DEFAULT false;