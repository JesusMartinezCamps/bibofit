import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { User, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const CoachUserList = ({ selectedUser, onSelectUser, className }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const stableOnSelectUser = useCallback(onSelectUser, []);

  useEffect(() => {
    const fetchClients = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        // Fetch clients assigned to this coach
        const { data: coachClients, error: coachClientsError } = await supabase
          .from('coach_clients')
          .select('client_id')
          .eq('coach_id', currentUser.id);

        if (coachClientsError) throw coachClientsError;

        if (coachClients && coachClients.length > 0) {
          const clientIds = coachClients.map(cc => cc.client_id);

          // Fetch profiles
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', clientIds);

          if (profilesError) throw profilesError;

          // Fetch recent activity data (weight logs and meal logs) for sorting
          const [weightLogsRes, mealLogsRes] = await Promise.all([
             supabase.from('weight_logs').select('user_id, logged_on').in('user_id', clientIds).order('logged_on', { ascending: false }),
             supabase.from('daily_meal_logs').select('user_id, log_date').in('user_id', clientIds).order('log_date', { ascending: false })
          ]);

          const lastWeightMap = new Map();
          weightLogsRes.data?.forEach(log => {
             if (!lastWeightMap.has(log.user_id)) lastWeightMap.set(log.user_id, log.logged_on);
          });
          
          const lastMealMap = new Map();
          mealLogsRes.data?.forEach(log => {
             if (!lastMealMap.has(log.user_id)) lastMealMap.set(log.user_id, log.log_date);
          });

          // Sort users: Most recent activity first
          const sortedProfiles = profilesData.sort((a, b) => {
             const lastActiveA = [lastWeightMap.get(a.user_id), lastMealMap.get(a.user_id)].sort().pop() || '0000-01-01';
             const lastActiveB = [lastWeightMap.get(b.user_id), lastMealMap.get(b.user_id)].sort().pop() || '0000-01-01';
             
             // Compare dates descending (recent first)
             if (lastActiveA > lastActiveB) return -1;
             if (lastActiveA < lastActiveB) return 1;
             
             // Fallback to name if dates are equal or missing
             return a.full_name.localeCompare(b.full_name);
          });

          setUsers(sortedProfiles);

          // Auto-select first user if no user is currently selected
          if (sortedProfiles.length > 0 && !selectedUser) {
              stableOnSelectUser(sortedProfiles[0]);
          }
        } else {
          setUsers([]);
        }
      } catch (error) {
        console.error('Error fetching coach clients:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [currentUser, stableOnSelectUser, selectedUser]); // Added selectedUser to dependency if we want strict auto-select only on first load when null

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={cn("w-full bg-[#1a1e23] pt-4 px-4 pb-0 rounded-2xl flex flex-col border border-slate-800", className)}>
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <User className="w-5 h-5 text-green-400" />
        Mis Clientes
      </h3>
      <div className="relative mb-4">
        <Input
          placeholder="Buscar cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field w-full pl-9 bg-[#282d34] border-slate-700 text-white"
        />
      </div>
      {loading ? (
        <div className="text-center text-gray-400 py-4">Cargando clientes...</div>
      ) : users.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>No tienes clientes asignados.</p>
        </div>
      ) : (
        <div className="overflow-y-auto flex-grow pr-2 custom-scrollbar min-h-[100px]">
          <ul className="space-y-2 pb-4">
            {filteredUsers.map((user, index) => (
              <motion.li
                key={user.user_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <button
                  onClick={() => onSelectUser(user)}
                  className={cn(
                    "w-full text-left flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 border",
                    selectedUser?.user_id === user.user_id
                      ? 'bg-green-600/20 border-green-500/50 text-white shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                      : 'bg-slate-800/50 border-slate-700/50 text-gray-300 hover:bg-slate-800 hover:border-slate-600'
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                    selectedUser?.user_id === user.user_id ? 'bg-green-500 text-white' : 'bg-slate-700 text-gray-400'
                  )}>
                    <span className="text-xs font-bold">
                      {user.full_name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-medium truncate text-sm">{user.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CoachUserList;