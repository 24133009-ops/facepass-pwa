import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'blue' | 'emerald' | 'violet' | 'amber';
  suffix?: string;
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-gradient-to-br from-blue-500 to-blue-600',
    text: 'text-blue-700',
  },
  emerald: {
    bg: 'bg-emerald-50',
    icon: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    text: 'text-emerald-700',
  },
  violet: {
    bg: 'bg-violet-50',
    icon: 'bg-gradient-to-br from-violet-500 to-violet-600',
    text: 'text-violet-700',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'bg-gradient-to-br from-amber-500 to-amber-600',
    text: 'text-amber-700',
  },
};

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, suffix }) => {
  const c = colorMap[color];

  return (
    <div className={`${c.bg} rounded-2xl p-4 border border-slate-100`}>
      <div className={`w-10 h-10 ${c.icon} rounded-xl flex items-center justify-center text-white shadow-md mb-3`}>
        {icon}
      </div>
      <div className="stat-number text-slate-900">
        {value}
        {suffix && <span className="text-lg font-semibold ml-0.5">{suffix}</span>}
      </div>
      <p className={`text-xs font-medium ${c.text} mt-0.5`}>{label}</p>
    </div>
  );
};
