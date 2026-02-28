import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ProfileSectionCard = ({ icon: Icon, title, color, children, className }) => {
  const colors = {
    green: { border: '#5ebe7d', text: 'text-green-500' },
    red: { border: '#F44C40', text: 'text-red-entreno' },
    purple: { border: '#A855F7', text: 'text-purple-400' },
    gray: { border: '#6b7280', text: 'text-gray-400' }
  };
  const theme = colors[color] || colors.gray;

  return (
    <Card className={cn("bg-[#1a1e23] border-gray-700 text-white", className)}>
      <CardHeader>
        <CardTitle className="flex items-center text-2xl font-bold">
          {Icon && <Icon className={cn("mr-3 h-6 w-6", theme.text)} />}
          <span className="pb-1 border-b-2" style={{ borderColor: theme.border }}>
            {title}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};

export default ProfileSectionCard;