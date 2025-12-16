import type { FastifyInstance } from 'fastify';
import {
  getInstitutionById,
  createInstitution,
  updateInstitution,
  listInstitutionMembers,
  addInstitutionMember,
  removeInstitutionMember,
  updateInstitutionMemberRole,
} from '../controllers/institutions.js';
import { optionalAuth } from '../middleware/auth.js';

export async function institutionRoutes(fastify: FastifyInstance) {
  fastify.get('/:id', { onRequest: [optionalAuth], handler: getInstitutionById });
  fastify.post('/', { onRequest: [optionalAuth], handler: createInstitution });
  fastify.put('/:id', { onRequest: [optionalAuth], handler: updateInstitution });

  // Members
  fastify.get('/:id/members', { onRequest: [optionalAuth], handler: listInstitutionMembers });
  fastify.post('/:id/members', { onRequest: [optionalAuth], handler: addInstitutionMember });
  fastify.delete('/:id/members/:userId', { onRequest: [optionalAuth], handler: removeInstitutionMember });
  fastify.put('/:id/members/:userId', { onRequest: [optionalAuth], handler: updateInstitutionMemberRole });
}
