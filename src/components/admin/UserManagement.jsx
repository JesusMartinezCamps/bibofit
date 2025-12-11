import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Users, Plus, Edit, Trash2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, created_at');

        if (profilesError) throw profilesError;

        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, roles(role)');

        if (rolesError) throw rolesError;
        
        const rolesMap = new Map(rolesData.map(r => [r.user_id, r.roles.role]));

        const formattedUsers = profilesData.map(p => ({
          id: p.user_id,
          name: p.full_name,
          email: 'No disponible',
          role: rolesMap.get(p.user_id) || 'client',
          joinDate: p.created_at,
          status: 'active',
          lastLogin: new Date().toISOString()
        }));

        setUsers(formattedUsers);
      } catch (error) {
        toast({ title: "Error", description: "No se pudieron cargar los usuarios.", variant: "destructive" });
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [toast]);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addUser = () => {
    toast({
      title: "Agregar usuario",
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀"
    });
  };

  const editUser = (userId) => {
    toast({
      title: "Editar usuario",
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀"
    });
  };

  const deleteUser = (userId) => {
    toast({
      title: "Eliminar usuario",
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀"
    });
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col md:flex-row md:items-center justify-between"
      >
        <div className="flex items-center space-x-3 mb-4 md:mb-0">
          <Users className="w-8 h-8 text-[#5ebe7d]" />
          <h2 className="text-3xl font-bold text-white">Gestión de Usuarios</h2>
        </div>
        <Button onClick={addUser} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Agregar Usuario
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="glass-effect rounded-2xl p-6"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar usuarios por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field w-full pl-10"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="glass-effect rounded-2xl p-6"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Usuario</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Rol</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Estado</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" className="text-center py-8 text-gray-400">Cargando usuarios...</td></tr>
              ) : filteredUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="border-b border-gray-800 hover:bg-[#1a1e23] transition-colors duration-200"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-[#5ebe7d] rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {user.name?.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{user.name}</p>
                        <p className="text-gray-400 text-sm">
                          Desde {new Date(user.joinDate).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-purple-500 bg-opacity-20 text-purple-300'
                        : 'bg-blue-500 bg-opacity-20 text-blue-300'
                    }`}>
                      {user.role === 'admin' ? 'Administrador' : 'Cliente'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.status === 'active' 
                        ? 'bg-green-500 bg-opacity-20 text-green-300'
                        : 'bg-red-500 bg-opacity-20 text-red-300'
                    }`}>
                      {user.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => editUser(user.id)}
                        size="sm"
                        variant="ghost"
                        className="text-gray-400 hover:text-white"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => deleteUser(user.id)}
                        size="sm"
                        variant="ghost"
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredUsers.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No se encontraron usuarios</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default UserManagement;