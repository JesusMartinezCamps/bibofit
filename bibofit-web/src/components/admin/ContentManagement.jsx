import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeftRight,
  BookCopy,
  Bot,
  Building,
  CreditCard,
  Dna,
  Droplets,
  Dumbbell,
  Egg,
  Leaf,
  Link2,
  Search,
  ShieldAlert,
  Store,
  Utensils,
  UtensilsCrossed,
  Users,
  Wheat,
  X,
  LayoutGrid,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole, isCoachRole } from '@/lib/roles';

const normalizeText = (value = '') =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isSubsequence = (needle, haystack) => {
  if (!needle) return true;
  let needleIdx = 0;
  for (let i = 0; i < haystack.length; i += 1) {
    if (haystack[i] === needle[needleIdx]) needleIdx += 1;
    if (needleIdx === needle.length) return true;
  }
  return false;
};

const scoreToken = (token, { title, section, keywords, words, combined }) => {
  if (!token) return 0;
  if (title === token) return 12;
  if (words.some((word) => word === token)) return 10;
  if (title.startsWith(token)) return 9;
  if (words.some((word) => word.startsWith(token))) return 7;
  if (title.includes(token)) return 6;
  if (keywords.includes(token)) return 4;
  if (section.includes(token)) return 3;
  if (combined.includes(token)) return 2;
  if (isSubsequence(token, combined.replace(/\s/g, ''))) return 1;
  return Number.NEGATIVE_INFINITY;
};

const scoreItem = (item, sectionTitle, tokens, normalizedQuery) => {
  if (tokens.length === 0) return 0;

  const normalizedTitle = normalizeText(item.title);
  const normalizedSection = normalizeText(sectionTitle);
  const normalizedKeywords = normalizeText((item.keywords || []).join(' '));
  const combined = [normalizedTitle, normalizedSection, normalizedKeywords].join(' ').trim();
  const words = combined.split(' ').filter(Boolean);

  const itemIndex = {
    title: normalizedTitle,
    section: normalizedSection,
    keywords: normalizedKeywords,
    words,
    combined,
  };

  let totalScore = 0;
  for (const token of tokens) {
    const score = scoreToken(token, itemIndex);
    if (!Number.isFinite(score)) return Number.NEGATIVE_INFINITY;
    totalScore += score;
  }

  if (normalizedQuery && normalizedTitle.includes(normalizedQuery)) totalScore += 8;
  if (normalizedQuery && normalizedKeywords.includes(normalizedQuery)) totalScore += 4;
  return totalScore;
};

const ContentButton = ({ icon: Icon, title, to, hasPending, count, disabled }) => {
  const navigate = useNavigate();
  if (disabled) return null;

  return (
    <button
      onClick={() => navigate(to)}
      className="content-mgmt-btn group relative flex w-full min-h-[46px] items-center gap-3 rounded-none border-x border-b border-sky-200/85 px-3 py-2.5 text-left text-slate-800 shadow-sm transition-all duration-300 ease-out first:rounded-t-xl first:border-t last:rounded-b-xl dark:border-slate-500/45 dark:text-slate-100 dark:hover:border-slate-300/55 md:min-h-[170px] md:items-center md:justify-center md:rounded-xl md:border md:p-6 md:text-center md:shadow-lg md:hover:shadow-sky-200/40 dark:md:hover:shadow-slate-700/40"
    >
      <Icon className="h-4 w-4 text-current transition-transform group-hover:scale-110 md:mb-3 md:h-10 md:w-10" />
      <span className="flex-1 text-sm font-semibold leading-tight md:flex-none md:text-base">{title}</span>
      {hasPending && (
        <div className="absolute top-2 right-2 md:top-3 md:right-3">
          <span className="relative flex h-4 w-4 md:h-5 md:w-5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-70 dark:bg-slate-200"></span>
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[9px] font-bold text-white md:h-5 md:w-5 md:text-[10px] dark:bg-slate-200 dark:text-slate-900">
              {count > 9 ? '9+' : count}
            </span>
          </span>
        </div>
      )}
    </button>
  );
};

const ContentSection = ({ title, children }) => (
  <section className="space-y-2 md:space-y-4">
    <h2 className="text-lg font-bold text-foreground md:text-2xl">{title}</h2>
    <div className="grid grid-cols-1 gap-0 md:grid-cols-2 lg:grid-cols-3 md:gap-6">{children}</div>
  </section>
);

