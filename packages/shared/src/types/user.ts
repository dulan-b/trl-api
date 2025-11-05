/**
 * User types for The Ready Lab platform
 */

export enum UserRole {
  STUDENT = 'student',
  EDUCATOR = 'educator',
  INSTITUTION = 'institution',
  ADMIN = 'admin',
}

export enum Language {
  ENGLISH = 'en',
  SPANISH = 'es',
}

export enum SubscriptionPlan {
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  bio?: string;
  profileImageUrl?: string;
  language: Language;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentProfile {
  userId: string;
  interests: string[];
  onboardingCompleted: boolean;
  aiRoadmap?: any;
  createdAt: Date;
}

export interface EducatorProfile {
  userId: string;
  expertiseTags: string[];
  teachingStyles: string[];
  preferredContentTypes: string[];
  subscriptionPlan: SubscriptionPlan;
  stripeConnectId?: string;
  totalStudents: number;
  totalRevenue: number;
  totalCertificationsIssued: number;
  createdAt: Date;
}

export interface InstitutionProfile {
  userId: string;
  organizationName: string;
  contactTitle?: string;
  phone?: string;
  areasOfInterest: string[];
  customRequests?: string;
  isPartnered: boolean;
  accountManagerId?: string;
  createdAt: Date;
}

// Request/Response types
export interface CreateUserRequest {
  email: string;
  fullName: string;
  role: UserRole;
  bio?: string;
  language?: Language;
}

export interface UpdateUserRequest {
  fullName?: string;
  bio?: string;
  profileImageUrl?: string;
  language?: Language;
}

export interface StudentOnboardingRequest {
  interests: string[];
}

export interface EducatorOnboardingRequest {
  expertiseTags: string[];
  teachingStyles: string[];
  preferredContentTypes: string[];
  subscriptionPlan?: SubscriptionPlan;
}

export interface InstitutionOnboardingRequest {
  organizationName: string;
  contactTitle?: string;
  phone?: string;
  areasOfInterest: string[];
  customRequests?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  bio?: string;
  profileImageUrl?: string;
  language: Language;
  studentProfile?: StudentProfile;
  educatorProfile?: EducatorProfile;
  institutionProfile?: InstitutionProfile;
  createdAt: string;
  updatedAt: string;
}
