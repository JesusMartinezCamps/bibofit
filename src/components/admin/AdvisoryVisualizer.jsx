import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import UserList from '@/components/admin/UserList';
import SharedCalendar from '@/components/shared/SharedCalendar';
import { Button } from '@/components/ui/button';
import { Users, User as UserIcon, Utensils, StickyNote } from 'lucide-react';
import { format } from 'date-fns';

const AdvisoryVisualizer = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const todayString = format(new Date(), 'yyyy-MM-dd');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col md:flex-row gap-6"
    >
      <div className="w-full md:w-80 flex-shrink-0">
        <UserList selectedUser={selectedUser} onSelectUser={setSelectedUser} />
      </div>
      <div className="flex-grow flex flex-col gap-4">
        <div className="flex justify-center gap-4 min-h-[40px] items-center mt-0 sm:mt-8">
          {selectedUser && (
            <>
               <Button asChild size="sm" variant="outline-diet" className="calendar-dialog-button bg-gradient-to-br from-[rgb(52_143_85_/50%)] to-emerald-300/0">
                <Link className="!text-xs sm:!text-sm" to={`/plan/dieta/${selectedUser.user_id}/${todayString}`}>
                  Plan de Dieta
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline-reminder" className="calendar-dialog-button bg-gradient-to-br from-[rgb(143_132_52_/50%)] to-emerald-300/0">
                <Link className="!text-xs sm:!text-sm" to={`/admin-panel/reminders/${selectedUser.user_id}`}>
                  Recordatorios
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline-profile" className="calendar-dialog-button bg-gradient-to-br from-[rgb(66_52_143_/50%)] to-emerald-300/0">
                <Link className="!text-xs sm:!text-sm" to={`/client-profile/${selectedUser.user_id}`}>
                  Perfil Completo
                </Link>
              </Button>
            </>
          )}
        </div>
        <div className="w-full flex-grow flex flex-col bg-[#1a1e23] rounded-2xl">
          {selectedUser ? (
            <SharedCalendar userId={selectedUser.user_id} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
              <Users className="w-16 h-16 text-gray-600 mb-4" />
              <h3 className="text-2xl font-bold text-white">Selecciona un cliente</h3>
              <p className="text-gray-400">Elige un cliente de la lista para ver sus asesorías en el calendario.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AdvisoryVisualizer;