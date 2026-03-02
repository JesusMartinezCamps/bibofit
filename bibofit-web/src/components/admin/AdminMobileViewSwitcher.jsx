import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const AdminMobileViewSwitcher = ({ view, setView }) => {
  return (
    <div className="md:hidden flex bg-[#2c323a] rounded-lg p-1 mb-4 border border-border gap-2">
      <Button
        onClick={() => setView('form')}
        className={cn(
          "flex-1 text-center h-full py-3 text-sm font-medium rounded-md transition-all",
          view === 'form' ? 'bg-[#983F5F] text-white shadow-lg' : 'bg-transparent text-muted-foreground'
        )}
      >
        <FileText className="w-4 h-4 mr-2" />
        Editor
      </Button>
      <Button
        onClick={() => setView('search')}
        className={cn(
          "flex-1 text-center h-full py-3 text-sm font-medium rounded-md transition-all",
          view === 'search' ? 'bg-[#983F5F] text-white shadow-lg' : 'bg-transparent text-muted-foreground'
        )}
      >
        <Search className="w-4 h-4 mr-2" />
        Buscador
      </Button>
    </div>
  );
};

export default AdminMobileViewSwitcher;