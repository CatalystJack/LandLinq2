import { useState, useEffect } from 'react';
import { queryClient } from "../lib/queryClient";

// User role types matching backend (for system access control)
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  ANALYST = 'analyst',
  DEVELOPER = 'developer',
  PARTNER = 'partner',
  BROKER = 'broker',
  VIEWER = 'viewer',
  DEMO = 'demo'
}

// Business roles for profiles and team assignments
export enum BusinessRole {
  JUNIOR_ANALYST = 'junior_analyst',
  SENIOR_ANALYST = 'senior_analyst', 
  SENIOR_DEVELOPER = 'senior_developer',
  MANAGING_PARTNER = 'managing_partner'
}

// User interface type
export interface AuthUser {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  dealRole?: string;
  productTypes?: string[];
  states?: string[];
  [key: string]: any;
}

// Helper to format business roles for display
export function formatBusinessRole(role: BusinessRole | string): string {
  const roleMap: { [key: string]: string } = {
    'junior_analyst': 'Junior Analyst',
    'senior_analyst': 'Senior Analyst',
    'senior_developer': 'Senior Developer', 
    'managing_partner': 'Managing Partner'
  };
  return roleMap[role] || role;
}

// Single global state for auth to prevent multiple calls
let globalAuthState: {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  userRole: UserRole | null;
  businessRole: BusinessRole | null;
  permissions: string[];
} = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isInitialized: false,
  userRole: null,
  businessRole: null,
  permissions: []
};

const authListeners: Set<() => void> = new Set();

const notifyListeners = () => {
  authListeners.forEach(listener => listener());
};

