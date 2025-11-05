import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';
import {
  UserRole,
  type CreateUserRequest,
  type UpdateUserRequest,
  type UserResponse,
} from '@trl/shared';

/**
 * Create a new user
 */
export async function createUser(
  request: FastifyRequest<{
    Body: CreateUserRequest;
  }>,
  reply: FastifyReply
) {
  const { email, fullName, role, bio, language = 'en' } = request.body;

  try {
    // Create user profile
    const [user] = await sql`
      INSERT INTO user_profiles (
        email,
        full_name,
        role,
        bio,
        language
      )
      VALUES (
        ${email},
        ${fullName},
        ${role},
        ${bio || null},
        ${language}
      )
      RETURNING *
    `;

    // Create role-specific profile
    if (role === UserRole.STUDENT) {
      await sql`
        INSERT INTO student_profiles (user_id, interests, onboarding_completed)
        VALUES (${user.id}, ARRAY[]::TEXT[], FALSE)
      `;
    } else if (role === UserRole.EDUCATOR) {
      await sql`
        INSERT INTO educator_profiles (
          user_id,
          expertise_tags,
          teaching_styles,
          preferred_content_types,
          subscription_plan
        )
        VALUES (
          ${user.id},
          ARRAY[]::TEXT[],
          ARRAY[]::TEXT[],
          ARRAY[]::TEXT[],
          'basic'
        )
      `;
    } else if (role === UserRole.INSTITUTION) {
      await sql`
        INSERT INTO institution_profiles (
          user_id,
          organization_name,
          is_partnered
        )
        VALUES (
          ${user.id},
          ${fullName},
          FALSE
        )
      `;
    }

    request.log.info({ userId: user.id, role }, 'User created');

    const response: UserResponse = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      bio: user.bio,
      profileImageUrl: user.profile_image_url,
      language: user.language,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    return reply.code(201).send(response);
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      return reply.code(409).send({
        error: 'Conflict',
        message: 'User with this email already exists',
      });
    }
    request.log.error(error, 'Failed to create user');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create user',
    });
  }
}

/**
 * Get user by ID with role-specific profile
 */
export async function getUserById(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const [user] = await sql`
      SELECT * FROM user_profiles WHERE id = ${id}
    `;

    if (!user) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    const response: UserResponse = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      bio: user.bio,
      profileImageUrl: user.profile_image_url,
      language: user.language,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    // Get role-specific profile
    if (user.role === UserRole.STUDENT) {
      const [studentProfile] = await sql`
        SELECT * FROM student_profiles WHERE user_id = ${id}
      `;
      if (studentProfile) {
        response.studentProfile = {
          userId: studentProfile.user_id,
          interests: studentProfile.interests,
          onboardingCompleted: studentProfile.onboarding_completed,
          aiRoadmap: studentProfile.ai_roadmap,
          createdAt: studentProfile.created_at,
        };
      }
    } else if (user.role === UserRole.EDUCATOR) {
      const [educatorProfile] = await sql`
        SELECT * FROM educator_profiles WHERE user_id = ${id}
      `;
      if (educatorProfile) {
        response.educatorProfile = {
          userId: educatorProfile.user_id,
          expertiseTags: educatorProfile.expertise_tags,
          teachingStyles: educatorProfile.teaching_styles,
          preferredContentTypes: educatorProfile.preferred_content_types,
          subscriptionPlan: educatorProfile.subscription_plan,
          stripeConnectId: educatorProfile.stripe_connect_id,
          totalStudents: educatorProfile.total_students,
          totalRevenue: parseFloat(educatorProfile.total_revenue),
          totalCertificationsIssued: educatorProfile.total_certifications_issued,
          createdAt: educatorProfile.created_at,
        };
      }
    } else if (user.role === UserRole.INSTITUTION) {
      const [institutionProfile] = await sql`
        SELECT * FROM institution_profiles WHERE user_id = ${id}
      `;
      if (institutionProfile) {
        response.institutionProfile = {
          userId: institutionProfile.user_id,
          organizationName: institutionProfile.organization_name,
          contactTitle: institutionProfile.contact_title,
          phone: institutionProfile.phone,
          areasOfInterest: institutionProfile.areas_of_interest,
          customRequests: institutionProfile.custom_requests,
          isPartnered: institutionProfile.is_partnered,
          accountManagerId: institutionProfile.account_manager_id,
          createdAt: institutionProfile.created_at,
        };
      }
    }

    return reply.send(response);
  } catch (error) {
    request.log.error(error, 'Failed to get user');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve user',
    });
  }
}

/**
 * Update user profile
 */
export async function updateUser(
  request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateUserRequest;
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const { fullName, bio, profileImageUrl, language } = request.body;

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (fullName !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(fullName);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramIndex++}`);
      values.push(bio);
    }
    if (profileImageUrl !== undefined) {
      updates.push(`profile_image_url = $${paramIndex++}`);
      values.push(profileImageUrl);
    }
    if (language !== undefined) {
      updates.push(`language = $${paramIndex++}`);
      values.push(language);
    }

    if (updates.length === 0) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'No fields to update',
      });
    }

    values.push(id);

    const [user] = await sql`
      UPDATE user_profiles
      SET ${sql.unsafe(updates.join(', '))}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!user) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    request.log.info({ userId: id }, 'User updated');

    const response: UserResponse = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      bio: user.bio,
      profileImageUrl: user.profile_image_url,
      language: user.language,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    return reply.send(response);
  } catch (error) {
    request.log.error(error, 'Failed to update user');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to update user',
    });
  }
}

/**
 * Delete user
 */
export async function deleteUser(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const result = await sql`
      DELETE FROM user_profiles WHERE id = ${id} RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    request.log.info({ userId: id }, 'User deleted');

    return reply.code(204).send();
  } catch (error) {
    request.log.error(error, 'Failed to delete user');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to delete user',
    });
  }
}

/**
 * List users with filtering
 */
export async function listUsers(
  request: FastifyRequest<{
    Querystring: {
      role?: UserRole;
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { role, limit = 20, offset = 0 } = request.query;

  try {
    let query = sql`SELECT * FROM user_profiles`;

    if (role) {
      query = sql`SELECT * FROM user_profiles WHERE role = ${role}`;
    }

    const users = await sql`
      ${query}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const response = users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      bio: user.bio,
      profileImageUrl: user.profile_image_url,
      language: user.language,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }));

    return reply.send({
      users: response,
      pagination: {
        limit,
        offset,
        total: users.length,
      },
    });
  } catch (error) {
    request.log.error(error, 'Failed to list users');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to list users',
    });
  }
}
