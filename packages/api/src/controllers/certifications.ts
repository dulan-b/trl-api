import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Get certifications for a user
 */
export async function getCertificationsByUserId(
  request: FastifyRequest<{
    Params: { userId: string };
  }>,
  reply: FastifyReply
) {
  const { userId } = request.params;

  try {
    const certifications = await sql`
      SELECT
        c.*,
        t.title as track_title,
        t.description as track_description
      FROM certifications c
      JOIN tracks t ON c.track_id = t.id
      WHERE c.user_id = ${userId}
      ORDER BY c.issued_at DESC
    `;

    return reply.send({
      certifications: certifications.map((cert) => ({
        id: cert.id,
        userId: cert.user_id,
        trackId: cert.track_id,
        trackTitle: cert.track_title,
        trackDescription: cert.track_description,
        certificateUrl: cert.certificate_url,
        verificationCode: cert.verification_code,
        issuedAt: cert.issued_at,
        expiresAt: cert.expires_at,
        createdAt: cert.created_at,
        updatedAt: cert.updated_at,
      })),
    });
  } catch (error) {
    request.log.error(error, 'Failed to get certifications');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve certifications',
    });
  }
}

/**
 * Get certification by ID
 */
export async function getCertificationById(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const [certification] = await sql`
      SELECT
        c.*,
        t.title as track_title,
        t.description as track_description,
        p.full_name as user_name
      FROM certifications c
      JOIN tracks t ON c.track_id = t.id
      JOIN profiles p ON c.user_id = p.id
      WHERE c.id = ${id}
    `;

    if (!certification) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Certification not found',
      });
    }

    return reply.send({
      id: certification.id,
      userId: certification.user_id,
      userName: certification.user_name,
      trackId: certification.track_id,
      trackTitle: certification.track_title,
      trackDescription: certification.track_description,
      certificateUrl: certification.certificate_url,
      verificationCode: certification.verification_code,
      issuedAt: certification.issued_at,
      expiresAt: certification.expires_at,
      createdAt: certification.created_at,
      updatedAt: certification.updated_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to get certification');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve certification',
    });
  }
}

/**
 * Create certification
 */
export async function createCertification(
  request: FastifyRequest<{
    Body: {
      userId: string;
      trackId: string;
      certificateUrl?: string;
      expiresAt?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { userId, trackId, certificateUrl, expiresAt } = request.body;

  try {
    // Generate a unique verification code
    const verificationCode = `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const [certification] = await sql`
      INSERT INTO certifications (
        user_id,
        track_id,
        certificate_url,
        verification_code,
        expires_at
      )
      VALUES (
        ${userId},
        ${trackId},
        ${certificateUrl || null},
        ${verificationCode},
        ${expiresAt || null}
      )
      RETURNING *
    `;

    return reply.code(201).send({
      id: certification.id,
      userId: certification.user_id,
      trackId: certification.track_id,
      certificateUrl: certification.certificate_url,
      verificationCode: certification.verification_code,
      issuedAt: certification.issued_at,
      expiresAt: certification.expires_at,
      createdAt: certification.created_at,
      updatedAt: certification.updated_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to create certification');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create certification',
    });
  }
}
