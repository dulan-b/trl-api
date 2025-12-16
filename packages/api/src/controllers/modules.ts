import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

interface ModuleParams {
  id: string;
}

interface CreateModuleBody {
  track_id: string;
  title: string;
  description?: string;
  order_index: number;
  is_required?: boolean;
}

/**
 * Get module by ID
 */
export async function getModuleById(
  request: FastifyRequest<{ Params: ModuleParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const result = await sql`
      SELECT *
      FROM modules
      WHERE id = ${id}
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Module not found',
      });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Create module
 */
export async function createModule(
  request: FastifyRequest<{ Body: CreateModuleBody }>,
  reply: FastifyReply
) {
  try {
    const { track_id, title, description, order_index, is_required = false } = request.body;

    const result = await sql`
      INSERT INTO modules (
        track_id,
        title,
        description,
        order_index,
        is_required
      )
      VALUES (
        ${track_id},
        ${title},
        ${description || null},
        ${order_index},
        ${is_required}
      )
      RETURNING *
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Update module
 */
export async function updateModule(
  request: FastifyRequest<{
    Params: ModuleParams;
    Body: Partial<CreateModuleBody>;
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const updates = request.body;

    const allowedFields = ['title', 'description', 'order_index', 'is_required'];
    const updateFields: string[] = [];
    const values: any[] = [];

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        updateFields.push(key);
        values.push((updates as any)[key]);
      }
    });

    if (updateFields.length === 0) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'No valid fields to update',
      });
    }

    const setClause = updateFields
      .map((field, idx) => `${field} = $${idx + 1}`)
      .join(', ');

    values.push(id);

    const result = await sql.unsafe(`
      UPDATE modules
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `, values);

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Module not found',
      });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Get lessons for a module
 */
export async function getModuleLessons(
  request: FastifyRequest<{ Params: ModuleParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const lessons = await sql`
      SELECT *
      FROM lessons
      WHERE module_id = ${id}
      ORDER BY order_index ASC
    `;

    return reply.send({ data: lessons });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Delete module
 */
export async function deleteModule(
  request: FastifyRequest<{ Params: ModuleParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const result = await sql`
      DELETE FROM modules
      WHERE id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Module not found',
      });
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
