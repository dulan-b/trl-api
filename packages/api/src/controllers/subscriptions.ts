import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Subscriptions Controller
 * Handles subscription plans and user subscriptions
 */

/**
 * List subscription plans
 */
export async function listSubscriptionPlans(
  request: FastifyRequest<{ Querystring: { active_only?: boolean } }>,
  reply: FastifyReply
) {
  try {
    const { active_only = true } = request.query;

    let query;
    if (active_only) {
      query = sql`
        SELECT * FROM subscription_plans
        WHERE is_active = true
        ORDER BY price ASC
      `;
    } else {
      query = sql`
        SELECT * FROM subscription_plans
        ORDER BY price ASC
      `;
    }

    const plans = await query;
    return reply.send({ data: plans });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get subscription plan by ID
 */
export async function getSubscriptionPlanById(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const result = await sql`SELECT * FROM subscription_plans WHERE id = ${id}`;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Plan not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get user's subscription
 */
export async function getUserSubscription(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;

    const result = await sql`
      SELECT s.*, p.name as plan_name, p.features as plan_features
      FROM stripe_subscriptions s
      LEFT JOIN subscription_plans p ON s.plan_id = p.id
      WHERE s.user_id = ${userId}
      ORDER BY s.created_at DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'No subscription found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Create subscription (from Stripe webhook typically)
 */
export async function createSubscription(
  request: FastifyRequest<{
    Body: {
      user_id: string;
      plan_id: string;
      stripe_subscription_id: string;
      stripe_customer_id: string;
      status: string;
      current_period_start: string;
      current_period_end: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const {
      user_id,
      plan_id,
      stripe_subscription_id,
      stripe_customer_id,
      status,
      current_period_start,
      current_period_end,
    } = request.body;

    const result = await sql`
      INSERT INTO stripe_subscriptions (
        user_id, plan_id, stripe_subscription_id, stripe_customer_id,
        status, current_period_start, current_period_end
      )
      VALUES (
        ${user_id}, ${plan_id}, ${stripe_subscription_id}, ${stripe_customer_id},
        ${status}, ${current_period_start}, ${current_period_end}
      )
      RETURNING *
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const result = await sql`
      UPDATE stripe_subscriptions
      SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Subscription not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get user's invoices
 */
export async function getUserInvoices(
  request: FastifyRequest<{
    Params: { userId: string };
    Querystring: { limit?: number; offset?: number };
  }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const { limit = 50, offset = 0 } = request.query;

    const invoices = await sql`
      SELECT * FROM stripe_invoices
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return reply.send({ data: invoices, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
