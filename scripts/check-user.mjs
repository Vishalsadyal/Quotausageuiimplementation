import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const u = await p.user.findUnique({ where: { email: 'vdvishalwebdev@gmail.com' } });
  if (u) {
    console.log(JSON.stringify({ id: u.id, email: u.email, name: u.name, role: u.role }, null, 2));
  } else {
    console.log('No user found matching that email');
  }
} finally {
  await p.$disconnect();
}