const fetchUserOnce = async () => {
  if (globalAuthState.isInitialized) return;
  
  try {
    const response = await fetch('/api/user', { 
      credentials: 'include',
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (response.ok) {
      let user = await response.json();
      
      // Ultimate Power Override removed
      
      // Determine user role based on email and role data
      const userRole = await determineUserRole(user);
      const businessRole = await determineBusinessRole(user);
      const permissions = await getUserPermissions(userRole);
      
      globalAuthState = {
        user,
        isLoading: false,
        isAuthenticated: true,
        isInitialized: true,
        userRole,
        businessRole,
        permissions
      };
    } else {
      globalAuthState = {
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isInitialized: true,
        userRole: null,
        businessRole: null,
        permissions: []
      };
    }
  } catch (error) {
    console.error('Auth fetch error:', error);
    globalAuthState = {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isInitialized: true,
      userRole: null,
      businessRole: null,
      permissions: []
    };
  }
  notifyListeners();
};

// Helper function to determine user role
async function determineUserRole(user: any): Promise<UserRole | null> {
  if (!user?.email) return null;
  
  // Check if user has explicit role from backend
  if (user.role) {
    // Handle role format conversion from database format to frontend enum format
    const roleMapping: { [key: string]: UserRole } = {
      'SUPER_ADMIN': UserRole.SUPER_ADMIN,
      'super_admin': UserRole.SUPER_ADMIN,
      'ADMIN': UserRole.ADMIN,
      'admin': UserRole.ADMIN,
      'ANALYST': UserRole.ANALYST,
      'analyst': UserRole.ANALYST,
      'DEVELOPER': UserRole.DEVELOPER,
      'developer': UserRole.DEVELOPER,
      'PARTNER': UserRole.PARTNER,
      'partner': UserRole.PARTNER,
      'BROKER': UserRole.BROKER,
      'broker': UserRole.BROKER,
      'VIEWER': UserRole.VIEWER,
      'viewer': UserRole.VIEWER,
      'DEMO': UserRole.DEMO,
      'demo': UserRole.DEMO,
    };
    
    const mappedRole = roleMapping[user.role] || null;
    return mappedRole;
  }
  
  // Role determination based on email domain and position
  const email = user.email.toLowerCase();
  const name = user.name?.toLowerCase() || '';
  
  // Super admins - only Jack Berg
  const superAdminEmails = ['jack@catalystcp.com'];
  if (superAdminEmails.includes(email)) {
    return UserRole.SUPER_ADMIN;
  }
  
  // Team member recognition by name (case insensitive)
  const developers = ['john bell', 'steve hillebrand', 'mallie colavita'];
  const partners = ['aj klenk', 'brian ford'];
  const analysts = ['davis hammond', 'austin blondell'];
  
  if (developers.some(dev => name.includes(dev) || email.includes(dev.replace(' ', '')))) {
    return UserRole.DEVELOPER;
  }
  
  if (partners.some(partner => name.includes(partner) || email.includes(partner.replace(' ', '')))) {
    return UserRole.PARTNER;
  }
  
  if (analysts.some(analyst => name.includes(analyst) || email.includes(analyst.replace(' ', '')))) {
    return UserRole.ANALYST;
  }
  
  // All other @catalystcp.com emails are analysts by default
  if (email.endsWith('@catalystcp.com')) {
    return UserRole.ANALYST;
  }
  
  // Everyone else is a broker
  return UserRole.BROKER;
}

// Helper function to determine business role
async function determineBusinessRole(user: any): Promise<BusinessRole | null> {
  if (!user?.email) return null;
  
  // Check if user has explicit business role from backend
  if (user.business_role) {
    return user.business_role as BusinessRole;
  }
  
  // Default business role mapping based on email
  const email = user.email.toLowerCase();
  
  // Managing partners
  if (email === 'jack@catalystcp.com') {
    return BusinessRole.MANAGING_PARTNER;
  }
  
  // Default analysts to senior analyst for now
  if (email.endsWith('@catalystcp.com')) {
    return BusinessRole.SENIOR_ANALYST;
  }
  
  return null;
}

// Helper function to get user permissions based on role
async function getUserPermissions(role: UserRole | null): Promise<string[]> {
  if (!role) return [];
  
  const rolePermissions = {
    [UserRole.SUPER_ADMIN]: [
      'create_deal', 'read_deal', 'update_deal', 'delete_deal', 'analyze_deal',
      'manage_brokers', 'view_broker_analytics', 'system_admin', 'view_audit_logs',
      'manage_users', 'view_commissions', 'manage_commissions', 'access_ai_analysis',
      'configure_ai_settings'
    ],
    [UserRole.ADMIN]: [
      'create_deal', 'read_deal', 'update_deal', 'delete_deal', 'analyze_deal',
      'manage_brokers', 'view_broker_analytics', 'view_audit_logs', 'manage_users',
      'view_commissions', 'manage_commissions', 'access_ai_analysis', 'configure_ai_settings'
    ],
    [UserRole.ANALYST]: [
      'create_deal', 'read_deal', 'update_deal', 'delete_deal', 'analyze_deal',
      'view_broker_analytics', 'view_commissions', 'access_ai_analysis'
    ],
    [UserRole.DEVELOPER]: [
      'create_deal', 'read_deal', 'update_deal', 'delete_deal', 'analyze_deal',
      'view_broker_analytics', 'view_commissions', 'access_ai_analysis'
    ],
    [UserRole.PARTNER]: [
      'create_deal', 'read_deal', 'update_deal', 'delete_deal', 'analyze_deal',
      'view_broker_analytics', 'view_commissions', 'access_ai_analysis'
    ],
    [UserRole.BROKER]: [
      'create_deal', 'read_deal', 'update_deal', 'view_commissions', 'access_ai_analysis'
    ],
    [UserRole.VIEWER]: [
      'read_deal', 'view_broker_analytics'
    ]
  };
  
  return rolePermissions[role] || [];
}

export function useAuth() {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    const listener = () => forceUpdate({});
    authListeners.add(listener);
    
    // Only fetch once globally
    if (!globalAuthState.isInitialized) {
      fetchUserOnce();
    }
    
    return () => {
      authListeners.delete(listener);
    };
  }, []);

  return {
    user: globalAuthState.user,
    isLoading: globalAuthState.isLoading,
    isAuthenticated: globalAuthState.isAuthenticated,
    userRole: globalAuthState.userRole,
    businessRole: globalAuthState.businessRole,
    permissions: globalAuthState.permissions,
    hasPermission: (permission: string) => globalAuthState.permissions.includes(permission),
    isRole: (role: UserRole) => globalAuthState.userRole === role,
    isBusinessRole: (role: BusinessRole) => globalAuthState.businessRole === role,
    refetch: async () => {
      globalAuthState.isInitialized = false;
      globalAuthState.isLoading = true;
      notifyListeners();
      await fetchUserOnce();
    },
    logout: async () => {
      try {
        await fetch('/api/logout', { 
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Logout request failed:', error);
      } finally {
        // Clear global state
        globalAuthState = {
          user: null,
          isLoading: false,
          isAuthenticated: false,
          isInitialized: true,
          userRole: null,
          businessRole: null,
          permissions: []
        };
        queryClient.clear();
        notifyListeners();
        window.location.href = '/';
      }
    }
  };
}
