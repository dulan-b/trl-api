import type { FastifyInstance } from 'fastify';
import {
  getUserAdminRoles,
  grantAdminRole,
  revokeAdminRole,
  createAuditLog,
  getAuditLogs,
  getFeatureFlags,
  getFeatureFlagByName,
  updateFeatureFlag,
  getUserEducatorAgreements,
  acceptEducatorAgreement,
  getVerifiedBadgeStatus,
  requestVerification,
  updateVerificationStatus,
} from '../controllers/admin.js';
import { optionalAuth } from '../middleware/auth.js';

export async function adminRoutes(fastify: FastifyInstance) {
  // Admin Roles
  fastify.get('/roles/:userId', { onRequest: [optionalAuth], handler: getUserAdminRoles });
  fastify.post('/roles', { onRequest: [optionalAuth], handler: grantAdminRole });
  fastify.delete('/roles/:userId/:role', { onRequest: [optionalAuth], handler: revokeAdminRole });

  // Audit Logs
  fastify.get('/audit-logs', { onRequest: [optionalAuth], handler: getAuditLogs });
  fastify.post('/audit-logs', { onRequest: [optionalAuth], handler: createAuditLog });

  // Feature Flags
  fastify.get('/feature-flags', { onRequest: [optionalAuth], handler: getFeatureFlags });
  fastify.get('/feature-flags/:name', { onRequest: [optionalAuth], handler: getFeatureFlagByName });
  fastify.put('/feature-flags/:name', { onRequest: [optionalAuth], handler: updateFeatureFlag });

  // Educator Agreements
  fastify.get('/educator-agreements/:userId', { onRequest: [optionalAuth], handler: getUserEducatorAgreements });
  fastify.post('/educator-agreements', { onRequest: [optionalAuth], handler: acceptEducatorAgreement });

  // Verified Badges
  fastify.get('/verified-badges/:userId', { onRequest: [optionalAuth], handler: getVerifiedBadgeStatus });
  fastify.post('/verified-badges', { onRequest: [optionalAuth], handler: requestVerification });
  fastify.put('/verified-badges/:userId', { onRequest: [optionalAuth], handler: updateVerificationStatus });
}
