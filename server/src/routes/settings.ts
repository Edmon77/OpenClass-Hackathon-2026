import type { FastifyPluginAsync } from 'fastify';
import { ADVANCE_REMINDER_HOURS, CUTOFF_MINUTES_DEFAULT } from '../lib/bookingNotifications.js';

/** Public policy values for clients (auth required for consistency). */
export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/policy',
    { preHandler: [app.authenticate] },
    async () => {
      return {
        cutoff_minutes_before_class: CUTOFF_MINUTES_DEFAULT,
        advance_reminder_hours: ADVANCE_REMINDER_HOURS,
        timezone_display: 'Africa/Addis_Ababa',
      };
    }
  );
};