const ContentManagement = () => {
  const { pendingFoodCount, pendingFreeRecipeCount, pendingDietChangeCount } = useNotifications();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = isAdminRole(user?.role);
  const isCoach = isCoachRole(user?.role);

  const getLink = useCallback((path) => {
    if (isCoach && !path.startsWith('/coach')) {
      if (path.startsWith('/admin/')) return path.replace('/admin/', '/coach/');
    }
    return path;
  }, [isCoach]);

  const sections = useMemo(() => {
    const baseSections = [

      { //Organizacion
        title: 'Organización',
        visible: isAdmin,
        items: [
          {
            id: 'invitation-links',
            icon: Link2,
            title: 'Generar Link de Invitación',
            to: '/admin-panel/content/invitation-links',
            keywords: ['invitacion', 'invitar', 'enlace', 'link', 'qr', 'acceso'],
          },
          {
            id: 'users-manager',
            icon: Users,
            title: 'Gestor de Usuarios',
            to: '/admin-panel/content/users-manager',
            keywords: ['usuarios', 'roles', 'permisos', 'accounts', 'user manager'],
          },
          {
            id: 'centers',
            icon: Building,
            title: 'Gestión de Centros',
            to: '/admin-panel/content/centers',
            keywords: ['centros', 'sedes', 'ubicaciones', 'organizacion'],
          },
          {
            id: 'pricing',
            icon: CreditCard,
            title: 'Planes y Suscripciones',
            to: '/admin-panel/content/pricing',
            keywords: ['planes', 'suscripciones', 'precios', 'pricing', 'pagos'],
          },
        ],
      },
      {//Creación y Solicitudes
        title: 'Creación y Solicitudes',
        items: [
          {
            id: 'create-food',
            icon: Utensils,
            title: 'Alimentos de la App',
            to: getLink('/admin/create-food'),
            keywords: ['alimentos', 'food', 'comida', 'nutricion', 'crear'],
          },
          {
            id: 'create-recipe',
            icon: BookCopy,
            title: 'Plantillas de Recetas',
            to: getLink('/admin/create-recipe'),
            keywords: ['recetas', 'plantillas', 'cocina', 'recipe'],
          },
          {
            id: 'plan-templates',
            icon: LayoutGrid,
            title: 'Gestión Global de Plantillas de Dietas',
            to: '/admin-panel/content/plan-templates',
            visible: isAdmin || isCoach,
            keywords: ['dieta', 'dietas', 'plan', 'plantillas', 'templates'],
          },
          {
            id: 'food-requests',
            icon: Egg,
            title: 'Solicitudes de Alimentos',
            to: '/admin-panel/content/food-requests',
            visible: isAdmin,
            hasPending: pendingFoodCount > 0,
            count: pendingFoodCount,
            keywords: ['solicitudes', 'pendientes', 'alimentos', 'aprobar', 'moderacion'],
          },
          {
            id: 'free-recipe-requests',
            icon: UtensilsCrossed,
            title: 'Solicitudes de Recetas Libres',
            to: '/admin-panel/content/free-recipe-requests',
            visible: isAdmin || isCoach,
            hasPending: pendingFreeRecipeCount > 0,
            count: pendingFreeRecipeCount,
            keywords: ['solicitudes', 'recetas libres', 'free recipes', 'aprobar'],
          },
          {
            id: 'diet-requests',
            icon: Wheat,
            title: 'Solicitudes de Cambios de Recetas',
            to: '/admin-panel/content/diet-requests',
            visible: isAdmin || isCoach,
            hasPending: pendingDietChangeCount > 0,
            count: pendingDietChangeCount,
            keywords: ['solicitudes', 'cambios', 'recetas', 'diet requests'],
          },
        ],
      },
      {//Bases de Datos de Nutrientes
        title: 'Bases de Datos de Nutrientes',
        items: [
          {
            id: 'aminograms',
            icon: Dna,
            title: 'Gestionar Aminogramas',
            to: getLink('/admin/manage-aminograms'),
            keywords: ['aminogramas', 'aminoacidos', 'nutrientes', 'proteinas'],
          },
          {
            id: 'antioxidants',
            icon: Leaf,
            title: 'Gestionar Antioxidantes',
            to: getLink('/admin/manage-antioxidants'),
            keywords: ['antioxidantes', 'nutrientes', 'micros'],
          },
          {
            id: 'fat-types',
            icon: Droplets,
            title: 'Gestionar Tipos de Grasa',
            to: getLink('/admin/manage-fat-types'),
            keywords: ['grasa', 'grasas', 'lipidos', 'fat'],
          },
          {
            id: 'carb-types',
            icon: Bot,
            title: 'Gestionar Tipos de Carbohidrato',
            to: getLink('/admin/manage-carb-types'),
            keywords: ['carbohidratos', 'hidratos', 'carbs'],
          },
          {
            id: 'stores',
            icon: Store,
            title: 'Gestionar Tiendas',
            to: getLink('/admin/manage-stores'),
            visible: !isCoach,
            keywords: ['tiendas', 'supermercado', 'store', 'compras'],
          },
        ],
      },
      {//Seguridad
        title: 'Seguridad',
        visible: isAdmin,
        items: [
          {
            id: 'food-restrictions',
            icon: ShieldAlert,
            title: 'Gestor de Restricciones',
            to: '/admin-panel/content/food-restrictions',
            keywords: ['restricciones', 'seguridad', 'bloqueos', 'alergenos'],
          },
          {
            id: 'food-substitutions',
            icon: ArrowLeftRight,
            title: 'Normas de Sustitución',
            to: '/admin-panel/content/food-substitutions',
            keywords: ['sustitucion', 'reglas', 'equivalencias', 'reemplazos'],
          },
        ],
      },
      {//Entrenamiento
        title: 'Entrenamiento',
        items: [
          {
            id: 'create-exercise',
            icon: Dumbbell,
            title: 'Crear/Editar Ejercicios',
            to: getLink('/admin/create-exercise'),
            keywords: ['ejercicios', 'entrenamiento', 'gym', 'workout'],
          },
          {
            id: 'create-routine',
            icon: Activity,
            title: 'Crear/Editar Rutinas',
            to: getLink('/admin/create-routine'),
            keywords: ['rutinas', 'entrenamiento', 'plan de entrenamiento', 'training'],
          },
        ],
      },
    ];

    return baseSections
      .filter((section) => section.visible !== false)
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.visible !== false),
      }))
      .filter((section) => section.items.length > 0);
  }, [getLink, isAdmin, isCoach, pendingDietChangeCount, pendingFoodCount, pendingFreeRecipeCount]);

  const normalizedQuery = useMemo(() => normalizeText(searchQuery), [searchQuery]);
  const queryTokens = useMemo(
    () => normalizedQuery.split(' ').filter(Boolean),
    [normalizedQuery]
  );

  const filteredSections = useMemo(() => {
    if (queryTokens.length === 0) return sections;

    return sections
      .map((section) => {
        const rankedItems = section.items
          .map((item) => ({
            item,
            score: scoreItem(item, section.title, queryTokens, normalizedQuery),
          }))
          .filter(({ score }) => Number.isFinite(score))
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.item.title.localeCompare(b.item.title, 'es', { sensitivity: 'base' });
          })
          .map(({ item }) => item);

        return { ...section, items: rankedItems };
      })
      .filter((section) => section.items.length > 0);
  }, [normalizedQuery, queryTokens, sections]);

  const totalItems = useMemo(
    () => sections.reduce((acc, section) => acc + section.items.length, 0),
    [sections]
  );

  const totalResults = useMemo(
    () => filteredSections.reduce((acc, section) => acc + section.items.length, 0),
    [filteredSections]
  );

  const hasSearch = queryTokens.length > 0;

  return (
    <div className="mx-auto max-w-7xl p-2 text-foreground sm:p-3 md:p-8">
      <h1 className="mb-3 border-b border-border pb-2 text-2xl font-bold md:pb-4 md:text-4xl">
        Gestión de Contenidos
      </h1>

      <div className="mb-4 md:mb-8 space-y-2">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por contenido, acción o palabra clave..."
            className="border-border bg-background/90 pl-10 pr-10 text-foreground placeholder:text-muted-foreground dark:bg-card/80"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {hasSearch && (
          <p className="text-xs text-muted-foreground md:text-sm">
            {totalResults} resultado{totalResults === 1 ? '' : 's'} de {totalItems}
          </p>
        )}
      </div>

      {totalResults === 0 ? (
        <div className="rounded-xl border border-border bg-card/70 p-6 text-center shadow-sm dark:bg-card/80">
          <p className="font-semibold text-foreground">No se encontraron contenidos</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Prueba con términos como: usuarios, centros, recetas, entreno, invitación o pricing.
          </p>
        </div>
      ) : (
        <div className="space-y-3 md:space-y-10">
          {filteredSections.map((section) => (
            <ContentSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <ContentButton
                  key={item.id}
                  icon={item.icon}
                  title={item.title}
                  to={item.to}
                  hasPending={item.hasPending}
                  count={item.count}
                />
              ))}
            </ContentSection>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContentManagement;
