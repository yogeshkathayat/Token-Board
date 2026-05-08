import type { FastifyInstance } from 'fastify';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireAdmin);

  app.get('/users', async (req) => {
    const q = req.query as { search?: string; limit?: string; offset?: string };
    const limit = Math.max(1, Math.min(200, Number.parseInt(q.limit ?? '50', 10) || 50));
    const offset = Math.max(0, Number.parseInt(q.offset ?? '0', 10) || 0);
    let qb = app.db
      .selectFrom('tb_users')
      .select(['id', 'email', 'display_name', 'role', 'created_at'])
      .orderBy('created_at', 'desc');
    if (q.search) {
      qb = qb.where('email', 'ilike', `%${q.search}%`);
    }
    const users = await qb.limit(limit).offset(offset).execute();
    return { users };
  });

  app.get('/devices', async (req) => {
    const q = req.query as { user_id?: string };
    let qb = app.db
      .selectFrom('tb_devices')
      .select(['id', 'user_id', 'name', 'platform', 'created_at', 'last_seen_at', 'revoked_at'])
      .orderBy('last_seen_at', 'desc nulls last' as never);
    if (q.user_id) qb = qb.where('user_id', '=', q.user_id);
    const devices = await qb.limit(500).execute();
    return { devices };
  });

  app.post('/devices/:id/revoke', async (req, reply) => {
    const { id } = req.params as { id: string };
    const updated = await app.db
      .updateTable('tb_devices')
      .set({ revoked_at: new Date() })
      .where('id', '=', id)
      .where('revoked_at', 'is', null)
      .returning(['id'])
      .executeTakeFirst();
    if (!updated) return reply.code(404).send({ error: 'NotFound' });
    await app.db
      .insertInto('tb_audit_events')
      .values({
        actor_user_id: req.authUser!.sub,
        action: 'device.revoke',
        target_type: 'device',
        target_id: id,
        metadata: {},
      })
      .execute();
    return { ok: true };
  });

  app.get('/stats', async () => {
    const [users, devices, lastDay] = await Promise.all([
      app.db.selectFrom('tb_users').select(({ fn }) => [fn.count<string>('id').as('c')]).executeTakeFirstOrThrow(),
      app.db.selectFrom('tb_devices').select(({ fn }) => [fn.count<string>('id').as('c')]).where('revoked_at', 'is', null).executeTakeFirstOrThrow(),
      app.db
        .selectFrom('tb_usage_buckets')
        .select(({ fn }) => [fn.sum<string>('total_tokens').as('tokens')])
        .where('hour_start', '>=', new Date(Date.now() - 86400_000))
        .executeTakeFirstOrThrow(),
    ]);
    return {
      users: Number(users.c ?? 0),
      active_devices: Number(devices.c ?? 0),
      tokens_24h: lastDay.tokens ?? '0',
    };
  });
}
