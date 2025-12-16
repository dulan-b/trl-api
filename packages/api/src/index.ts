import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getEnvConfig } from '@trl/shared';
import { testConnection } from './config/database.js';
import { videoRoutes } from './routes/videos.js';
import { webhookRoutes } from './routes/webhooks.js';
import { liveRoutes } from './routes/live.js';
import { userRoutes } from './routes/users.js';
import { courseRoutes } from './routes/courses.js';
import { lessonRoutes } from './routes/lessons.js';
import { enrollmentRoutes } from './routes/enrollments.js';
import { quizRoutes } from './routes/quizzes.js';
import { profileRoutes } from './routes/profiles.js';
import { trackRoutes } from './routes/tracks.js';
import { moduleRoutes } from './routes/modules.js';
import { notificationRoutes } from './routes/notifications.js';
import { certificationRoutes } from './routes/certifications.js';
import { communityRoutes } from './routes/communities.js';
import { productRoutes } from './routes/products.js';
import { userRoleRoutes } from './routes/userRoles.js';
import { userInterestRoutes } from './routes/userInterests.js';
import { liveEventRoutes } from './routes/liveEvents.js';
import { postRoutes } from './routes/posts.js';
import { communityMemberRoutes } from './routes/communityMembers.js';
import { purchaseRoutes } from './routes/purchases.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { stripeConnectRoutes } from './routes/stripeConnect.js';
import { institutionRoutes } from './routes/institutions.js';
import { adminRoutes } from './routes/admin.js';
import { bookmarkRoutes } from './routes/bookmarks.js';
import { microLessonRoutes } from './routes/microLessons.js';
import { communityPollRoutes } from './routes/communityPolls.js';

const config = getEnvConfig();

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'info' : 'warn',
    transport:
      config.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
  // Enable raw body for webhook signature verification
  bodyLimit: 10485760, // 10MB
  disableRequestLogging: false,
});

// Register CORS
await fastify.register(cors, {
  origin: config.NODE_ENV === 'development' ? '*' : ['https://app.thereadylab.com'],
  credentials: true,
});

// Add raw body support for webhooks
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req: any, body: Buffer, done: any) => {
    try {
      // Store raw body for webhook verification
      req.rawBody = body.toString('utf-8');
      const json = JSON.parse(req.rawBody);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  }
);

// Health check
fastify.get('/health', async (request, reply) => {
  const dbHealthy = await testConnection();

  const health = {
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'up' : 'down',
    },
  };

  return reply.code(dbHealthy ? 200 : 503).send(health);
});

// Register routes
await fastify.register(videoRoutes, { prefix: '/api/videos' });
await fastify.register(webhookRoutes, { prefix: '/api/webhooks' });
await fastify.register(liveRoutes, { prefix: '/api/live' });
await fastify.register(userRoutes, { prefix: '/api/users' });
await fastify.register(profileRoutes, { prefix: '/api/profiles' });
await fastify.register(trackRoutes, { prefix: '/api/tracks' });
await fastify.register(moduleRoutes, { prefix: '/api/modules' });
await fastify.register(courseRoutes, { prefix: '/api/courses' });
await fastify.register(lessonRoutes, { prefix: '/api/lessons' });
await fastify.register(enrollmentRoutes, { prefix: '/api/enrollments' });
await fastify.register(quizRoutes, { prefix: '/api/quizzes' });
await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
await fastify.register(certificationRoutes, { prefix: '/api/certifications' });
await fastify.register(communityRoutes, { prefix: '/api/communities' });
await fastify.register(productRoutes, { prefix: '/api/products' });
await fastify.register(userRoleRoutes, { prefix: '/api/user-roles' });
await fastify.register(userInterestRoutes, { prefix: '/api/user-interests' });
await fastify.register(liveEventRoutes, { prefix: '/api/live-events' });
await fastify.register(postRoutes, { prefix: '/api/posts' });
await fastify.register(communityMemberRoutes, { prefix: '/api/communities' });
await fastify.register(purchaseRoutes, { prefix: '/api/purchases' });
await fastify.register(subscriptionRoutes, { prefix: '/api/subscriptions' });
await fastify.register(stripeConnectRoutes, { prefix: '/api/stripe-connect' });
await fastify.register(institutionRoutes, { prefix: '/api/institutions' });
await fastify.register(adminRoutes, { prefix: '/api/admin' });
await fastify.register(bookmarkRoutes, { prefix: '/api/bookmarks' });
await fastify.register(microLessonRoutes, { prefix: '/api/micro-lessons' });
await fastify.register(communityPollRoutes, { prefix: '/api/community-polls' });

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
  });
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  // In production, don't expose internal error details to clients
  const isProduction = config.NODE_ENV === 'production';

  reply.code(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    // Only expose detailed error messages in development
    message: isProduction && error.statusCode >= 500
      ? 'An unexpected error occurred'
      : error.message || 'An unexpected error occurred',
  });
});

// Start server
async function start() {
  try {
    // Test database connection
    const dbHealthy = await testConnection();
    if (!dbHealthy) {
      fastify.log.warn('Database connection failed - server starting but may not function properly');
    }

    await fastify.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });

    fastify.log.info(`Server running at http://localhost:${config.PORT}`);
    fastify.log.info(`Environment: ${config.NODE_ENV}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
