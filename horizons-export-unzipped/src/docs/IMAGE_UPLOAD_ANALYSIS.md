
# Análisis de Funcionalidad: Subida de Imágenes de Recetas

## Task 1: Análisis de CreateRecipePage.jsx
1. **¿Tiene el formulario un campo de input entre nombre y dificultad?** `CreateRecipePage.jsx` delega la renderización del formulario a `RecipeFormContainer`. No renderiza los campos directamente.
2. **Estructura actual:** Es un contenedor de página que maneja el layout (vista móvil/escritorio) y renderiza `RecipeListContainer` (búsqueda/lista) y `RecipeFormContainer` (formulario).
3. **Imports/Handlers:** Maneja la selección de recetas y la finalización de acciones a través de `handleSelectRecipe` y `handleRecipeActionComplete`, pero no importa handlers específicos de imágenes directamente (lo hace el contenedor hijo).

## Task 2: Análisis de RecipeFormContainer.jsx
1. **¿Importa el hook useRecipeImageUpload?** Sí, está importado en la línea 15: `import { useRecipeImageUpload } from './hooks/useRecipeImageUpload';`.
2. **Handlers implementados:** La lógica de subida está integrada dentro del flujo `onSubmit`. Primero guarda/crea la receta para obtener el `recipeId`, y luego sube la imagen.
3. **Gestión de estado:** Usa `const [imageFile, setImageFile] = useState(null);` para gestionar la imagen seleccionada o la URL existente.
4. **Uso de RecipeImageUpload:** Sí, el componente `<RecipeImageUpload />` se está renderizando justo después del campo del Nombre de la Receta.

## Task 3: Análisis de RecipeImageUpload.jsx
1. **¿Existe el archivo?** Sí, se encuentra en `src/components/admin/recipes/RecipeImageUpload.jsx`.
2. **Implementación actual:** Renderiza un área de subida/previsualización de imágenes usando componentes de UI como `Button` y lucide-icons.
3. **Validación WebP:** Sí, la función `validateWebP` verifica explícitamente `file.type !== 'image/webp'` y que la extensión termine en `.webp`. También valida que el tamaño sea máximo 100KB.
4. **¿Sube a Storage?** Este componente solo maneja la selección y validación en cliente. La subida real se delega al hook y al contenedor superior.

## Task 4: Análisis de useRecipeImageUpload.js
1. **¿Existe el hook?** Sí, en `src/components/admin/recipes/hooks/useRecipeImageUpload.js`.
2. **Bucket destino:** Apunta explícitamente al bucket `'recipe-images'`.
3. **Manejo de errores:** Captura errores de permisos (`permission denied`, `row-level security`) y de red (`Failed to fetch`), devolviendo mensajes amigables en español.
4. **Lógica de subida:** Genera la ruta `${recipeId}/main.webp`, la sube a Supabase Storage con `upsert: true` y `contentType: 'image/webp'`, y devuelve la `publicUrl`.

## Task 5: Análisis del esquema de base de datos
1. **Columna image_url:** Sí, la tabla `recipes` tiene la columna `image_url`.
2. **Tipo de dato:** Es de tipo `text`.
3. **Constraints/Defaults:** No tiene dependencias forzadas ni valores por defecto visibles.
4. **¿Es nullable?** Sí, no tiene la restricción `NOT NULL`, por lo que las recetas pueden existir sin imagen.

## Task 6: Análisis de configuración de Supabase Storage
1. **¿Existe el bucket 'recipe-images'?** La configuración real en el dashboard depende del proyecto vivo, pero el código asume y documenta explícitamente que el bucket `recipe-images` DEBE existir.
2. **Políticas (Público/Privado):** Debe ser Público, ya que el código utiliza `getPublicUrl(filePath)` para recuperar el enlace de la imagen.
3. **Tipos permitidos:** El código sube específicamente con `contentType: 'image/webp'`, el bucket debería estar configurado idealmente para permitir `image/webp`.
4. **Límites de tamaño:** La validación de 100KB ocurre en el cliente (frontend), limitando el envío al bucket.

## Task 7: Análisis de la lógica de envío (Submit)
1. **Gestión de image_url:** `RecipeFormContainer` hace un `insert` o `update` de la receta primero. Si hay un `imageFile` (tipo `File`), invoca `uploadImage(recipeId, imageFile)`.
2. **Pasando la URL:** Si se obtiene una `publicUrl` válida de la subida, se ejecuta un segundo `update` en la tabla `recipes` aplicando el nuevo `image_url: publicUrl`.
3. **Validaciones:** Se realizan las validaciones del esquema (Zod) antes del envío, y la validación de la imagen ocurre al seleccionarla (100KB, .webp).
4. **Si falla la imagen:** El código tiene un bloque condicional que captura el `uploadError` y lanza un toast destructivo informando: "La receta se guardó, pero la imagen falló", sin romper la creación de la receta.

## Task 8: Análisis de errores o dependencias faltantes
1. **Imports del cliente:** El cliente de supabase (`import { supabase } from '@/lib/supabaseClient';`) está correctamente importado en todas las áreas requeridas.
2. **Uso de Storage API:** Se utilizan correctamente los métodos `.upload()` y `.getPublicUrl()` de `@supabase/supabase-js`.
3. **Manejo de errores faltante:** Todo está cubierto con bloques `try-catch` y un flujo gracefully degradado en la creación de recetas.
4. **Dependencias:** Todas las dependencias listadas (lucide-react, react-hook-form, framer-motion, @supabase/supabase-js) están en el `package.json`. No se aprecian dependencias faltantes para esta funcionalidad.
