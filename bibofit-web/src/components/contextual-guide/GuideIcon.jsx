import React from 'react';
import {
  Eye,
  Scale,
  GitBranch,
  Bot,
  ScanSearch,
  Lock,
  ShoppingCart,
  ArrowRightLeft,
  X,
  Plus,
  Search,
  Calendar,
  CalendarCheck,
  Apple,
  ChefHat,
  UtensilsCrossed,
  MessageSquare,
  Settings,
  BarChart3,
  Bell,
  TrendingUp,
  SlidersHorizontal,
  LayoutList,
  Repeat2,
  User,
  BookOpen,
} from 'lucide-react';
import AppIcon from '@/components/icons/AppIcon';

/**
 * Icon registry for guide descriptors.
 * Add new icons here when new guide blocks reference them.
 */
const ICON_MAP = {
  AppIcon,
  Eye,
  Scale,
  GitBranch,
  Bot,
  ScanSearch,
  Lock,
  ShoppingCart,
  ArrowRightLeft,
  X,
  Plus,
  Search,
  Calendar,
  CalendarCheck,
  Apple,
  ChefHat,
  UtensilsCrossed,
  MessageSquare,
  Settings,
  BarChart3,
  Bell,
  TrendingUp,
  SlidersHorizontal,
  LayoutList,
  Repeat2,
  User,
  BookOpen,
};

/**
 * GuideIcon — renders a guide icon descriptor.
 *
 * Accepts:
 *   - string → rendered as emoji span
 *   - { name: string, className: string } → resolved from ICON_MAP
 */
const GuideIcon = ({ icon, fallback = null }) => {
  if (!icon) return fallback;

  if (typeof icon === 'string') {
    return <span className="leading-none" aria-hidden="true">{icon}</span>;
  }

  const Component = ICON_MAP[icon.name];
  if (!Component) return fallback;

  return <Component className={icon.className} aria-hidden="true" />;
};

export default GuideIcon;
