import React from 'react';
    import ContentManagement from '@/components/admin/ContentManagement';
    import AdvisoryVisualizer from '@/components/admin/AdvisoryVisualizer';
    import { useParams } from 'react-router-dom';
    import RemindersManagerPage from './admin/RemindersManagerPage';
    
    const AdminPanel = () => {
      const { mainView = 'advisories' } = useParams();
    
      return (
        <>
          <main className="w-full px-0">
            <div className="w-full">
              {mainView === 'content' && <ContentManagement />}
              {mainView === 'advisories' && <AdvisoryVisualizer />}
              {mainView === 'reminders' && <RemindersManagerPage />}
            </div>
          </main>
        </>
      );
    };
    
    export default AdminPanel;