import type { FastifyRequest, FastifyReply } from 'fastify';
import { Resend } from 'resend';
import { sql } from '../config/database.js';

// TODO: MVP - Move these to environment variables before production deployment
// SECURITY: API key and email should not be hardcoded in source code
const resend = new Resend('re_dWsuxRuG_FccVfCAaRRVBhHAKLbmd6RB4');
const DEMO_REQUEST_EMAIL = 'brett@enterliminal.com';

interface DemoRequestBody {
  name: string;
  email: string;
  company?: string;
  role?: string;
  message?: string;
  source?: string;
}

/**
 * Submit a demo request
 */
export async function submitDemoRequest(
  request: FastifyRequest<{ Body: DemoRequestBody }>,
  reply: FastifyReply
) {
  try {
    const { name, email, company, role, message, source } = request.body;

    // Validate required fields
    if (!name?.trim() || !email?.trim()) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Name and email are required',
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Invalid email format',
      });
    }

    // Save to database
    const [demoRequest] = await sql`
      INSERT INTO demo_requests (name, email, company, role, message, source)
      VALUES (${name.trim()}, ${email.trim()}, ${company?.trim() || null}, ${role?.trim() || null}, ${message?.trim() || null}, ${source || null})
      RETURNING *
    `;

    // Send notification email
    try {
      await resend.emails.send({
          from: 'The Ready Lab <onboarding@resend.dev>',
          to: DEMO_REQUEST_EMAIL,
          subject: `New Demo Request from ${name}`,
          html: `
            <h2>New Demo Request</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
            ${role ? `<p><strong>Role:</strong> ${role}</p>` : ''}
            ${message ? `<p><strong>Message:</strong></p><p>${message}</p>` : ''}
            ${source ? `<p><strong>Source:</strong> ${source}</p>` : ''}
            <hr>
            <p><small>Submitted at ${new Date().toISOString()}</small></p>
          `,
        });

      // Send confirmation to requester
      await resend.emails.send({
          from: 'The Ready Lab <onboarding@resend.dev>',
          to: email,
          subject: 'Thanks for your interest in The Ready Lab!',
          html: `
            <h2>Thanks for requesting a demo, ${name}!</h2>
            <p>We've received your request and will be in touch within 24-48 hours to schedule your personalized demo.</p>
            <p>In the meantime, feel free to explore our platform at <a href="https://thereadylab.com">thereadylab.com</a>.</p>
            <br>
            <p>Best regards,</p>
            <p>The Ready Lab Team</p>
          `,
        });
    } catch (emailError: any) {
      // Log email error but don't fail the request
      request.log.error('Failed to send demo request email:', emailError);
    }

    return reply.code(201).send({
      success: true,
      message: 'Demo request submitted successfully',
      id: demoRequest.id,
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
 * List demo requests (admin only)
 */
export async function listDemoRequests(
  request: FastifyRequest<{
    Querystring: { status?: string; limit?: string; offset?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { status, limit = '50', offset = '0' } = request.query;
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    const requests = status
      ? await sql`
          SELECT * FROM demo_requests
          WHERE status = ${status}
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `
      : await sql`
          SELECT * FROM demo_requests
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;

    const [{ count }] = status
      ? await sql`SELECT COUNT(*) FROM demo_requests WHERE status = ${status}`
      : await sql`SELECT COUNT(*) FROM demo_requests`;

    return reply.send({
      data: requests,
      pagination: {
        total: parseInt(count),
        limit: limitNum,
        offset: offsetNum,
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
 * Update demo request status (admin only)
 */
export async function updateDemoRequestStatus(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { status: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { status } = request.body;

    const validStatuses = ['pending', 'contacted', 'converted', 'declined'];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const [updated] = await sql`
      UPDATE demo_requests
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updated) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Demo request not found',
      });
    }

    return reply.send(updated);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
