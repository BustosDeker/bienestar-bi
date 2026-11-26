import type { LucideIcon } from 'lucide-react';
import { BrainCircuit, Compass, FileSpreadsheet, HeartPulse, LayoutDashboard, Settings2, Sparkles, Workflow } from 'lucide-react';

export const NAV = [
  { to: '/', key: 'overview', icon: LayoutDashboard },
  { to: '/reportes', key: 'reports', icon: FileSpreadsheet },
  { to: '/explorador', key: 'explorer', icon: Compass },
  { to: '/drivers', key: 'drivers', icon: BrainCircuit },
  { to: '/mi-bienestar', key: 'student', icon: HeartPulse },
  { to: '/coach', key: 'coach', icon: Sparkles },
  { to: '/etl', key: 'etl', icon: Workflow },
  { to: '/ajustes', key: 'settings', icon: Settings2, hidden: true },
] as readonly { to: string; key: string; icon: LucideIcon; hidden?: boolean }[];
