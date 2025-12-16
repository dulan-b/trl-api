import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Purchases Controller
 */

interface PurchaseParams {
  id: string;
}

interface CreatePurchaseBody {
  user_id: string;
  product_id: string;
  amount: number;
  currency?: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
}

/**
 * Get purchase by ID
 */
export async function getPurchaseById(
  request: FastifyRequest<{ Params: PurchaseParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const result = await sql`
      SELECT p.*, dp.title as product_title, dp.price as product_price
      FROM purchases p
      LEFT JOIN digital_products dp ON p.product_id = dp.id
      WHERE p.id = ${id}
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Purchase not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get user's purchases
 */
export async function getUserPurchases(
  request: FastifyRequest<{
    Params: { userId: string };
    Querystring: { limit?: number; offset?: number };
  }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const { limit = 50, offset = 0 } = request.query;

    const purchases = await sql`
      SELECT p.*, dp.title as product_title, dp.thumbnail_url as product_thumbnail
      FROM purchases p
      LEFT JOIN digital_products dp ON p.product_id = dp.id
      WHERE p.user_id = ${userId}
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return reply.send({ data: purchases, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Create purchase
 */
export async function createPurchase(
  request: FastifyRequest<{ Body: CreatePurchaseBody }>,
  reply: FastifyReply
) {
  try {
    const {
      user_id,
      product_id,
      amount,
      currency = 'usd',
      stripe_session_id,
      stripe_payment_intent_id,
    } = request.body;

    const result = await sql`
      INSERT INTO purchases (
        user_id, product_id, amount, currency,
        stripe_session_id, stripe_payment_intent_id, status
      )
      VALUES (
        ${user_id}, ${product_id}, ${amount}, ${currency},
        ${stripe_session_id || null}, ${stripe_payment_intent_id || null}, 'completed'
      )
      RETURNING *
    `;

    // Update downloads count
    await sql`
      UPDATE digital_products
      SET downloads_count = downloads_count + 1
      WHERE id = ${product_id}
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
