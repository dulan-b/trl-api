import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Stripe Connect Controller
 * Handles educator payout accounts
 */

/**
 * Get educator's connect account status
 */
export async function getConnectAccountStatus(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;

    const result = await sql`
      SELECT * FROM stripe_connect_accounts
      WHERE user_id = ${userId}
    `;

    if (result.length === 0) {
      return reply.send({ connected: false });
    }

    return reply.send({
      connected: true,
      ...result[0],
    });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Create connect account (initiated)
 */
export async function createConnectAccount(
  request: FastifyRequest<{
    Body: { user_id: string; stripe_account_id: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { user_id, stripe_account_id } = request.body;

    const result = await sql`
      INSERT INTO stripe_connect_accounts (user_id, stripe_account_id, status)
      VALUES (${user_id}, ${stripe_account_id}, 'pending')
      ON CONFLICT (user_id) DO UPDATE
      SET stripe_account_id = ${stripe_account_id}, status = 'pending', updated_at = NOW()
      RETURNING *
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Update connect account status (from webhook)
 */
export async function updateConnectAccountStatus(
  request: FastifyRequest<{
    Params: { userId: string };
    Body: { status: string; charges_enabled?: boolean; payouts_enabled?: boolean };
  }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const { status, charges_enabled, payouts_enabled } = request.body;

    const updateData: Record<string, any> = { status };
    if (charges_enabled !== undefined) updateData.charges_enabled = charges_enabled;
    if (payouts_enabled !== undefined) updateData.payouts_enabled = payouts_enabled;

    const result = await sql`
      UPDATE stripe_connect_accounts
      SET ${sql(updateData)}, updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Account not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get educator's payouts
 */
export async function getEducatorPayouts(
  request: FastifyRequest<{
    Params: { userId: string };
    Querystring: { limit?: number; offset?: number };
  }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const { limit = 50, offset = 0 } = request.query;

    const payouts = await sql`
      SELECT * FROM stripe_payouts
      WHERE educator_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return reply.send({ data: payouts, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
