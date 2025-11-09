import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Get all digital products
 */
export async function getDigitalProducts(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const products = await sql`
      SELECT * FROM digital_products
      WHERE is_active = true
      ORDER BY created_at DESC
    `;

    return reply.send({
      products: products.map((p) => ({
        id: p.id,
        creatorId: p.creator_id,
        title: p.title,
        description: p.description,
        price: p.price,
        fileUrl: p.file_url,
        thumbnailUrl: p.thumbnail_url,
        category: p.category,
        isActive: p.is_active,
        salesCount: p.sales_count,
      })),
    });
  } catch (error) {
    request.log.error(error, 'Failed to get products');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve products',
    });
  }
}

/**
 * Get product by ID
 */
export async function getProductById(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const [product] = await sql`
      SELECT * FROM digital_products
      WHERE id = ${id}
    `;

    if (!product) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Product not found',
      });
    }

    return reply.send({
      id: product.id,
      creatorId: product.creator_id,
      title: product.title,
      description: product.description,
      price: product.price,
      fileUrl: product.file_url,
      thumbnailUrl: product.thumbnail_url,
      category: product.category,
      isActive: product.is_active,
      salesCount: product.sales_count,
    });
  } catch (error) {
    request.log.error(error, 'Failed to get product');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve product',
    });
  }
}

/**
 * Create product
 */
export async function createProduct(
  request: FastifyRequest<{
    Body: {
      creatorId: string;
      title: string;
      description: string;
      price: number;
      fileUrl?: string;
      thumbnailUrl?: string;
      category: string;
    };
  }>,
  reply: FastifyReply
) {
  const { creatorId, title, description, price, fileUrl, thumbnailUrl, category } = request.body;

  try {
    const [product] = await sql`
      INSERT INTO digital_products (
        creator_id,
        title,
        description,
        price,
        file_url,
        thumbnail_url,
        category,
        is_active,
        sales_count
      )
      VALUES (
        ${creatorId},
        ${title},
        ${description},
        ${price},
        ${fileUrl || null},
        ${thumbnailUrl || null},
        ${category},
        true,
        0
      )
      RETURNING *
    `;

    return reply.code(201).send({
      id: product.id,
      creatorId: product.creator_id,
      title: product.title,
      description: product.description,
      price: product.price,
      fileUrl: product.file_url,
      thumbnailUrl: product.thumbnail_url,
      category: product.category,
      isActive: product.is_active,
      salesCount: product.sales_count,
    });
  } catch (error) {
    request.log.error(error, 'Failed to create product');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create product',
    });
  }
}
