import type { FastifyInstance } from 'fastify';

export async function visibilityRoutes(app: FastifyInstance): Promise<void> {
  app.get('/public-visibility', { preHandler: app.requireUser }, async (req) => {
    const userId = req.authUser!.sub;
    const row = await app.db
      .selectFrom('tb_public_visibility')
      .select(['enabled', 'display_name', 'anonymous', 'updated_at', 'revoked_at'])
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return {
      enabled: Boolean(row?.enabled && !row.revoked_at),
      display_name: row?.display_name ?? null,
      anonymous: Boolean(row?.anonymous),
      updated_at: row?.updated_at ?? null,
    };
  });

  app.post('/public-visibility', { preHandler: app.requireUser }, async (req) => {
    const userId = req.authUser!.sub;
    const body = (req.body as {
      enabled?: boolean;
      anonymous?: boolean;
      display_name?: string | null;
    }) ?? {};

    const enabled = body.enabled !== false;
    const anonymous = Boolean(body.anonymous);
    const displayName = typeof body.display_name === 'string' ? body.display_name.slice(0, 64) : null;

    await app.db
      .insertInto('tb_public_visibility')
      .values({
        user_id: userId,
        enabled,
        anonymous,
        display_name: displayName,
        revoked_at: enabled ? null : new Date(),
      })
      .onConflict((oc) =>
        oc.column('user_id').doUpdateSet({
          enabled,
          anonymous,
          display_name: displayName,
          revoked_at: enabled ? null : new Date(),
          updated_at: new Date(),
        }),
      )
      .execute();

    return { enabled, display_name: displayName, anonymous, updated_at: new Date().toISOString() };
  });
}
