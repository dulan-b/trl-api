/**
 * Authentication types - Currently stubbed for future implementation
 */

import { UserRole } from './user.js';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface AuthContext {
  userId?: string;
  userRole?: UserRole;
  isAuthenticated: boolean;
}
