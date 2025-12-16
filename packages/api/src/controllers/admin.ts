import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Admin Controller
 * Admin roles, audit logs, feature flags, educator agreements, verified badges
 */

// ==================== ADMIN ROLES ====================

/**
 * Get user's admin roles
 */
export async function getUserAdminRoles(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const result = await sql`SELECT * FROM admin_roles WHERE user_id = ${userId}`;
    return reply.send({ data: result });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Grant admin role
 */
export async function grantAdminRole(
  request: FastifyRequest<{
    Body: { user_id: string; role: string; granted_by: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { user_id, role, granted_by } = request.body;

    const result = await sql`
      INSERT INTO admin_roles (user_id, role, granted_by)
      VALUES (${user_id}, ${role}, ${granted_by})
      ON CONFLICT (user_id, role) DO NOTHING
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(409).send({ error: 'Conflict', message: 'Role already granted' });
    }

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Revoke admin role
 */
export async function revokeAdminRole(
  request: FastifyRequest<{ Params: { userId: string; role: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId, role } = request.params;

    const result = await sql`
      DELETE FROM admin_roles WHERE user_id = ${userId} AND role = ${role}
      RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Role not found' });
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

// ==================== AUDIT LOGS ====================

/**
 * Create audit log entry
 */
export async function createAuditLog(
  request: FastifyRequest<{
    Body: {
      user_id: string;
      action: string;
      resource_type: string;
      resource_id?: string;
      details?: Record<string, any>;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { user_id, action, resource_type, resource_id, details } = request.body;

    const result = await sql`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
      VALUES (${user_id}, ${action}, ${resource_type}, ${resource_id || null}, ${details ? JSON.stringify(details) : null})
      RETURNING *
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get audit logs
 */
export async function getAuditLogs(
  request: FastifyRequest<{
    Querystring: {
      user_id?: string;
      action?: string;
      resource_type?: string;
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { user_id, action, resource_type, limit = 50, offset = 0 } = request.query;

    let query;
    if (user_id) {
      query = sql`
        SELECT al.*, p.full_name, p.email
        FROM audit_logs al
        LEFT JOIN profiles p ON al.user_id = p.id
        WHERE al.user_id = ${user_id}
        ORDER BY al.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (action) {
      query = sql`
        SELECT al.*, p.full_name, p.email
        FROM audit_logs al
        LEFT JOIN profiles p ON al.user_id = p.id
        WHERE al.action = ${action}
        ORDER BY al.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (resource_type) {
      query = sql`
        SELECT al.*, p.full_name, p.email
        FROM audit_logs al
        LEFT JOIN profiles p ON al.user_id = p.id
        WHERE al.resource_type = ${resource_type}
        ORDER BY al.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT al.*, p.full_name, p.email
        FROM audit_logs al
        LEFT JOIN profiles p ON al.user_id = p.id
        ORDER BY al.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const logs = await query;
    return reply.send({ data: logs, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

// ==================== FEATURE FLAGS ====================

/**
 * Get all feature flags
 */
export async function getFeatureFlags(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const flags = await sql`SELECT * FROM feature_flags ORDER BY name ASC`;
    return reply.send({ data: flags });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get feature flag by name
 */
export async function getFeatureFlagByName(
  request: FastifyRequest<{ Params: { name: string } }>,
  reply: FastifyReply
) {
  try {
    const { name } = request.params;
    const result = await sql`SELECT * FROM feature_flags WHERE name = ${name}`;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Flag not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Update feature flag
 */
export async function updateFeatureFlag(
  request: FastifyRequest<{
    Params: { name: string };
    Body: { enabled: boolean; description?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { name } = request.params;
    const { enabled, description } = request.body;

    const updateData: Record<string, any> = { enabled };
    if (description !== undefined) updateData.description = description;

    const result = await sql`
      UPDATE feature_flags
      SET ${sql(updateData)}, updated_at = NOW()
      WHERE name = ${name}
      RETURNING *
    `;

    if (result.length === 0) {
      // Create if doesn't exist
      const newResult = await sql`
        INSERT INTO feature_flags (name, enabled, description)
        VALUES (${name}, ${enabled}, ${description || null})
        RETURNING *
      `;
      return reply.code(201).send(newResult[0]);
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

// ==================== EDUCATOR AGREEMENTS ====================

/**
 * Get user's educator agreements
 */
export async function getUserEducatorAgreements(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const result = await sql`
      SELECT * FROM educator_agreements
      WHERE user_id = ${userId}
      ORDER BY signed_at DESC
    `;
    return reply.send({ data: result });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Accept educator agreement
 */
export async function acceptEducatorAgreement(
  request: FastifyRequest<{
    Body: { user_id: string; agreement_version: string; ip_address?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { user_id, agreement_version, ip_address } = request.body;

    const result = await sql`
      INSERT INTO educator_agreements (user_id, agreement_version, ip_address)
      VALUES (${user_id}, ${agreement_version}, ${ip_address || null})
      RETURNING *
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

// ==================== VERIFIED BADGES ====================

/**
 * Get badge status for user
 */
export async function getVerifiedBadgeStatus(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const result = await sql`
      SELECT * FROM verified_educator_badges WHERE user_id = ${userId}
    `;

    if (result.length === 0) {
      return reply.send({ verified: false });
    }

    return reply.send({ verified: true, ...result[0] });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Request verification
 */
export async function requestVerification(
  request: FastifyRequest<{
    Body: { user_id: string; documentation_url?: string; notes?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { user_id, documentation_url, notes } = request.body;

    const result = await sql`
      INSERT INTO verified_educator_badges (user_id, status, documentation_url, notes)
      VALUES (${user_id}, 'pending', ${documentation_url || null}, ${notes || null})
      ON CONFLICT (user_id) DO UPDATE
      SET status = 'pending', documentation_url = ${documentation_url || null},
          notes = ${notes || null}, updated_at = NOW()
      RETURNING *
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Approve or reject verification (admin)
 */
export async function updateVerificationStatus(
  request: FastifyRequest<{
    Params: { userId: string };
    Body: { status: 'approved' | 'rejected'; reviewed_by: string; review_notes?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const { status, reviewed_by, review_notes } = request.body;

    const result = await sql`
      UPDATE verified_educator_badges
      SET status = ${status}, reviewed_by = ${reviewed_by},
          review_notes = ${review_notes || null},
          verified_at = ${status === 'approved' ? sql`NOW()` : sql`NULL`},
          updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Verification request not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
