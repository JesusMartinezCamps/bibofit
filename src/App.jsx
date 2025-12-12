import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import LoginPage from '@/pages/LoginPage';
import SignUpPage from '@/pages/SignUpPage';
import Dashboard from '@/pages/Dashboard';
import AdminPanel from '@/pages/AdminPanel';
import ProtectedRoute from '@/components/ProtectedRoute';
import Header from '@/components/Header';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import UpdatePasswordPage from '@/pages/UpdatePasswordPage';
import ProfilePage from '@/pages/ProfilePage';
import CreateRecipePage from '@/pages/admin/CreateRecipePage';
import CreateFoodPage from '@/pages/admin/CreateFoodPage';
import CreateExercisePage from '@/pages/admin/CreateExercisePage';
import CreateRoutinePage from '@/pages/admin/CreateRoutinePage';
import ClientProfilePage from '@/pages/ClientProfilePage';
import TrainingManagementPage from '@/pages/admin/TrainingManagementPage';
import DietPlanPage from '@/pages/DietPlanPage';
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
import RemindersManagerPage from '@/pages/admin/RemindersManagerPage';
import UsersManagerPage from '@/pages/admin/UsersManagerPage';
import CentersManagementPage from '@/pages/admin/CentersManagementPage';
import Breadcrumbs from '@/components/Breadcrumbs';
import { supabase } from '@/lib/customSupabaseClient';
import PlanPage from '@/pages/PlanPage';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { RealtimeProvider } from '@/contexts/RealtimeProvider';
import GlobalShoppingListDialog from '@/components/shared/GlobalShoppingListDialog';
import ProfileDataPage from '@/pages/ProfileDataPage';
import MyFreeRecipesPage from '@/pages/MyFreeRecipesPage';
import MyFoodsPage from '@/pages/MyFoodsPage';
import CreateFreeRecipePage from '@/pages/CreateFreeRecipePage';
import CreateSnackPage from '@/pages/CreateSnackPage';
import WeightHistoryPage from '@/pages/WeightHistoryPage';
import UserDietTemplatesPage from '@/pages/UserDietTemplatesPage';

// Coach Pages
import CoachDashboard from '@/pages/CoachDashboard';
import CoachRemindersPage from '@/pages/coach/CoachRemindersPage';
import CoachContentPage from '@/pages/coach/CoachContentPage';

const HomeRedirect = () => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'admin') return <Navigate to="/admin-panel/advisories" replace />;
  if (user.role === 'coach') return <Navigate to="/coach-dashboard" replace />;

  return <Navigate to="/dashboard" replace />;
};


