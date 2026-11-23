// Da o quita el rol Administrador (HU-012). No hay pantalla para esto a propósito: solo quien tiene
// acceso a la base del ambiente puede nombrar administradores.
//   pnpm --filter @red/api admin:promote ana@correo.com          → ADMIN
//   pnpm --filter @red/api admin:promote ana@correo.com --revoke → USER
import prismaClient from '@prisma/client';

const { PrismaClient } = prismaClient;
const prisma = new PrismaClient();

async function main() {
  const [rawEmail, flag] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!email || (flag && flag !== '--revoke')) {
    console.error('Uso: admin:promote <correo> [--revoke]');
    process.exitCode = 1;
    return;
  }
  const role = flag === '--revoke' ? 'USER' : 'ADMIN';
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true },
  });
  if (!user) {
    console.error('No existe una cuenta con ese correo.');
    process.exitCode = 1;
    return;
  }
  if (user.status !== 'ACTIVE') {
    console.error(
      `La cuenta no está activa (estado ${user.status}); confírmala o reactívala primero.`,
    );
    process.exitCode = 1;
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  console.log(
    role === 'ADMIN' ? 'La cuenta ahora es Administrador.' : 'La cuenta ya no es Administrador.',
  );
}

void main().finally(() => prisma.$disconnect());
