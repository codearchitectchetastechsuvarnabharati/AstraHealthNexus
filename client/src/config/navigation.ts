// Navigation Configuration - Centralized menu structure
// This configuration is used by the layout and navigation components

export type NavigationRole = 'viewer' | 'analyst' | 'researcher' | 'operations' | 'admin';

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  requiresAuth?: boolean;
  allowedRoles?: NavigationRole[];
  children?: NavigationItem[];
}

export interface NavigationSection {
  title?: string;
  items: NavigationItem[];
}

export const navigationConfig: NavigationSection[] = [
  {
    items: [
      {
        id: 'home',
        label: 'Home',
        href: '/',
        icon: '🏠',
        requiresAuth: false,
      },
    ],
  },
  {
    title: 'Platform',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: '📊',
        requiresAuth: true,
        allowedRoles: ['viewer', 'analyst', 'researcher', 'operations', 'admin'],
      },
      {
        id: 'mission-ops',
        label: 'Mission Ops',
        href: '/mission-ops',
        icon: '🚀',
        requiresAuth: true,
        allowedRoles: ['operations', 'admin'],
      },
      {
        id: 'datasets',
        label: 'Datasets',
        href: '/datasets',
        icon: '📁',
        requiresAuth: true,
        allowedRoles: ['analyst', 'researcher', 'admin'],
      },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      {
        id: 'research',
        label: 'Research',
        href: '/research',
        icon: '📚',
        requiresAuth: false,
      },
      {
        id: 'awards',
        label: 'Awards',
        href: '/awards',
        icon: '🏆',
        requiresAuth: false,
      },
    ],
  },
  {
    title: 'About',
    items: [
      {
        id: 'problem',
        label: 'Problem',
        href: '/problem',
        icon: '❓',
        requiresAuth: false,
      },
      {
        id: 'solution',
        label: 'Solution',
        href: '/solution',
        icon: '💡',
        requiresAuth: false,
      },
      {
        id: 'team',
        label: 'Team',
        href: '/team',
        icon: '👥',
        requiresAuth: false,
      },
      {
        id: 'contact',
        label: 'Contact',
        href: '/contact',
        icon: '📧',
        requiresAuth: false,
      },
    ],
  },
];

// Helper function to get nav items based on auth status and role
export function getVisibleNavigation(
  isAuthenticated: boolean,
  userRole?: NavigationRole
): NavigationSection[] {
  return navigationConfig
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // If requires auth and not authenticated, hide it
        if (item.requiresAuth && !isAuthenticated) {
          return false;
        }
        // If has allowed roles and user role not in list, hide it
        if (item.allowedRoles && !item.allowedRoles.includes(userRole || 'viewer')) {
          return false;
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}
