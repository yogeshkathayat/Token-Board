import { NextRequest, NextResponse } from 'next/server';

import { getCompanyUser, userIdFor } from '@/lib/auth/company';
import { query } from '@/lib/db/client';

function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
  const user = await getCompanyUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = userIdFor(user);
  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await query(
    `INSERT INTO tb_link_codes (code, user_id, email, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [code, userId, user.email, expiresAt.toISOString()],
  );

  return NextResponse.json({ code, expires_at: expiresAt.toISOString() });
}
