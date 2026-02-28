import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { User, UserCog } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// Define role colors
const ROLE_COLORS = {
  coach: 'rgb(155, 68, 130)', // #9B4482
  client: 'rgb(60, 134, 126)', // #3C867E
};

const UserList = ({ selectedUser, onSelectUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'coach', 'client'
  const navigate = useNavigate();

  const stableOnSelectUser = useCallback(onSelectUser, []);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        // 1. Fetch Profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*');

        if (profilesError) throw profilesError;

        // 2. Fetch Roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, roles(role)');

        if (rolesError) throw rolesError;

        // 3. Fetch Coach-Client relationships
        const { data: coachClientsData, error: coachClientsError } = await supabase
          .from('coach_clients')
          .select('client_id, coach:coach_id(full_name)');
        
        if (coachClientsError) throw coachClientsError;

        // Create Maps for O(1) access
        const rolesMap = new Map(rolesData.map(r => [r.user_id, r.roles.role]));
        const coachMap = new Map(coachClientsData.map(r => [r.client_id, r.coach?.full_name]));
        
        const formattedUsers = profilesData
          .map(p => ({
            ...p,
            role: rolesMap.get(p.user_id) || 'client',
            assignedCoach: coachMap.get(p.user_id)
          }))
          .filter(u => u.role !== 'admin');
        
        // Sort alphabetically by name
        formattedUsers.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

        setUsers(formattedUsers);
        
        // Auto-select first if none selected
        // Only runs on initial load, not on re-renders, because stableOnSelectUser dependency is stable
        if (formattedUsers.length > 0 && !selectedUser) {
           stableOnSelectUser(formattedUsers[0]);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
    // Removed selectedUser from dependency array to prevent re-fetching on user selection
  }, [stableOnSelectUser]);

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleTagClick = (e, user) => {
    e.stopPropagation();
    navigate(`/admin-panel/content/users-manager?search=${encodeURIComponent(user.full_name)}`);
  };

  return (
    <div className="w-full md:w-80 flex-shrink-0 bg-[#1a1e23] pt-4 px-4 pb-4 rounded-2xl flex flex-col h-full border border-gray-800">
      <h3 className="text-xl font-bold text-white mb-4">Listado de Usuarios</h3>
      
      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <Button 
           variant={roleFilter === 'all' ? 'default' : 'outline'}
           size="sm"
           onClick={() => setRoleFilter('all')}
           className={cn(
               "flex-1 text-xs h-7 px-0", 
               roleFilter === 'all' 
                ? "bg-gray-600 hover:bg-gray-500 text-white border-transparent" 
                : "border-gray-600 text-gray-400 hover:text-white bg-transparent hover:bg-gray-800"
           )}
        >
          Todos
        </Button>
        <Button 
           variant={roleFilter === 'coach' ? 'default' : 'outline'}
           size="sm"
           onClick={() => setRoleFilter('coach')}
           className={cn(
             "flex-1 text-xs h-7 px-0", 
             roleFilter === 'coach' 
                ? "bg-[rgb(155,68,130)] hover:bg-[rgb(155,68,130)]/90 text-white border-transparent" 
                : "border-gray-600 text-gray-400 hover:text-[rgb(155,68,130)] bg-transparent hover:bg-[rgb(155,68,130)]/10"
           )}
        >
          Coach
        </Button>
        <Button 
           variant={roleFilter === 'client' ? 'default' : 'outline'}
           size="sm"
           onClick={() => setRoleFilter('client')}
           className={cn(
             "flex-1 text-xs h-7 px-0", 
             roleFilter === 'client' 
                ? "bg-[rgb(60,134,126)] hover:bg-[rgb(60,134,126)]/90 text-white border-transparent" 
                : "border-gray-600 text-gray-400 hover:text-[rgb(60,134,126)] bg-transparent hover:bg-[rgb(60,134,126)]/10"
           )}
        >
          Cliente
        </Button>
      </div>

      <div className="relative mb-4">
        <Input
          placeholder="Buscar usuario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field w-full pl-9 bg-[#282d34] border-gray-700 focus:border-green-500/50 transition-colors"
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-4">Cargando...</div>
      ) : (
        <div className="overflow-y-auto flex-grow pr-1 custom-scrollbar">
          <ul className="space-y-2">
            <AnimatePresence mode="popLayout">
            {filteredUsers.map((user, index) => {
              const isSelected = selectedUser?.user_id === user.user_id;
              const roleColor = user.role === 'coach' ? ROLE_COLORS.coach : ROLE_COLORS.client;
              
              return (
                <motion.li
                  key={user.user_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
                >
                  <button
                    onClick={() => onSelectUser(user)}
                    className={cn(
                      "w-full text-left flex flex-col p-3 rounded-lg transition-all duration-200 border relative overflow-hidden group",
                      isSelected 
                        ? "text-white border-transparent shadow-md" 
                        : "hover:bg-gray-800/80 border-transparent hover:border-gray-700 text-gray-300 bg-[#22262c]"
                    )}
                    style={{
                      backgroundColor: isSelected ? roleColor : undefined
                    }}
                  >
                    <div className="flex items-center justify-between w-full z-10">
                       <div className="flex items-center gap-3 overflow-hidden">
                          <div className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                            isSelected ? "bg-white/20" : "bg-gray-700 group-hover:bg-gray-600"
                          )}>
                            {user.role === 'coach' ? (
                               <UserCog className="w-5 h-5" />
                            ) : (
                               <User className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                             <span className="font-medium truncate text-sm leading-tight">{user.full_name}</span>
                             {user.role === 'client' && user.assignedCoach && (
                                <span className={cn("text-[11px] truncate mt-0.5", isSelected ? "text-white/80" : "text-gray-500")}>
                                  Coach: {user.assignedCoach}
                                </span>
                             )}
                          </div>
                       </div>
                       
                       <Badge 
                         variant="outline" 
                         onClick={(e) => handleTagClick(e, user)}
                         className={cn(
                           "ml-2 text-[10px] h-5 px-1.5 uppercase tracking-wider border-0 font-semibold cursor-pointer hover:scale-105 transition-transform",
                           isSelected 
                             ? "bg-white/20 text-white hover:bg-white/30" 
                             : user.role === 'coach' 
                                ? "bg-[rgb(155,68,130)]/10 text-[rgb(155,68,130)] border border-[rgb(155,68,130)]/20 hover:bg-[rgb(155,68,130)]/20" 
                                : "bg-[rgb(60,134,126)]/10 text-[rgb(60,134,126)] border border-[rgb(60,134,126)]/20 hover:bg-[rgb(60,134,126)]/20"
                         )}
                         title="Ver en gestión de usuarios"
                       >
                         {user.role === 'coach' ? 'Coach' : 'Cliente'}
                       </Badge>
                    </div>
                  </button>
                </motion.li>
              );
            })}
            </AnimatePresence>
            {filteredUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm">
                   <p>No se encontraron usuarios</p>
                </div>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserList;