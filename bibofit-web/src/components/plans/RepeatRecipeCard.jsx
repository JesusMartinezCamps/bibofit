import React from 'react';
import { Calendar, FileText, ThumbsUp, AlertTriangle, Utensils, Hourglass, Clock, BarChart3, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RecipeCardBackground, RecipeCardPanel } from '@/components/shared/recipe-card/RecipeCardBase';
import { useTheme } from '@/contexts/ThemeContext';
import HighlightedText from '@/components/shared/HighlightedText';
import { FREE_RECIPE_STATUS, normalizeFreeRecipeStatus } from '@/lib/recipeEntity';

/**
 * Tarjeta de receta para RepeatFreeRecipeDialog.
 * Soporta recetas libres y plantillas, con imagen de fondo si está disponible.
 *
 * Props:
 *   recipe          — objeto de receta (free o template)
 *   isTemplate      — boolean
 *   lastUsed        — string formateado ("hace 3 días"), solo recetas libres
 *   greenCount      — número de ingredientes recomendados
 *   redCount        — número de ingredientes a evitar
 *   ingredientDisplay — JSX pre-renderizado con ingredientes coloreados
 *   searchQuery     — string para highlight del nombre
 *   onSelect        — fn(recipe) al hacer click
 *   onDelete        — fn(e, recipe) para el botón de eliminar; omitir en plantillas
 */
const RepeatRecipeCard = ({
  recipe,
  isTemplate,
  lastUsed,
  greenCount = 0,
  redCount = 0,
  ingredientDisplay,
  searchQuery = '',
  onSelect,
  onDelete,
}) => {
  const { isDark } = useTheme();
  const isPending = normalizeFreeRecipeStatus(recipe.status) === FREE_RECIPE_STATUS.PENDING;
  const imageUrl = recipe.img_url || recipe.image_url || null;

  const bgStyle = imageUrl
    ? { backgroundImage: `url(${imageUrl})` }
    : isDark
      ? isTemplate
        ? { background: 'linear-gradient(135deg, rgba(88,28,135,0.35) 0%, rgba(15,23,42,0.65) 45%, rgba(59,7,100,0.75) 100%)' }
        : { background: 'linear-gradient(135deg, rgba(12,74,110,0.35) 0%, rgba(15,23,42,0.65) 45%, rgba(8,47,73,0.75) 100%)' }
      : isTemplate
        ? { background: 'linear-gradient(135deg, rgba(245,243,255,0.96) 0%, rgba(233,213,255,0.92) 45%, rgba(216,180,254,0.9) 100%)' }
        : { background: 'linear-gradient(135deg, rgba(240,249,255,0.96) 0%, rgba(224,242,254,0.92) 45%, rgba(186,230,253,0.9) 100%)' };

  const overlayClass = imageUrl
    ? (isDark ? 'bg-black/50' : 'bg-white/30')
    : null;

  return (
    <RecipeCardBackground
      className={cn(
        'relative group w-full rounded-xl overflow-hidden shadow-lg border transition-all',
        isTemplate
          ? 'border-purple-500/40 hover:border-purple-400/60 hover:shadow-purple-500/10'
          : 'border-border/50 hover:border-sky-500/50 hover:shadow-sky-500/10'
      )}
      backgroundStyle={bgStyle}
      overlayClassName={overlayClass}
    >
      <button
        onClick={() => onSelect(recipe)}
        className="w-full h-full text-left p-4 flex flex-col gap-3"
      >
        <RecipeCardPanel className="p-3 space-y-3">
          {/* Fila superior: meta izquierda + badges derecha */}
          <div className="flex justify-between items-start w-full pr-6">
            <div className="flex flex-col gap-1">
              {lastUsed && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3 mr-1.5" />
                  {lastUsed}
                </div>
              )}
              {isTemplate && (
                <div className="flex items-center text-xs text-purple-400">
                  <FileText className="w-3 h-3 mr-1.5" />
                  Plantilla
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pl-2">
              {isPending && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-medium whitespace-nowrap bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/50">
                  Pendiente
                </span>
              )}
              {greenCount > 0 && (
                <span className="flex items-center text-xs text-green-400 gap-0.5" title={`${greenCount} alimentos recomendados`}>
                  <ThumbsUp className="w-3 h-3" /> {greenCount}
                </span>
              )}
              {redCount > 0 && (
                <span className="flex items-center text-xs text-red-400 gap-0.5" title={`${redCount} alimentos a evitar`}>
                  <AlertTriangle className="w-3 h-3" /> {redCount}
                </span>
              )}
            </div>
          </div>

          {/* Nombre */}
          <div className="flex items-center gap-3">
            {isPending ? (
              <Hourglass className="h-5 w-5 text-sky-400 flex-shrink-0" />
            ) : (
              <Utensils className={cn('h-5 w-5 flex-shrink-0', isTemplate ? 'text-purple-400' : 'text-sky-400')} />
            )}
            <p className="font-semibold text-lg text-foreground">
              <HighlightedText
                text={recipe.name}
                highlight={searchQuery}
                className="text-yellow-400 font-bold bg-yellow-400/10 rounded-[2px] px-0.5"
              />
            </p>
          </div>

          {/* Tiempo y dificultad */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {recipe.difficulty && (
              <span className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" /> {recipe.difficulty}
              </span>
            )}
            {recipe.prep_time_min && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {recipe.prep_time_min} min
              </span>
            )}
          </div>
        </RecipeCardPanel>

        {/* Ingredientes */}
        <RecipeCardPanel className="px-3 py-2 text-xs w-full">
          <p className="line-clamp-3 leading-relaxed">
            {ingredientDisplay}
          </p>
        </RecipeCardPanel>
      </button>

      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(e, recipe); }}
          className="absolute top-2 right-2 bg-red-500/70 text-white rounded-full p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-red-500 z-20 backdrop-blur-sm"
          title="Eliminar receta permanentemente"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </RecipeCardBackground>
  );
};

export default RepeatRecipeCard;
