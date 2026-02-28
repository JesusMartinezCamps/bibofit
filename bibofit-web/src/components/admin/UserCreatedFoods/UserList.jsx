import React, { useState } from 'react';
import { User, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const UserList = ({ users, loading, selectedUser, onSelectUser, activeTab }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <Card className="bg-[#1a1e23] border-gray-700 text-white">
        <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2" /> Clientes con Solicitudes
            </CardTitle>
            <CardDescription>
                {loading ? 'Cargando clientes...' : 'Selecciona un cliente para ver sus solicitudes.'}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Input
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field w-full mb-4 bg-[#282d34]"
            />
            {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-[#5ebe7d]" /></div>
            ) : (
                 <div className="overflow-y-auto max-h-[60vh] styled-scrollbar-green pr-2">
                    <ul className="mt-2 space-y-2">
                        {filteredUsers.map((user, index) => (
                        <motion.li
                            key={user.user_id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <button
                            onClick={() => onSelectUser(user, activeTab)}
                            className={`w-full text-left flex items-center justify-between space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                                selectedUser?.user_id === user.user_id
                                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg'
                                : 'bg-slate-800/60 hover:bg-slate-700/80'
                            }`}
                            >
                            <span className="font-medium truncate">{user.full_name}</span>
                            {user.pending_count > 0 && 
                                <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                    {user.pending_count}
                                </span>
                            }
                            </button>
                        </motion.li>
                        ))}
                    </ul>
                </div>
            )}
        </CardContent>
    </Card>
  );
};

export default UserList;