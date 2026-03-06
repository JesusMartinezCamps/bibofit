import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import LoginPage from '@/pages/LoginPage';
import SignUpPage from '@/pages/SignUpPage';
import CheckEmailPage from '@/pages/CheckEmailPage';
import AuthConfirmedPage from '@/pages/AuthConfirmedPage';
import Dashboard from '@/pages/Dashboard';
import AdminPanel from '@/pages/AdminPanel';
import ProtectedRoute from '@/components/ProtectedRoute';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import UpdatePasswordPage from '@/pages/UpdatePasswordPage';
import ProfilePage from '@/pages/ProfilePage';
import CreateRecipePage from '@/pages/admin/CreateRecipePage';
import CreateFoodPage from '@/pages/admin/CreateFoodPage';
import CreateExercisePage from '@/pages/admin/CreateExercisePage';
import CreateRoutinePage from '@/pages/admin/CreateRoutinePage';
import ClientProfilePage from '@/pages/ClientProfilePage';
import TrainingManagementPage from '@/pages/admin/TrainingManagementPage';
import TrainingPlanPage from '@/pages/TrainingPlanPage';
import UserCreatedFoodsPage from '@/pages/admin/UserCreatedFoodsPage';
import FreeMealRequestsPage from '@/pages/admin/FreeMealRequestsPage';
import DietChangeRequestsPage from '@/pages/admin/DietChangeRequestsPage';
import AdminDietPlanDetailPage from '@/pages/admin/AdminDietPlanDetailPage';
import WeeklyPlannerPage from '@/pages/WeeklyPlannerPage';
import { useAuth } from '@/contexts/AuthContext';
import DietManagementPage from '@/pages/admin/DietManagementPage';
import ManageStores from '@/pages/admin/ManageStores';
import ManageAminograms from '@/pages/admin/ManageAminograms';
import ManageAntioxidants from '@/pages/admin/ManageAntioxidants';
import ManageFatTypes from '@/pages/admin/ManageFatTypes';
import ManageCarbTypes from '@/pages/admin/ManageCarbTypes';
import PlanTemplatesPage from '@/pages/admin/PlanTemplatesPage';
import FoodRestrictionsPage from '@/pages/admin/FoodRestrictionsPage';
import FoodSubstitutionRulesPage from '@/pages/admin/FoodSubstitutionRulesPage';
import RemindersManagerPage from '@/pages/admin/RemindersManagerPage';
import UsersManagerPage from '@/pages/admin/UsersManagerPage';
import CentersManagementPage from '@/pages/admin/CentersManagementPage';
import PricingManagementPage from '@/pages/admin/PricingManagementPage';
import PlanPage from '@/pages/PlanPage';
import { format } from 'date-fns';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { RealtimeProvider } from '@/contexts/RealtimeProvider';
import ProfileDataPage from '@/pages/ProfileDataPage';
import MyFreeRecipesPage from '@/pages/MyFreeRecipesPage';
import MyFoodsPage from '@/pages/MyFoodsPage';
import CreateFreeRecipePage from '@/pages/CreateFreeRecipePage';
import CreateSnackPage from '@/pages/CreateSnackPage';
import WeightHistoryPage from '@/pages/WeightHistoryPage';
import WeightLogPage from '@/pages/WeightLogPage';
import RepeatRecipePage from '@/pages/RepeatRecipePage';
import RecipeViewPage from '@/pages/RecipeViewPage';
import DietPlanLayout from '@/pages/DietPlanLayout';
import VariantTreePage from '@/pages/VariantTreePage';
import PricingPage from '@/pages/PricingPage';
import AssignDietPlanPage from '@/pages/AssignDietPlanPage';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';

// Refactored Pages
import ClientPlanDetailPage from '@/pages/ClientPlanDetailPage';
import HomePage from '@/pages/HomePage';
import ShoppingListPage from '@/pages/ShoppingListPage';

// Coach Pages
import CoachDashboard from '@/pages/CoachDashboard';
import CoachRemindersPage from '@/pages/coach/CoachRemindersPage';
import CoachContentPage from '@/pages/coach/CoachContentPage';

