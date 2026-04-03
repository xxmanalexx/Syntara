import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();
const jwt = await prisma.user.findFirst().then(u =>
  new SignJWT({ sub: u.id, email: u.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(Buffer.from('dev-secret-change-in-production'))
).finally(() => prisma.$disconnect());

const queries = ['ai', 'skincareviral', 'sunsetview', 'fitness', 'business', 'beauty', 'food'];
for (const q of queries) {
  const res = await fetch('http://localhost:3000/api/hashtag-research?q=' + q, {
    headers: { Authorization: 'Bearer ' + jwt }
  });
  const d = await res.json();
  const posts = d.results ? d.results.reduce((s, g) => s + g.posts.length, 0) : 0;
  console.log(q.padEnd(15) + ': ' + (d.hashtags?.length ?? 0) + ' hashtags, ' + posts + ' posts');
}