const RoleProtected = ({ allowedRoles, children }) => {
    const { user, loading } = useAuth();
    
    if (loading) return null;
    
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    
    if (!allowedRoles.includes(user.role)) {
         // Redirect to appropriate dashboard if unauthorized for specific route
         return <Navigate to="/" replace />;
    }
    return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route 
        path="/update-password" 
        element={
          <UpdatePasswordPage />
        } 
      />

      
      {/* Coach Routes */}
      <Route 
        path="/coach-dashboard"
        element={
            <ProtectedRoute>
                <CoachDashboard />
            </ProtectedRoute>
        }
      />
      <Route 
        path="/coach/content"
        element={
            <ProtectedRoute>
                <CoachContentPage />
            </ProtectedRoute>
        }
      />
      <Route 
        path="/coach/reminders"
        element={
            <ProtectedRoute>
                <CoachRemindersPage />
            </ProtectedRoute>
        }
      />
       <Route 
        path="/coach/create-food"
        element={
          <ProtectedRoute>
            <CreateFoodPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/coach/create-recipe"
        element={
          <ProtectedRoute>
            <CreateRecipePage />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/coach/manage-aminograms"
        element={
          <ProtectedRoute>
            <ManageAminograms />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/coach/manage-antioxidants"
        element={
          <ProtectedRoute>
            <ManageAntioxidants />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/coach/manage-fat-types"
        element={
          <ProtectedRoute>
            <ManageFatTypes />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/coach/manage-carb-types"
        element={
          <ProtectedRoute>
            <ManageCarbTypes />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/coach/manage-stores"
        element={
          <ProtectedRoute>
            <ManageStores />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/coach/create-exercise"
        element={
          <ProtectedRoute>
            <CreateExercisePage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/coach/create-routine"
        element={
          <ProtectedRoute>
            <CreateRoutinePage />
          </ProtectedRoute>
        }
      />
      {/* Catch-all for legacy coach dashboard route */}
      <Route 
        path="/coach/dashboard" 
        element={<Navigate to="/coach-dashboard" replace />} 
      />

       <Route 
        path="/planner" 
        element={
          <ProtectedRoute>
            <WeeklyPlannerPage />
          </ProtectedRoute>
        } 
      />
       <Route 
        path="/planner/:userId" 
        element={
          <ProtectedRoute>
            <WeeklyPlannerPage />
          </ProtectedRoute>
        } 
      />
        <Route 
        path="/plan" 
        element={
          <ProtectedRoute>
            <PlanPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/plan/dieta"
        element={
          <ProtectedRoute>
            <Navigate to={`/plan/dieta/${format(new Date(), 'yyyy-MM-dd')}`} replace />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/plan/dieta/:date"
        element={
          <ProtectedRoute>
            <DietPlanPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/plan/dieta/:userId/:date"
        element={
          <ProtectedRoute>
            <DietPlanPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/plan/entreno"
        element={
          <ProtectedRoute>
            <TrainingPlanPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/create-free-recipe/:date/:mealId"
        element={
          <ProtectedRoute>
            <CreateFreeRecipePage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/create-snack/:date/:mealId"
        element={
          <ProtectedRoute>
            <CreateSnackPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin-panel/:mainView?/:subView?" 
        element={
          <ProtectedRoute adminOnly>
            <AdminPanel />
          </ProtectedRoute>
        } 
      />
       
        <Route 
        path="/admin-panel/plan-detail/:planId"
        element={
          <ProtectedRoute>
            <RoleProtected allowedRoles={['admin', 'coach']}>
              <AdminDietPlanDetailPage />
            </RoleProtected>
          </ProtectedRoute>
        }
      />
      <Route 
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/profile/data"
        element={
          <ProtectedRoute>
            <ProfileDataPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/profile/my-free-recipes"
        element={
          <ProtectedRoute>
            <MyFreeRecipesPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/profile/my-foods"
        element={
          <ProtectedRoute>
            <MyFoodsPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/profile/weight-history"
        element={
          <ProtectedRoute>
            <WeightHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/diet-templates"
        element={
          <ProtectedRoute>
            <UserDietTemplatesPage />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/client-profile/:userId"
        element={
          <ProtectedRoute>
            <RoleProtected allowedRoles={['admin', 'coach']}>
                <ClientProfilePage />
            </RoleProtected>
          </ProtectedRoute>
        }
      />
       <Route 
        path="/admin/manage-diet/:userId"
        element={
          <ProtectedRoute>
             <RoleProtected allowedRoles={['admin', 'coach']}>
                <DietManagementPage />
             </RoleProtected>
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin/manage-training/:userId"
        element={
          <ProtectedRoute adminOnly>
            <TrainingManagementPage />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/admin/create-food"
        element={
          <ProtectedRoute adminOnly>
            <CreateFoodPage />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/request-food"
        element={
          <ProtectedRoute>
            <CreateFoodPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin/create-recipe"
        element={
          <ProtectedRoute adminOnly>
            <CreateRecipePage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin/create-exercise"
        element={
          <ProtectedRoute adminOnly>
            <CreateExercisePage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin/create-routine"
        element={
          <ProtectedRoute adminOnly>
            <CreateRoutinePage />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/admin/manage-stores"
        element={
          <ProtectedRoute adminOnly>
            <ManageStores />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/admin/manage-aminograms"
        element={
          <ProtectedRoute adminOnly>
            <ManageAminograms />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/admin/manage-antioxidants"
        element={
          <ProtectedRoute adminOnly>
            <ManageAntioxidants />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/admin/manage-fat-types"
        element={
          <ProtectedRoute adminOnly>
            <ManageFatTypes />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/admin/manage-carb-types"
        element={
          <ProtectedRoute adminOnly>
            <ManageCarbTypes />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin-panel/content/food-requests"
        element={
          <ProtectedRoute adminOnly>
            <UserCreatedFoodsPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin-panel/content/free-recipe-requests"
        element={
          <ProtectedRoute adminOnly>
            <FreeMealRequestsPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin-panel/content/diet-requests"
        element={
          <ProtectedRoute adminOnly>
            <DietChangeRequestsPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin-panel/content/plan-templates"
        element={
          <ProtectedRoute>
             <RoleProtected allowedRoles={['admin', 'coach']}>
                <PlanTemplatesPage />
             </RoleProtected>
          </ProtectedRoute>
        }
      />
       <Route 
        path="/admin-panel/content/food-restrictions"
        element={
          <ProtectedRoute adminOnly>
            <FoodRestrictionsPage />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/admin-panel/content/users-manager"
        element={
          <ProtectedRoute adminOnly>
            <UsersManagerPage />
          </ProtectedRoute>
        }
      />
       <Route 
        path="/admin-panel/content/centers"
        element={
          <ProtectedRoute adminOnly>
            <CentersManagementPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin-panel/reminders"
        element={
          <ProtectedRoute adminOnly>
            <RemindersManagerPage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin-panel/reminders/:userId"
        element={
          <ProtectedRoute adminOnly>
            <RemindersManagerPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

const AppContent = () => {
    const location = useLocation();
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [isShoppingListOpen, setIsShoppingListOpen] = useState(false);

    const noHeaderPaths = ['/login', '/signup', '/reset-password', '/update-password'];
    const showHeader = !noHeaderPaths.some(path => location.pathname.startsWith(path));
    
    const noMobilePaddingPaths = ['/plan/dieta', '/create-snack', '/create-free-recipe', '/admin-panel/plan-detail', '/dashboard', '/coach-dashboard', '/plan']; // Added /plan
    const shouldRemoveMobilePadding = noMobilePaddingPaths.some(path => location.pathname.startsWith(path));
    const isProfileDataPage = location.pathname === '/profile/data';


    useEffect(() => {
        const generateBreadcrumbs = async () => {
            const path = location.pathname;
            
              if (
                path.startsWith('/coach-dashboard') ||
                path.startsWith('/admin-panel/advisories') ||
                path.startsWith('/create-free-recipe') ||
                path.startsWith('/create-snack'))
              {
                setBreadcrumbs([]);
                return;
            }

            try {
                let newBreadcrumbs = [];
                
                // Coach Breadcrumbs
                if (path.startsWith('/coach/content')) {
                     newBreadcrumbs = [
                        { label: 'Dashboard', href: '/coach-dashboard' },
                        { label: 'Contenidos' }
                    ];
                } else if (path.startsWith('/coach/reminders')) {
                     newBreadcrumbs = [
                        { label: 'Dashboard', href: '/coach-dashboard' },
                        { label: 'Recordatorios' }
                    ];
                } else if (path === '/plan') { // New breadcrumb for /plan route
                    newBreadcrumbs = [
                        { label: 'Dashboard', href: '/coach-dashboard' }, // or /dashboard for client
                        { label: 'Mis Planes' }
                    ];
                }
                // Admin Breadcrumbs (existing logic)
                else if (path.startsWith('/admin-panel/content/plan-templates')) {
                    newBreadcrumbs = [
                        { label: 'Gestión de Contenido', href: '/admin-panel/content/nutrition' },
                        { label: 'Gestión de Plantillas' }
                    ];
                } else if (path.startsWith('/admin-panel/content/users-manager')) {
                    newBreadcrumbs = [
                        { label: 'Gestión de Contenido', href: '/admin-panel/content' },
                        { label: 'Gestión de Usuarios' }
                    ];
                } else if (path.startsWith('/admin-panel/content/centers')) {
                    newBreadcrumbs = [
                        { label: 'Gestión de Contenido', href: '/admin-panel/content' },
                        { label: 'Gestión de Centros' }
                    ];
                } else if (path.startsWith('/admin/manage-diet/')) {
                    const userId = path.split('/')[3];
                    if (userId) {
                        const { data } = await supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle();
                        newBreadcrumbs = [
                            { label: "Clientes", href: "/admin-panel/advisories"},
                            { label: data?.full_name || 'Cliente', href: `/client-profile/${userId}` },
                            { label: 'Gestor de Planes de dieta' }
                        ];
                    }
                } else if (path.startsWith('/admin-panel/plan-detail/')) {
                    const planId = path.split('/')[3];
                    if (planId) {
                        const { data: plan, error } = await supabase.from('diet_plans').select('name, is_template, user_id, profiles(full_name)').eq('id', planId).maybeSingle();
                        if (error) throw error;
                        if (plan) {
                            if (plan.is_template) {
                                newBreadcrumbs = [
                                    { label: 'Gestión de Contenido', href: '/admin-panel/content/nutrition' },
                                    { label: 'Gestión de Plantillas', href: '/admin-panel/content/plan-templates' },
                                    { label: plan.name }
                                ];
                            } else if (plan.user_id && plan.profiles) {
                                newBreadcrumbs = [
                                    { label: "Clientes", href: "/admin-panel/advisories"},
                                    { label: plan.profiles?.full_name || 'Cliente', href: `/client-profile/${plan.user_id}` },
                                    { label: 'Gestor de Planes de dieta', href: `/admin/manage-diet/${plan.user_id}` },
                                    { label: plan.name }
                                ];
                            }
                        }
                    }
                } else if (path === '/profile/weight-history') {
                    newBreadcrumbs = [
                        { label: 'Perfil', href: '/profile' },
                        { label: 'Historial de Peso' }
                    ];
                } else if (path === '/profile/data') {
                    newBreadcrumbs = [
                        { label: 'Perfil', href: '/profile' },
                        { label: 'Mis Datos' }
                    ];
                } else if (path === '/profile/my-free-recipes') {
                    newBreadcrumbs = [
                        { label: 'Perfil', href: '/profile' },
                        { label: 'Mis Recetas Libres' }
                    ];
                } else if (path === '/profile/diet-templates') { // New breadcrumb
                    newBreadcrumbs = [
                        { label: 'Perfil', href: '/profile' },
                        { label: 'Mis Plantillas de Dieta' }
                    ];
                }
                
                setBreadcrumbs(newBreadcrumbs);
            } catch (error) {
                console.error("Error generating breadcrumbs:", error);
                setBreadcrumbs([]);
            }
        };

        if (showHeader) {
            generateBreadcrumbs();
        }
    }, [location.pathname, showHeader]);


  return (
    <div className="min-h-screen bg-[#1a1e23] flex flex-col">
      {showHeader && <Header onShoppingListClick={() => setIsShoppingListOpen(true)} />}
      <div className={cn(
          "w-full text-white sm:px-6", 
          shouldRemoveMobilePadding && "px-0 sm:px-0",
          isProfileDataPage && "sm:px-6"
        )}>
        {showHeader && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} shouldRemovePadding={shouldRemoveMobilePadding && !isProfileDataPage} />}
        <AppRoutes />
      </div>
      <Toaster />
      {showHeader && <GlobalShoppingListDialog open={isShoppingListOpen} onOpenChange={setIsShoppingListOpen} fromHeader={true} />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <RealtimeProvider>
          <NotificationsProvider>
            <AppContent />
          </NotificationsProvider>
        </RealtimeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