// Layouts
import PublicLayout from '@/layouts/PublicLayout';
import MinimalPublicLayout from '@/layouts/MinimalPublicLayout';
import AppLayout from '@/layouts/AppLayout';

// Providers
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { SwipeGestureProvider } from '@/contexts/SwipeGestureContext';
import { QuickStartGuideProvider } from '@/contexts/QuickStartGuideContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

const HomeRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full w-full bg-background items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/home" replace />;
  if (user.role === 'admin') return <Navigate to="/admin-panel/advisories" replace />;
  if (user.role === 'coach') return <Navigate to="/coach-dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
};

const RoleProtected = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
};

const AppRoutes = () => (
  <Routes>
    {/* Landing / marketing pages — full navbar */}
    <Route element={<PublicLayout />}>
      <Route path="/home" element={<HomePage />} />
      <Route path="/pricing" element={<PricingPage />} />
    </Route>

    {/* Auth flow pages — minimal navbar (logo + login/signup buttons only) */}
    <Route element={<MinimalPublicLayout />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/auth/check-email" element={<CheckEmailPage />} />
      <Route path="/auth/confirmed" element={<AuthConfirmedPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </Route>

    {/* Password update — no navbar (arrives via email recovery link) */}
    <Route path="/update-password" element={<UpdatePasswordPage />} />

    {/* Authenticated app — app header */}
    <Route element={<AppLayout />}>
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/assign-diet-plan" element={<ProtectedRoute><AssignDietPlanPage /></ProtectedRoute>} />
      <Route path="/shopping-list" element={<ProtectedRoute><ShoppingListPage /></ProtectedRoute>} />

      {/* Coach */}
      <Route path="/coach-dashboard" element={<ProtectedRoute><CoachDashboard /></ProtectedRoute>} />
      <Route path="/coach/content" element={<ProtectedRoute><CoachContentPage /></ProtectedRoute>} />
      <Route path="/coach/reminders" element={<ProtectedRoute><CoachRemindersPage /></ProtectedRoute>} />
      <Route path="/coach/create-food" element={<ProtectedRoute><CreateFoodPage /></ProtectedRoute>} />
      <Route path="/coach/create-recipe" element={<ProtectedRoute><CreateRecipePage /></ProtectedRoute>} />
      <Route path="/coach/manage-aminograms" element={<ProtectedRoute><ManageAminograms /></ProtectedRoute>} />
      <Route path="/coach/manage-antioxidants" element={<ProtectedRoute><ManageAntioxidants /></ProtectedRoute>} />
      <Route path="/coach/manage-fat-types" element={<ProtectedRoute><ManageFatTypes /></ProtectedRoute>} />
      <Route path="/coach/manage-carb-types" element={<ProtectedRoute><ManageCarbTypes /></ProtectedRoute>} />
      <Route path="/coach/manage-stores" element={<ProtectedRoute><ManageStores /></ProtectedRoute>} />
      <Route path="/coach/create-exercise" element={<ProtectedRoute><CreateExercisePage /></ProtectedRoute>} />
      <Route path="/coach/create-routine" element={<ProtectedRoute><CreateRoutinePage /></ProtectedRoute>} />
      <Route path="/coach/dashboard" element={<Navigate to="/coach-dashboard" replace />} />

      {/* Plan */}
      <Route path="/planner" element={<ProtectedRoute><WeeklyPlannerPage /></ProtectedRoute>} />
      <Route path="/planner/:userId" element={<ProtectedRoute><WeeklyPlannerPage /></ProtectedRoute>} />
      <Route path="/planner/ver-receta" element={<ProtectedRoute><RecipeViewPage /></ProtectedRoute>} />
      <Route path="/planner/:userId/ver-receta" element={<ProtectedRoute><RecipeViewPage /></ProtectedRoute>} />
      <Route path="/plan" element={<ProtectedRoute><PlanPage /></ProtectedRoute>} />
      <Route path="/plan/dieta" element={<ProtectedRoute><Navigate to={`/plan/dieta/${format(new Date(), 'yyyy-MM-dd')}`} replace /></ProtectedRoute>} />
      <Route path="/plan/dieta/:date" element={<ProtectedRoute><DietPlanLayout /></ProtectedRoute>}>
        <Route path="ver-receta" element={<RecipeViewPage />} />
        <Route path="repetir-receta" element={<RepeatRecipePage />} />
        <Route path="variantes-recetas" element={<VariantTreePage />} />
        <Route path="arbol-variantes" element={<Navigate to="../variantes-recetas" replace />} />
      </Route>
      <Route path="/plan/dieta/:userId/:date" element={<ProtectedRoute><DietPlanLayout /></ProtectedRoute>}>
        <Route path="ver-receta" element={<RecipeViewPage />} />
        <Route path="repetir-receta" element={<RepeatRecipePage />} />
        <Route path="variantes-recetas" element={<VariantTreePage />} />
        <Route path="arbol-variantes" element={<Navigate to="../variantes-recetas" replace />} />
      </Route>
      <Route path="/registro-peso" element={<ProtectedRoute><WeightLogPage /></ProtectedRoute>} />
      <Route path="/plan/entreno" element={<ProtectedRoute><TrainingPlanPage /></ProtectedRoute>} />
      <Route path="/create-free-recipe/:date/:mealId" element={<ProtectedRoute><CreateFreeRecipePage /></ProtectedRoute>} />
      <Route path="/create-snack/:date/:mealId" element={<ProtectedRoute><CreateSnackPage /></ProtectedRoute>} />

      {/* Admin panel */}
      <Route path="/admin-panel/:mainView?/:subView?" element={<ProtectedRoute><RoleProtected allowedRoles={['admin', 'coach']}><AdminPanel /></RoleProtected></ProtectedRoute>} />
      <Route path="/admin-panel/plan-detail/:planId" element={<ProtectedRoute><RoleProtected allowedRoles={['admin', 'coach']}><AdminDietPlanDetailPage /></RoleProtected></ProtectedRoute>} />

      {/* Profile */}
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/profile/data" element={<ProtectedRoute><ProfileDataPage /></ProtectedRoute>} />
      <Route path="/profile/my-free-recipes" element={<ProtectedRoute><MyFreeRecipesPage /></ProtectedRoute>} />
      <Route path="/profile/variantes-recetas" element={<ProtectedRoute><VariantTreePage /></ProtectedRoute>} />
      <Route path="/profile/arbol-variantes" element={<ProtectedRoute><Navigate to="/profile/variantes-recetas" replace /></ProtectedRoute>} />
      <Route path="/profile/ver-receta" element={<ProtectedRoute><RecipeViewPage /></ProtectedRoute>} />
      <Route path="/profile/my-foods" element={<ProtectedRoute><MyFoodsPage /></ProtectedRoute>} />
      <Route path="/profile/weight-history" element={<ProtectedRoute><WeightHistoryPage /></ProtectedRoute>} />
      <Route path="/my-plan" element={<ProtectedRoute><ClientPlanDetailPage /></ProtectedRoute>} />

      {/* Staff-only */}
      <Route path="/client-profile/:userId" element={<ProtectedRoute><RoleProtected allowedRoles={['admin', 'coach']}><ClientProfilePage /></RoleProtected></ProtectedRoute>} />
      <Route path="/admin/manage-diet/:userId" element={<ProtectedRoute><RoleProtected allowedRoles={['admin', 'coach']}><DietManagementPage /></RoleProtected></ProtectedRoute>} />
      <Route path="/admin/manage-training/:userId" element={<ProtectedRoute adminOnly><TrainingManagementPage /></ProtectedRoute>} />
      <Route path="/admin/create-food" element={<ProtectedRoute adminOnly><CreateFoodPage /></ProtectedRoute>} />
      <Route path="/request-food" element={<ProtectedRoute><CreateFoodPage /></ProtectedRoute>} />
      <Route path="/admin/create-recipe" element={<ProtectedRoute adminOnly><CreateRecipePage /></ProtectedRoute>} />
      <Route path="/admin/create-exercise" element={<ProtectedRoute adminOnly><CreateExercisePage /></ProtectedRoute>} />
      <Route path="/admin/create-routine" element={<ProtectedRoute adminOnly><CreateRoutinePage /></ProtectedRoute>} />
      <Route path="/admin/manage-stores" element={<ProtectedRoute adminOnly><ManageStores /></ProtectedRoute>} />
      <Route path="/admin/manage-aminograms" element={<ProtectedRoute adminOnly><ManageAminograms /></ProtectedRoute>} />
      <Route path="/admin/manage-antioxidants" element={<ProtectedRoute adminOnly><ManageAntioxidants /></ProtectedRoute>} />
      <Route path="/admin/manage-fat-types" element={<ProtectedRoute adminOnly><ManageFatTypes /></ProtectedRoute>} />
      <Route path="/admin/manage-carb-types" element={<ProtectedRoute adminOnly><ManageCarbTypes /></ProtectedRoute>} />
      <Route path="/admin-panel/content/food-requests" element={<ProtectedRoute><RoleProtected allowedRoles={['admin', 'coach']}><UserCreatedFoodsPage /></RoleProtected></ProtectedRoute>} />
      <Route path="/admin-panel/content/free-recipe-requests" element={<ProtectedRoute><RoleProtected allowedRoles={['admin', 'coach']}><FreeMealRequestsPage /></RoleProtected></ProtectedRoute>} />
      <Route path="/admin-panel/content/diet-requests" element={<ProtectedRoute><RoleProtected allowedRoles={['admin', 'coach']}><DietChangeRequestsPage /></RoleProtected></ProtectedRoute>} />
      <Route path="/admin-panel/content/plan-templates" element={<ProtectedRoute><RoleProtected allowedRoles={['admin', 'coach']}><PlanTemplatesPage /></RoleProtected></ProtectedRoute>} />
      <Route path="/admin-panel/content/food-restrictions" element={<ProtectedRoute adminOnly><FoodRestrictionsPage /></ProtectedRoute>} />
      <Route path="/admin-panel/content/food-substitutions" element={<ProtectedRoute adminOnly><FoodSubstitutionRulesPage /></ProtectedRoute>} />
      <Route path="/admin-panel/content/users-manager" element={<ProtectedRoute adminOnly><UsersManagerPage /></ProtectedRoute>} />
      <Route path="/admin-panel/content/centers" element={<ProtectedRoute adminOnly><CentersManagementPage /></ProtectedRoute>} />
      <Route path="/admin-panel/content/pricing" element={<ProtectedRoute adminOnly><PricingManagementPage /></ProtectedRoute>} />
      <Route path="/admin-panel/reminders" element={<ProtectedRoute adminOnly><RemindersManagerPage /></ProtectedRoute>} />
      <Route path="/admin-panel/reminders/:userId" element={<ProtectedRoute adminOnly><RemindersManagerPage /></ProtectedRoute>} />
    </Route>

    <Route path="*" element={<HomeRedirect />} />
  </Routes>
);

const AppContent = () => (
  <div className="w-full h-full flex flex-col relative overflow-x-hidden bg-background text-foreground">
    <AppRoutes />
    <PWAInstallPrompt />
    <Toaster />
  </div>
);

function App() {
  useEffect(() => {
    const handleLoad = async () => {
      if (!('serviceWorker' in navigator)) return;

      if (import.meta.env.DEV) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
        }

        return;
      }

      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      }).catch((err) => {
        console.error('ServiceWorker registration failed: ', err);
      });
    };

    window.addEventListener('load', handleLoad);
    return () => window.removeEventListener('load', handleLoad);
  }, []);

  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <RealtimeProvider>
            <NotificationsProvider>
              <OnboardingProvider>
                <SwipeGestureProvider>
                  <QuickStartGuideProvider>
                    <AppContent />
                  </QuickStartGuideProvider>
                </SwipeGestureProvider>
              </OnboardingProvider>
            </NotificationsProvider>
          </RealtimeProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
