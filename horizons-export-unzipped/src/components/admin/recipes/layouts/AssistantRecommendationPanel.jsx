import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles } from 'lucide-react';

const AssistantRecommendationPanel = ({
  title,
  subtitle,
  suggestions,
  onPickFood,
}) => {
  if (!suggestions?.length) return null;

  return (
    <div className="rounded-lg border border-cyan-700/60 bg-cyan-900/10 p-3 space-y-2">
      <div className="flex items-center gap-2 text-cyan-300">
        <Sparkles className="w-4 h-4" />
        <p className="font-semibold">{title}</p>
      </div>
      {subtitle ? <p className="text-xs text-slate-300">{subtitle}</p> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {suggestions.map((item) => (
          <div
            key={item.food.id}
            className="rounded-md border border-slate-700 bg-slate-900/70 p-2 flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-slate-100 truncate">{item.food.name}</p>
              <p className="text-[11px] text-slate-400 line-clamp-2">{item.reason}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-green-600 text-green-300"
              onClick={() => onPickFood(item.food)}
            >
              <Plus className="w-3 h-3 mr-1" />
              Añadir
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssistantRecommendationPanel;
