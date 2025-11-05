/**
 * Course and lesson types for The Ready Lab platform
 */

export enum CourseType {
  MICROLEARNING = 'microlearning',
  DEEP_LEARNING = 'deep_learning',
  DIGITAL_PRODUCT = 'digital_product',
}

export enum LessonType {
  VIDEO = 'video',
  QUIZ = 'quiz',
  READING = 'reading',
  LIVE = 'live',
  ASSIGNMENT = 'assignment',
}

export interface Course {
  id: string;
  educatorId: string;
  title: string;
  description?: string;
  courseType: CourseType;
  teachingStyle: string[];
  language: string;
  price: number;
  isFree: boolean;
  isPublished: boolean;
  publishedAt?: Date;
  thumbnailUrl?: string;
  previewVideoId?: string;
  totalEnrollments: number;
  totalCompletions: number;
  averageRating: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  lessonType: LessonType;
  videoAssetId?: string;
  contentMarkdown?: string;
  liveStreamId?: string;
  orderIndex: number;
  duration?: number;
  isFreePreview: boolean;
  requiresCompletionOf?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: Date;
  completedAt?: Date;
  progressPercentage: number;
  lastAccessedLessonId?: string;
  lastAccessedAt?: Date;
}

export interface LessonProgress {
  id: string;
  enrollmentId: string;
  lessonId: string;
  completed: boolean;
  completedAt?: Date;
  timeSpent: number;
  lastPosition: number;
  createdAt: Date;
}

export interface Quiz {
  id: string;
  lessonId: string;
  passingScore: number;
  maxAttempts: number;
  questions: QuizQuestion[];
  createdAt: Date;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  enrollmentId: string;
  score: number;
  passed: boolean;
  answers: any;
  attemptNumber: number;
  createdAt: Date;
}

// Request/Response types
export interface CreateCourseRequest {
  title: string;
  description?: string;
  courseType: CourseType;
  teachingStyle?: string[];
  language?: string;
  price?: number;
  isFree?: boolean;
  thumbnailUrl?: string;
}

export interface UpdateCourseRequest {
  title?: string;
  description?: string;
  courseType?: CourseType;
  teachingStyle?: string[];
  language?: string;
  price?: number;
  isFree?: boolean;
  thumbnailUrl?: string;
}

export interface CreateLessonRequest {
  title: string;
  description?: string;
  lessonType: LessonType;
  videoAssetId?: string;
  contentMarkdown?: string;
  orderIndex: number;
  duration?: number;
  isFreePreview?: boolean;
}

export interface UpdateLessonRequest {
  title?: string;
  description?: string;
  videoAssetId?: string;
  contentMarkdown?: string;
  orderIndex?: number;
  duration?: number;
  isFreePreview?: boolean;
}

export interface EnrollmentRequest {
  courseId: string;
  studentId: string;
}

export interface CompletelessonRequest {
  lessonId: string;
  timeSpent?: number;
  lastPosition?: number;
}

export interface SubmitQuizRequest {
  answers: Record<number, number>; // question index -> answer index
}

export interface CourseResponse {
  id: string;
  educator: {
    id: string;
    fullName: string;
    profileImageUrl?: string;
  };
  title: string;
  description?: string;
  courseType: CourseType;
  teachingStyle: string[];
  language: string;
  price: number;
  isFree: boolean;
  isPublished: boolean;
  publishedAt?: string;
  thumbnailUrl?: string;
  previewVideoId?: string;
  totalEnrollments: number;
  totalCompletions: number;
  averageRating: number;
  totalReviews: number;
  tags: string[];
  lessons?: LessonResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface LessonResponse {
  id: string;
  title: string;
  description?: string;
  lessonType: LessonType;
  orderIndex: number;
  duration?: number;
  isFreePreview: boolean;
  isLocked: boolean; // based on requiresCompletionOf
  videoUrl?: string; // if video lesson
  createdAt: string;
}

export interface EnrollmentResponse {
  id: string;
  course: CourseResponse;
  enrolledAt: string;
  completedAt?: string;
  progressPercentage: number;
  lastAccessedLesson?: {
    id: string;
    title: string;
  };
  lastAccessedAt?: string;
}

export interface QuizResultResponse {
  attemptId: string;
  score: number;
  passed: boolean;
  attemptNumber: number;
  remainingAttempts: number;
  correctAnswers: number;
  totalQuestions: number;
  createdAt: string;
}
