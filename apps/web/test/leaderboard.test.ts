import { describe, it } from 'node:test';
import assert from 'node:assert';

interface BucketRow {
  user_id: string;
  source: string;
  total_tokens: string;
}

function aggregateByUser(buckets: BucketRow[]): Map<string, bigint> {
  const userMap = new Map<string, bigint>();
  for (const b of buckets) {
    const current = userMap.get(b.user_id) || 0n;
    userMap.set(b.user_id, current + BigInt(b.total_tokens));
  }
  return userMap;
}

function rankUsers(userMap: Map<string, bigint>): Array<{ user_id: string; total_tokens: bigint; rank: number }> {
  const sorted = Array.from(userMap.entries())
    .map(([user_id, total_tokens]) => ({ user_id, total_tokens }))
    .sort((a, b) => (a.total_tokens > b.total_tokens ? -1 : a.total_tokens < b.total_tokens ? 1 : 0));

  return sorted.map((u, idx) => ({ ...u, rank: idx + 1 }));
}

describe('leaderboard aggregation logic', () => {
  it('aggregates tokens per user', () => {
    const buckets: BucketRow[] = [
      { user_id: 'alice', source: 'claude', total_tokens: '1000' },
      { user_id: 'alice', source: 'gemini', total_tokens: '500' },
      { user_id: 'bob', source: 'claude', total_tokens: '2000' },
    ];

    const result = aggregateByUser(buckets);
    assert.strictEqual(result.get('alice'), 1500n);
    assert.strictEqual(result.get('bob'), 2000n);
  });

  it('ranks users by total tokens descending', () => {
    const userMap = new Map([
      ['alice', 1500n],
      ['bob', 2000n],
      ['charlie', 1000n],
    ]);

    const ranked = rankUsers(userMap);
    assert.strictEqual(ranked.length, 3);
    assert.strictEqual(ranked[0].user_id, 'bob');
    assert.strictEqual(ranked[0].rank, 1);
    assert.strictEqual(ranked[1].user_id, 'alice');
    assert.strictEqual(ranked[1].rank, 2);
    assert.strictEqual(ranked[2].user_id, 'charlie');
    assert.strictEqual(ranked[2].rank, 3);
  });
});
