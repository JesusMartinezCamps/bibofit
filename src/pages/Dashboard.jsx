import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import SharedCalendar from '@/components/shared/SharedCalendar';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <>
      <Helmet>
        <title>Dashboard - Gsus Martz</title>
        <meta name="description" content="Tu calendario de entrenamientos y dietas." />
      </Helmet>
      <main className="w-full px-0 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="h-full"
        >
          <div className="h-full flex flex-col">
            <div className="flex-grow">
              <SharedCalendar userId={user.id} />
            </div>
          </div>
        </motion.div>
      </main>
    </>
  );
};

export default Dashboard;