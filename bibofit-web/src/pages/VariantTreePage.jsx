import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useContextualGuide } from '@/contexts/ContextualGuideContext';
import { GUIDE_BLOCK_IDS } from '@/config/guideBlocks';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Archive, GitBranch, GitCommit, Loader2, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const formatDateTime = (value) => {
  if (!value) return null;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return null;
  return format(parsed, "d MMM yyyy '·' HH:mm", { locale: es });
};

const byCreatedAtAsc = (a, b) => {
  const aTs = Date.parse(a?.created_at || '');
  const bTs = Date.parse(b?.created_at || '');
  if (!Number.isFinite(aTs) && !Number.isFinite(bTs)) return 0;
  if (!Number.isFinite(aTs)) return 1;
  if (!Number.isFinite(bTs)) return -1;
  return aTs - bTs;
};

const getPlanNodeName = (node) => node?.custom_name || node?.recipe?.name || `Receta #${node?.id ?? 'N/A'}`;
const getVariantNodeName = (node) => node?.name || `Variante #${node?.id ?? 'N/A'}`;

const VariantTreePage = () => {
  const { user } = useAuth();
  const { triggerBlock } = useContextualGuide();

  useEffect(() => {
    triggerBlock(GUIDE_BLOCK_IDS.VARIANT_TREE);
  }, [triggerBlock]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { userId: paramUserId, date: paramDate } = useParams();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [planInfo, setPlanInfo] = useState(null);
  const [planRecipes, setPlanRecipes] = useState([]);
  const [userRecipes, setUserRecipes] = useState([]);
  const [mealLinkedVariantIds, setMealLinkedVariantIds] = useState(new Set());
  const [deletingVariantId, setDeletingVariantId] = useState(null);
  const [openingRecipeKey, setOpeningRecipeKey] = useState(null);

  const targetUserId = paramUserId || user?.id;
  const dateKey = useMemo(() => {
    const parsed = paramDate ? parseISO(paramDate) : new Date();
    return isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  }, [paramDate]);

  const isProfileMode = !paramDate;
  const backPath = useMemo(() => {
    if (isProfileMode) return '/profile';
    return paramUserId ? `/plan/dieta/${paramUserId}/${dateKey}` : `/plan/dieta/${dateKey}`;
  }, [isProfileMode, paramUserId, dateKey]);
  const recipeViewPath = useMemo(
    () => (isProfileMode ? '/profile/ver-receta' : `${backPath}/ver-receta`),
    [isProfileMode, backPath]
  );

  const loadData = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    setError(null);

    try {
      const requestedPlanId = searchParams.get('planId');

      let plan = null;
      if (requestedPlanId) {
        const { data, error: byIdError } = await supabase
          .from('diet_plans')
          .select('id, user_id, start_date, end_date')
          .eq('id', requestedPlanId)
          .maybeSingle();
        if (byIdError) throw byIdError;
        plan = data || null;
      }

      if (!plan) {
        const { data: byDateRows, error: byDateError } = await supabase
          .from('diet_plans')
          .select('id, user_id, start_date, end_date')
          .eq('user_id', targetUserId)
          .lte('start_date', dateKey)
          .gte('end_date', dateKey)
          .order('start_date', { ascending: false })
          .limit(1);
        if (byDateError) throw byDateError;
        plan = byDateRows?.[0] || null;
      }

      if (!plan) {
        const { data: activeRows, error: activeError } = await supabase
          .from('diet_plans')
          .select('id, user_id, start_date, end_date')
          .eq('user_id', targetUserId)
          .eq('is_active', true)
          .order('start_date', { ascending: false })
          .limit(1);
        if (activeError) throw activeError;
        plan = activeRows?.[0] || null;
      }

      if (!plan) {
        setPlanInfo(null);
        setPlanRecipes([]);
        setUserRecipes([]);
        setMealLinkedVariantIds(new Set());
        setLoading(false);
        return;
      }

      const [planRecipesRes, userRecipesRes, plannedMealsRes, mealLogsRes, freeOccurrencesRes] = await Promise.all([
        supabase
          .from('diet_plan_recipes')
          .select(`
            id,
            diet_plan_id,
            day_meal_id,
            parent_diet_plan_recipe_id,
            is_archived,
            archived_at,
            created_at,
            custom_name,
            recipe:recipe_id(id, name),
            day_meal:day_meal_id(name, display_order)
          `)
          .eq('diet_plan_id', plan.id),
        supabase
          .from('user_recipes')
          .select(`
            id,
            user_id,
            diet_plan_id,
            day_meal_id,
            type,
            name,
            variant_label,
            parent_user_recipe_id,
            source_diet_plan_recipe_id,
            is_archived,
            archived_at,
            created_at,
            day_meal:day_meal_id(name, display_order)
          `)
          .eq('diet_plan_id', plan.id)
          .in('type', ['private', 'variant']),
        supabase
          .from('planned_meals')
          .select('user_recipe_id')
          .eq('user_id', targetUserId)
          .not('user_recipe_id', 'is', null),
        supabase
          .from('daily_meal_logs')
          .select('user_recipe_id')
          .eq('user_id', targetUserId)
          .not('user_recipe_id', 'is', null),
        supabase
          .from('free_recipe_occurrences')
          .select('user_recipe_id')
          .eq('user_id', targetUserId)
          .not('user_recipe_id', 'is', null),
      ]);

      if (planRecipesRes.error) throw planRecipesRes.error;
      if (userRecipesRes.error) throw userRecipesRes.error;
      if (plannedMealsRes.error) throw plannedMealsRes.error;
      if (mealLogsRes.error) throw mealLogsRes.error;
      if (freeOccurrencesRes.error) throw freeOccurrencesRes.error;

      setPlanInfo(plan);
      setPlanRecipes((planRecipesRes.data || []).sort(byCreatedAtAsc));
      setUserRecipes((userRecipesRes.data || []).sort(byCreatedAtAsc));
      const linkedIds = new Set([
        ...(plannedMealsRes.data || []).map((row) => row.user_recipe_id).filter(Boolean),
        ...(mealLogsRes.data || []).map((row) => row.user_recipe_id).filter(Boolean),
        ...(freeOccurrencesRes.data || []).map((row) => row.user_recipe_id).filter(Boolean),
      ]);
      setMealLinkedVariantIds(linkedIds);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el árbol de variantes.');
    } finally {
      setLoading(false);
    }
    }, [dateKey, isProfileMode, searchParams, targetUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const planById = useMemo(() => new Map(planRecipes.map((node) => [node.id, node])), [planRecipes]);
  const userById = useMemo(() => new Map(userRecipes.map((node) => [node.id, node])), [userRecipes]);

  const planChildrenMap = useMemo(() => {
    const map = new Map();
    planRecipes.forEach((node) => {
      const key = node.parent_diet_plan_recipe_id || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(node);
    });
    map.forEach((nodes) => nodes.sort(byCreatedAtAsc));
    return map;
  }, [planRecipes]);

  const userChildrenMap = useMemo(() => {
    const map = new Map();
    userRecipes.forEach((node) => {
      const key = node.parent_user_recipe_id || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(node);
    });
    map.forEach((nodes) => nodes.sort(byCreatedAtAsc));
    return map;
  }, [userRecipes]);

  const rootPlanNodes = useMemo(() => {
    return planRecipes
      .filter((node) => !node.parent_diet_plan_recipe_id || !planById.has(node.parent_diet_plan_recipe_id))
      .sort((a, b) => {
        const aOrder = a?.day_meal?.display_order ?? 999;
        const bOrder = b?.day_meal?.display_order ?? 999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return byCreatedAtAsc(a, b);
      });
  }, [planById, planRecipes]);

  const userRootsBySourceMap = useMemo(() => {
    const map = new Map();
    userRecipes.forEach((node) => {
      const isRoot = !node.parent_user_recipe_id || !userById.has(node.parent_user_recipe_id);
      if (!isRoot) return;
      if (!node.source_diet_plan_recipe_id) return;
      if (!map.has(node.source_diet_plan_recipe_id)) map.set(node.source_diet_plan_recipe_id, []);
      map.get(node.source_diet_plan_recipe_id).push(node);
    });
    map.forEach((nodes) => nodes.sort(byCreatedAtAsc));
    return map;
  }, [userById, userRecipes]);

  const unlinkedVariantRoots = useMemo(() => {
    return userRecipes
      .filter((node) => {
        const isRoot = !node.parent_user_recipe_id || !userById.has(node.parent_user_recipe_id);
        return isRoot && !node.source_diet_plan_recipe_id;
      })
      .sort(byCreatedAtAsc);
  }, [userById, userRecipes]);

  const hasVariantsInPlanBranch = useCallback((planNodeId) => {
    if ((userRootsBySourceMap.get(planNodeId) || []).length > 0) return true;
    const childNodes = planChildrenMap.get(planNodeId) || [];
    return childNodes.some((child) => hasVariantsInPlanBranch(child.id));
  }, [planChildrenMap, userRootsBySourceMap]);

  const visibleRootPlanNodes = useMemo(() => {
    return rootPlanNodes.filter((node) => hasVariantsInPlanBranch(node.id));
  }, [hasVariantsInPlanBranch, rootPlanNodes]);

  const stats = useMemo(() => {
    const archivedPlan = planRecipes.filter((node) => node.is_archived).length;
    const archivedVariants = userRecipes.filter((node) => node.is_archived).length;
    return {
      planNodes: planRecipes.length,
      variantNodes: userRecipes.length,
      archivedNodes: archivedPlan + archivedVariants,
    };
  }, [planRecipes, userRecipes]);

  const getSiblingVariants = useCallback((node) => {
    if (!node) return [];

    if (node.parent_user_recipe_id) {
      return (userChildrenMap.get(node.parent_user_recipe_id) || [])
        .filter((candidate) => candidate.type === 'variant' && !candidate.is_archived)
        .sort(byCreatedAtAsc);
    }

    if (node.source_diet_plan_recipe_id) {
      return (userRootsBySourceMap.get(node.source_diet_plan_recipe_id) || [])
        .filter((candidate) => candidate.type === 'variant' && !candidate.is_archived)
        .sort(byCreatedAtAsc);
    }

    return userRecipes
      .filter((candidate) =>
        candidate.type === 'variant' &&
        !candidate.is_archived &&
        !candidate.parent_user_recipe_id &&
        !candidate.source_diet_plan_recipe_id
      )
      .sort(byCreatedAtAsc);
  }, [userChildrenMap, userRecipes, userRootsBySourceMap]);

  const canDeleteVariantNode = useCallback((node) => {
    if (!node || node.type !== 'variant' || node.is_archived) return false;

    const isOwnerOrAdmin = user?.role === 'admin' || user?.id === node.user_id;
    if (!isOwnerOrAdmin) return false;

    if (mealLinkedVariantIds.has(node.id)) return false;

    const hasActiveChildren = (userChildrenMap.get(node.id) || []).some((child) => !child.is_archived);
    if (hasActiveChildren) return false;

    const siblings = getSiblingVariants(node);
    const latestSibling = siblings[siblings.length - 1];

    return Boolean(latestSibling && latestSibling.id === node.id);
  }, [getSiblingVariants, mealLinkedVariantIds, user, userChildrenMap]);

  const handleDeleteVariant = useCallback(async (node) => {
    if (!canDeleteVariantNode(node) || deletingVariantId) return;

    setDeletingVariantId(node.id);
    try {
      const { error: deleteError } = await supabase.rpc('delete_user_recipe_variant_if_unused', { p_recipe_id: node.id });
      if (deleteError) throw deleteError;

      setUserRecipes((prev) => prev.filter((candidate) => candidate.id !== node.id));
      setMealLinkedVariantIds((prev) => {
        const next = new Set(prev);
        next.delete(node.id);
        return next;
      });

      toast({ title: 'Variante eliminada', variant: 'success' });
    } catch (err) {
      toast({
        title: 'No se pudo eliminar',
        description: err.message || 'La variante no cumple las condiciones de eliminación.',
        variant: 'destructive',
      });
    } finally {
      setDeletingVariantId(null);
    }
  }, [canDeleteVariantNode, deletingVariantId, toast]);

  const handleOpenRecipeNode = useCallback(async (nodeType, node) => {
    if (!node?.id || openingRecipeKey) return;

    const key = `${nodeType}-${node.id}`;
    setOpeningRecipeKey(key);

    try {
      let recipePayload = null;

      if (nodeType === 'plan') {
        const { data, error: planError } = await supabase
          .from('diet_plan_recipes')
          .select(`
            *,
            recipe:recipe_id(*, template_ingredients:recipe_ingredients(*)),
            custom_ingredients:recipe_ingredients(*),
            day_meal:day_meal_id(id, name, display_order)
          `)
          .eq('id', node.id)
          .maybeSingle();

        if (planError) throw planError;
        if (!data) throw new Error('No se pudo cargar la receta del plan.');

        recipePayload = {
          ...data,
          type: 'recipe',
          is_private: false,
          dnd_id: `recipe-${data.id}`,
        };
      } else {
        const { data, error: userError } = await supabase
          .from('user_recipes')
          .select(`
            *,
            recipe_ingredients(*),
            day_meal:day_meal_id(id, name, display_order)
          `)
          .eq('id', node.id)
          .maybeSingle();

        if (userError) throw userError;
        if (!data) throw new Error('No se pudo cargar la variante.');

        recipePayload = {
          ...data,
          user_recipe_type: data.type,
          type: 'private_recipe',
          is_private: true,
          is_private_recipe: true,
          dnd_id: `private-${data.id}`,
        };
      }

      const isAdminView = user?.id !== targetUserId;
      sessionStorage.setItem('recipe_view_data', JSON.stringify({
        recipe: recipePayload,
        userId: targetUserId,
        isAdminView,
        adjustments: null,
        returnTo: `${window.location.pathname}${window.location.search || ''}`,
      }));

      navigate(recipeViewPath);
    } catch (err) {
      toast({
        title: 'No se pudo abrir la receta',
        description: err.message || 'Error cargando datos de la receta.',
        variant: 'destructive',
      });
    } finally {
      setOpeningRecipeKey(null);
    }
  }, [navigate, openingRecipeKey, recipeViewPath, targetUserId, toast, user?.id]);

  const renderVariantNode = useCallback((node, depth = 0) => {
    const children = userChildrenMap.get(node.id) || [];
    const canDelete = canDeleteVariantNode(node);
    const isDeleting = deletingVariantId === node.id;
    const isOpening = openingRecipeKey === `variant-${node.id}`;

    return (
      <div
        key={`variant-${node.id}`}
        className={cn('space-y-2', depth > 0 && 'ml-4 border-l border-cyan-300/40 dark:border-cyan-500/30 pl-4')}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleOpenRecipeNode('variant', node)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleOpenRecipeNode('variant', node);
            }
          }}
          className={cn(
            "rounded-xl border border-cyan-300/45 dark:border-cyan-500/35 bg-gradient-to-r from-cyan-500/30 via-cyan-400/30 to-cyan-300/30 dark:from-cyan-500/8 dark:via-cyan-500/5 dark:to-transparent p-3 transition-colors",
            "cursor-pointer hover:from-cyan-500/40 hover:via-cyan-400/40 hover:to-cyan-300/40 dark:hover:bg-cyan-500/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45 dark:focus-visible:ring-cyan-500/50",
            isOpening && "opacity-80"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <Badge className="border border-cyan-300/55 dark:border-cyan-500/45 bg-cyan-100/80 dark:bg-cyan-500/15 text-cyan-900 dark:text-cyan-200">
                  <GitBranch className="mr-1 h-3 w-3" />
                  Variante
                </Badge>
                {node.is_archived && (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-200">
                    <Archive className="mr-1 h-3 w-3" />
                    Archivada
                  </Badge>
                )}
              </div>
              <p className="truncate text-sm font-semibold text-foreground">{getVariantNodeName(node)}</p>
              {node.variant_label && (
                <p className="mt-1 text-xs text-cyan-800 dark:text-cyan-200/90">{node.variant_label}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canDelete && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteVariant(node);
                  }}
                  disabled={isDeleting}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-600/60 bg-red-500/15 text-red-700 transition-colors hover:bg-red-500/30 hover:text-red-800 dark:border-red-500/55 dark:text-red-200 dark:hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Eliminar variante"
                >
                  {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                </button>
              )}
              {isOpening && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-700 dark:text-cyan-200" />}
              <span className="text-[11px] text-muted-foreground">#{node.id}</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {node.day_meal?.name ? <span>{node.day_meal.name}</span> : null}
            {formatDateTime(node.created_at) ? <span>{formatDateTime(node.created_at)}</span> : null}
          </div>
        </div>

        {children.length > 0 && (
          <div className="space-y-2">
            {children.map((child) => renderVariantNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [canDeleteVariantNode, deletingVariantId, handleDeleteVariant, handleOpenRecipeNode, openingRecipeKey, userChildrenMap]);

  const renderPlanNode = useCallback((node, depth = 0) => {
    const childVersions = (planChildrenMap.get(node.id) || []).filter((child) => hasVariantsInPlanBranch(child.id));
    const linkedVariants = userRootsBySourceMap.get(node.id) || [];
    const createdLabel = formatDateTime(node.created_at);
    const archivedLabel = formatDateTime(node.archived_at);
    const isOpening = openingRecipeKey === `plan-${node.id}`;

    return (
      <div
        key={`plan-${node.id}`}
        className={cn('space-y-3', depth > 0 && 'ml-5 border-l border-amber-300/45 dark:border-amber-500/30 pl-4')}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleOpenRecipeNode('plan', node)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleOpenRecipeNode('plan', node);
            }
          }}
          className={cn(
            'rounded-2xl border p-4 transition-colors cursor-pointer hover:from-amber-500/40 hover:via-amber-400/40 hover:to-amber-300/40 dark:hover:bg-amber-500/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/45 dark:focus-visible:ring-amber-500/45',
            node.is_archived
              ? 'border-orange-300/50 dark:border-orange-500/40 bg-gradient-to-r from-orange-500/30 via-orange-400/30 to-orange-300/30 dark:from-orange-500/10 dark:via-orange-500/6 dark:to-transparent'
              : 'border-amber-300/50 dark:border-amber-500/40 bg-gradient-to-r from-amber-500/30 via-amber-400/30 to-amber-300/30 dark:from-amber-500/14 dark:via-amber-500/8 dark:to-transparent',
            isOpening && 'opacity-80'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <Badge className="border border-amber-300/55 dark:border-amber-500/50 bg-orange-600/30 dark:bg-amber-500/18 text-amber-900 dark:text-amber-200">
                  <GitCommit className="mr-1 h-3 w-3" />
                  Original
                </Badge>
                {node.is_archived && (
                  <Badge variant="outline" className="border-orange-500/55 text-orange-900 dark:text-orange-200">
                    <Archive className="mr-1 h-3 w-3" />
                    Archivada
                  </Badge>
                )}
                {node.day_meal?.name && (
                  <Badge variant="secondary" className="bg-card/70">{node.day_meal.name}</Badge>
                )}
              </div>
              <p className="truncate text-base font-semibold text-foreground">{getPlanNodeName(node)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {isOpening ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700 dark:text-amber-200" /> : null}
                <span>#{node.id}</span>
                {createdLabel ? <span>{createdLabel}</span> : null}
                {archivedLabel ? <span>Archivada: {archivedLabel}</span> : null}
              </div>
            </div>
          </div>
        </div>

        {linkedVariants.length > 0 && (
          <div className="rounded-xl border border-cyan-300/40 dark:border-cyan-500/30 bg-gradient-to-r from-cyan-100/85 via-cyan-50/85 to-white/85 dark:from-cyan-500/10 dark:via-cyan-500/8 dark:to-transparent p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-200">
              Variantes vinculadas ({linkedVariants.length})
            </p>
            <div className="space-y-2">
              {linkedVariants.map((variantNode) => renderVariantNode(variantNode))}
            </div>
          </div>
        )}

        {childVersions.length > 0 && (
          <div className="space-y-3">
            {childVersions.map((childNode) => renderPlanNode(childNode, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [handleOpenRecipeNode, hasVariantsInPlanBranch, openingRecipeKey, planChildrenMap, renderVariantNode, userRootsBySourceMap]);

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute top-24 -right-20 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl space-y-5 px-3 py-4 sm:px-6">
        <Card className="border-border/70 bg-white/65 bg-gradient-to-br from-emerald-100/35 via-cyan-100/30 to-amber-100/25 dark:bg-none dark:bg-card/85 backdrop-blur-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(backPath)}
                className="shrink-0 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">{isProfileMode ? 'Volver al perfil' : 'Volver al plan'}</span>
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  Árbol de variantes
                </CardTitle>
                <CardDescription>
                  Relación entre recetas base del plan, sus versiones y variantes personales.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Recetas del plan: {stats.planNodes}</Badge>
              <Badge variant="secondary">Recetas variante: {stats.variantNodes}</Badge>
              <Badge variant="secondary">Archivados: {stats.archivedNodes}</Badge>
            </div>
          </CardHeader>
        </Card>

        {loading && (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        )}

        {!loading && error && (
            <Card className="border-red-500/35 bg-red-100/45 bg-gradient-to-r from-red-300/40 via-red-200/30 to-red-100/24 dark:from-red-500/20 dark:via-red-500/12 dark:to-transparent">
            <CardContent className="py-6 text-sm text-red-800 dark:text-red-200">{error}</CardContent>
          </Card>
        )}

        {!loading && !error && !planInfo && (
            <Card className="border-amber-500/35 bg-amber-100/45 bg-gradient-to-r from-amber-300/40 via-amber-200/30 to-amber-100/24 dark:from-amber-500/20 dark:via-amber-500/12 dark:to-transparent">
            <CardContent className="py-6 text-sm text-amber-900 dark:text-amber-100">
              {isProfileMode
                ? 'No se encontró un plan de dieta activo para mostrar el árbol de variantes.'
                : 'No se encontró un plan de dieta para mostrar el árbol en esta fecha.'}
            </CardContent>
          </Card>
        )}

        {!loading && !error && planInfo && (
          <div className="space-y-5">
            {visibleRootPlanNodes.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {visibleRootPlanNodes.map((rootNode) => (
                  <Card key={`root-${rootNode.id}`} className="border-border/70 bg-gradient-to-br from-white/85 via-cyan-50/85 to-emerald-50/85 dark:bg-none dark:bg-card/80">
                    <CardContent className="space-y-3 p-4">
                      {renderPlanNode(rootNode)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !isProfileMode ? (
              <Card className="border-border/70 bg-gradient-to-br from-white/85 via-cyan-50/85 to-emerald-50/85 dark:bg-none dark:bg-card/80">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Este plan no tiene recetas base con variantes vinculadas.
                </CardContent>
              </Card>
            ) : null}

            {isProfileMode && visibleRootPlanNodes.length === 0 && unlinkedVariantRoots.length === 0 && (
              <Card className="border-border/70 bg-gradient-to-br from-white/85 via-cyan-50/85 to-emerald-50/85 dark:bg-none dark:bg-card/80">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Aún no tienes variantes de recetas creadas.
                </CardContent>
              </Card>
            )}

            {unlinkedVariantRoots.length > 0 && (
              <Card className="border-cyan-300/40 dark:border-cyan-500/30 bg-gradient-to-r from-cyan-100/85 via-cyan-50/85 to-white/85 dark:from-cyan-500/10 dark:via-cyan-500/8 dark:to-transparent">
                <CardHeader>
                  <CardTitle className="text-base">Variantes sin nodo fuente</CardTitle>
                  <CardDescription>
                    Variantes antiguas o migradas sin Receta fuente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {unlinkedVariantRoots.map((node) => renderVariantNode(node))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VariantTreePage;
