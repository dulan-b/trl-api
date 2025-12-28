import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// TODO: MVP - Move to environment variable before production
const JWT_SECRET = 'trl-jwt-secret-mvp-change-in-production';
const JWT_EXPIRES_IN = '7d';

interface LoginBody {
  email: string;
  password: string;
}

interface SignupBody {
  email: string;
  password: string;
  fullName: string;
  role?: 'student' | 'educator' | 'admin';
}

/**
 * Login with email and password
 */
export async function login(
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply
) {
  try {
    const { email, password } = request.body;

    if (!email?.trim() || !password) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    // Find user by email
    const [user] = await sql`
      SELECT id, email, full_name, role, password_hash, subscription_status, subscription_tier, avatar_url, created_at
      FROM profiles
      WHERE LOWER(email) = LOWER(${email.trim()})
    `;

    if (!user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Check password
    if (!user.password_hash) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Account not set up for password login. Please contact support.',
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Return user profile and token
    return reply.send({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        subscriptionStatus: user.subscription_status,
        subscriptionTier: user.subscription_tier,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
    });
  } catch (error: any) {
    request.log.error(error, 'Login failed');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Login failed',
    });
  }
}

/**
 * Signup with email and password
 */
export async function signup(
  request: FastifyRequest<{ Body: SignupBody }>,
  reply: FastifyReply
) {
  try {
    const { email, password, fullName, role = 'student' } = request.body;

    if (!email?.trim() || !password || !fullName?.trim()) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Email, password, and full name are required',
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if email already exists
    const [existing] = await sql`
      SELECT id FROM profiles WHERE LOWER(email) = LOWER(${email.trim()})
    `;

    if (existing) {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user profile
    const [user] = await sql`
      INSERT INTO profiles (email, full_name, role, password_hash, subscription_status)
      VALUES (${email.trim().toLowerCase()}, ${fullName.trim()}, ${role}, ${passwordHash}, 'trial')
      RETURNING id, email, full_name, role, subscription_status, subscription_tier, avatar_url, created_at
    `;

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    request.log.info({ userId: user.id, email: user.email }, 'User signed up');

    return reply.code(201).send({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        subscriptionStatus: user.subscription_status,
        subscriptionTier: user.subscription_tier,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
    });
  } catch (error: any) {
    request.log.error(error, 'Signup failed');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Signup failed',
    });
  }
}

/**
 * Get current user from token
 */
export async function getCurrentUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'No token provided',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };

      const [user] = await sql`
        SELECT id, email, full_name, role, subscription_status, subscription_tier, avatar_url, created_at
        FROM profiles
        WHERE id = ${decoded.userId}
      `;

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          subscriptionStatus: user.subscription_status,
          subscriptionTier: user.subscription_tier,
          avatarUrl: user.avatar_url,
          createdAt: user.created_at,
        },
      });
    } catch (jwtError) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  } catch (error: any) {
    request.log.error(error, 'Get current user failed');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to get user',
    });
  }
}

/**
 * Validate JWT token (for middleware use)
 */
export function validateToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
  } catch {
    return null;
  }
}
