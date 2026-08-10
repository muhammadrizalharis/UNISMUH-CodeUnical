import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  scrypt as _scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';

const scrypt = promisify(_scrypt);
const SESSION_DAYS = 7;
const BAD = 'Email atau sandi salah.';

/** ID institusi = "CU" + NIM/NBM (bagian email sebelum @, hanya huruf/angka, kapital). */
export function deriveUserCode(email: string): string | null {
  const local = (email.split('@')[0] ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return local ? `CU${local}` : null;
}

export interface UserRow {
  id: string;
  code?: string | null;
  email: string;
  name: string;
  role: string;
  status: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSuperadmin();
    await this.backfillCodes();
  }

  private async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${derived.toString('hex')}`;
  }

  private async verify(password: string, stored: string | null): Promise<boolean> {
    if (!stored) return false;
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    const hashBuf = Buffer.from(hash, 'hex');
    return hashBuf.length === derived.length && timingSafeEqual(hashBuf, derived);
  }

  private gateOk(gate?: string): boolean {
    const expected = process.env.PENGUJI_GATE ?? '';
    if (!expected) return false;
    const a = Buffer.from(gate ?? '');
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async ensureSuperadmin() {
    const email = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
    const password = process.env.SUPERADMIN_PASSWORD;
    if (!email || !password) return;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    const passwordHash = await this.hash(password);
    if (existing) {
      const ok = await this.verify(password, existing.passwordHash);
      if (!ok || existing.role !== 'superadmin' || existing.status !== 'active') {
        await this.prisma.user.update({
          where: { email },
          data: { passwordHash, role: 'superadmin', status: 'active' },
        });
      }
      return;
    }
    await this.prisma.user.create({
      data: { email, name: 'Super Admin', role: 'superadmin', status: 'active', passwordHash },
    });
  }

  /** Isi kolom code untuk user lama yang belum punya (idempoten; abaikan bila bentrok). */
  private async backfillCodes() {
    const users = await this.prisma.user.findMany({
      where: { code: null },
      select: { id: true, email: true },
    });
    for (const u of users) {
      const code = deriveUserCode(u.email);
      if (!code) continue;
      await this.prisma.user
        .update({ where: { id: u.id }, data: { code } })
        .catch(() => undefined);
    }
  }

  async login(email: string, password: string, gate?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) throw new UnauthorizedException(BAD);
    if (user.status === 'suspended') throw new UnauthorizedException('Akun dinonaktifkan.');
    if (user.status === 'pending') throw new UnauthorizedException('Akun menunggu persetujuan super-admin.');
    const ok = await this.verify(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException(BAD);
    // Super-admin WAJIB lewat gate tersembunyi.
    if (user.role === 'superadmin' && !this.gateOk(gate)) throw new UnauthorizedException(BAD);
    const token = await this.createSession(user.id);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { token, user: this.publicUser(user) };
  }

  private async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
    await this.prisma.session.create({ data: { tokenHash, userId, expiresAt } });
    return token;
  }

  async getSessionUser(token?: string): Promise<UserRow | null> {
    if (!token) return null;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return this.publicUser(session.user);
  }

  async logout(token?: string) {
    if (!token) return;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  publicUser(u: UserRow): UserRow {
    return { id: u.id, code: u.code ?? null, email: u.email, name: u.name, role: u.role, status: u.status };
  }

  /** Login via SSO (Authorization Code). Upsert user + tautkan ssoSub; hormati peran manual. */
  async loginWithSso(profile: {
    sub: string;
    email: string;
    name: string;
    mappedRole: 'penguji' | 'peserta' | 'pending';
  }): Promise<{ token: string; user: UserRow } | { pending: true; user: UserRow }> {
    const email = profile.email.toLowerCase().trim();
    let user =
      (await this.prisma.user.findUnique({ where: { ssoSub: profile.sub } })) ??
      (await this.prisma.user.findUnique({ where: { email } }));

    if (!user) {
      // Pengguna baru: peran mengikuti pemetaan klaim SSO; tak dikenal -> pending.
      const status = profile.mappedRole === 'pending' ? 'pending' : 'active';
      const role = profile.mappedRole === 'pending' ? 'peserta' : profile.mappedRole;
      user = await this.prisma.user.create({
        data: { email, name: profile.name, role, status, ssoSub: profile.sub, code: deriveUserCode(email) },
      });
    } else {
      // Sudah ada: tautkan ssoSub bila belum. JANGAN turunkan peran yang sudah diberikan manual.
      await this.prisma.user.update({
        where: { id: user.id },
        data: { ssoSub: user.ssoSub ?? profile.sub, code: user.code ?? deriveUserCode(email), lastLoginAt: new Date() },
      });
      user = await this.prisma.user.findUnique({ where: { id: user.id } });
    }
    if (!user) throw new UnauthorizedException('Gagal membuat sesi SSO.');
    if (user.status === 'suspended') throw new UnauthorizedException('Akun dinonaktifkan.');
    if (user.status === 'pending') return { pending: true, user: this.publicUser(user) };

    const token = await this.createSession(user.id);
    return { token, user: this.publicUser(user) };
  }

  async createAccount(
    email: string,
    name: string,
    password: string,
    role: 'penguji' | 'peserta' = 'penguji',
    status: 'active' | 'pending' = 'active',
  ) {
    const normEmail = email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email: normEmail },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('Email sudah terdaftar.');
    const created = await this.prisma.user.create({
      data: {
        email: normEmail,
        name,
        role,
        status,
        passwordHash: await this.hash(password),
        code: deriveUserCode(normEmail),
      },
    });
    return this.publicUser(created);
  }

  /** ACC/aktivasi atau penonaktifan akun oleh super admin.
   *  Akun `pending` (mis. staff dari SSO) yang di-ACC otomatis jadi `penguji`. */
  async setStatus(id: string, status: 'active' | 'suspended' | 'pending') {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { status: true, role: true },
    });
    if (!current) throw new NotFoundException('Akun tidak ditemukan.');
    const data: { status: string; role?: string } = { status };
    if (status === 'active' && current.status === 'pending' && current.role !== 'superadmin') {
      data.role = 'penguji';
    }
    const updated = await this.prisma.user.update({ where: { id }, data });
    return this.publicUser(updated);
  }

  listUsers() {
    return this.prisma.user.findMany({
      select: { id: true, code: true, email: true, name: true, role: true, status: true, lastLoginAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
