import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

interface TrackParams {
  id: string;
}

interface CreateTrackBody {
  title: string;
  description?: string;
  price?: number;
  certification_type?: string;
  completion_requirement?: number;
  is_active?: boolean;
  created_by?: string;
  thumbnail_url?: string;
  category: string;
  level?: string;
  estimated_hours?: number;
}

/**
 * Get all tracks
 */
export async function listTracks(
  request: FastifyRequest<{
    Querystring: {
      limit?: number;
      offset?: number;
      category?: string;
      level?: string;
      is_active?: boolean;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const {
      limit = 50,
      offset = 0,
      category,
      level,
      is_active = true,
    } = request.query;

    let query;

    if (category && level) {
      query = sql`
        SELECT *
        FROM tracks
        WHERE is_active = ${is_active}
          AND category = ${category}
          AND level = ${level}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else if (category) {
      query = sql`
        SELECT *
        FROM tracks
        WHERE is_active = ${is_active}
          AND category = ${category}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else if (level) {
      query = sql`
        SELECT *
        FROM tracks
        WHERE is_active = ${is_active}
          AND level = ${level}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT *
        FROM tracks
        WHERE is_active = ${is_active}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    const tracks = await query;

    return reply.send({
      data: tracks,
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Get track by ID
 */
export async function getTrackById(
  request: FastifyRequest<{ Params: TrackParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const result = await sql`
      SELECT *
      FROM tracks
      WHERE id = ${id}
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Track not found',
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
 * Create new track
 */
export async function createTrack(
  request: FastifyRequest<{ Body: CreateTrackBody }>,
  reply: FastifyReply
) {
  try {
    const {
      title,
      description,
      price = 0,
      certification_type = 'completion',
      completion_requirement = 70,
      is_active = true,
      created_by,
      thumbnail_url,
      category,
      level = 'beginner',
      estimated_hours = 1,
    } = request.body;

    const result = await sql`
      INSERT INTO tracks (
        title,
        description,
        price,
        certification_type,
        completion_requirement,
        is_active,
        created_by,
        thumbnail_url,
        category,
        level,
        estimated_hours
      )
      VALUES (
        ${title},
        ${description || null},
        ${price},
        ${certification_type},
        ${completion_requirement},
        ${is_active},
        ${created_by || null},
        ${thumbnail_url || null},
        ${category},
        ${level},
        ${estimated_hours}
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
 * Update track
 */
export async function updateTrack(
  request: FastifyRequest<{
    Params: TrackParams;
    Body: Partial<CreateTrackBody>;
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const updates = request.body;

    // For simplicity, only allowing specific fields to be updated
    const allowedFields = [
      'title',
      'description',
      'price',
      'thumbnail_url',
      'is_active',
      'level',
      'estimated_hours',
    ];

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

    // Build SET clause dynamically
    const setClause = updateFields
      .map((field, idx) => `${field} = $${idx + 1}`)
      .join(', ');

    values.push(id);

    const result = await sql.unsafe(`
      UPDATE tracks
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `, values);

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Track not found',
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
 * Get modules for a track
 */
export async function getTrackModules(
  request: FastifyRequest<{ Params: TrackParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const modules = await sql`
      SELECT *
      FROM modules
      WHERE track_id = ${id}
      ORDER BY order_index ASC
    `;

    return reply.send({ data: modules });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
