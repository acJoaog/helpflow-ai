import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService, assertUuid } from '../prisma/prisma.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import { InviteUserDto } from './dto/invite-user.dto';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;
const INVITE_TTL_HOURS = 72;

interface AuthLookupUserRow {
  id: string;
  tenant_id: string;
  password_hash: string;
  role: Role;
}

interface AuthLookupUserByIdRow {
  id: string;
  tenant_id: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * US-101 — cria um tenant novo com seu primeiro usuário admin.
   *
   * Roda numa transação própria (fora do TenantContextInterceptor, já que
   * esta rota é pública): cria o tenant, define `app.current_tenant` para
   * o ID recém-criado NA MESMA transação, e só então insere o usuário
   * admin — assim o INSERT em `users` já satisfaz a política de RLS
   * (ver migration 20260701040000_add_row_level_security), sem precisar
   * de nenhum bypass para este fluxo.
   */
  async registerTenant(dto: RegisterTenantDto) {
    const passwordHash = await bcrypt.hash(dto.adminPassword, BCRYPT_ROUNDS);

    const tenant = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdTenant = await tx.tenant.create({
        data: { name: dto.companyName },
      });

      assertUuid(createdTenant.id, 'tenantId recém-criado');
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${createdTenant.id}'`);

      await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          email: dto.adminEmail.toLowerCase(),
          passwordHash,
          role: 'ADMIN',
        },
      });

      return createdTenant;
    });

    return { tenantId: tenant.id };
  }

  /**
   * US-102 — login com e-mail e senha.
   *
   * Antes do login, o tenant_id do usuário é desconhecido — não há
   * contexto para setar `app.current_tenant`, e com RLS forçado a query
   * comum do Prisma (`prisma.user.findFirst`) não retornaria nada. Por
   * isso a busca passa pela função SECURITY DEFINER `auth_lookup_user_by_email`
   * (ver ADR-0004), que roda com privilégio elevado só para esta consulta
   * estreita, e nunca para o restante do sistema.
   */
  async login(dto: LoginDto) {
    const rows = await this.prisma.$queryRaw<AuthLookupUserRow[]>`
      SELECT * FROM auth_lookup_user_by_email(${dto.email.toLowerCase()})
    `;
    const user = rows[0];

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.issueTokens(user.id, user.tenant_id, user.role);
  }

  /**
   * Mesma lógica do login: no momento da renovação, o request ainda não
   * passou pelo TenantContextInterceptor (a rota é pública, autenticada só
   * pelo refresh token no corpo), então a consulta a `users` também passa
   * pela função SECURITY DEFINER dedicada.
   */
  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const rows = await this.prisma.$queryRaw<AuthLookupUserByIdRow[]>`
      SELECT * FROM auth_lookup_user_by_id(${stored.userId}::uuid)
    `;
    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Rotação: revoga o token usado e emite um par novo
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.issueTokens(user.id, user.tenant_id, user.role);
  }

  /**
   * US-103 — cria um convite pendente.
   *
   * Esta rota exige JwtAuthGuard, então o TenantContextInterceptor já
   * setou `app.current_tenant` antes do controller chamar este método —
   * por isso aqui usamos `this.prisma.db` (não `this.prisma` direto),
   * que resolve para o client de transação com RLS ativo.
   */
  async inviteUser(tenantId: string, dto: InviteUserDto) {
    const existing = await this.prisma.db.user.findFirst({
      where: { tenantId, email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail neste tenant');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

    const invite = await this.prisma.db.invite.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        role: dto.role,
        token,
        expiresAt,
      },
    });

    // TODO (US futura): disparar e-mail de convite via serviço de notificação
    return { inviteId: invite.id, token: invite.token, expiresAt: invite.expiresAt };
  }

  private async issueTokens(userId: string, tenantId: string, role: string) {
    const accessToken = this.jwt.sign(
      { sub: userId, tenantId, role },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = this.hashToken(refreshTokenRaw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    // Emissão de token roda fora do contexto de tenant (chamada tanto por
    // login quanto por refresh, ambos pré-autenticação) — refresh_tokens
    // não tem RLS (ver ADR-0004, seção de trade-offs aceitos), então isso
    // é seguro sem SET LOCAL adicional.
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: refreshTokenHash, expiresAt },
    });

    return { accessToken, refreshToken: refreshTokenRaw };
  }

  private hashToken(token: string): string {
    // Refresh tokens são hasheados antes de ir pro banco — mesmo em caso de
    // vazamento do banco, os tokens em si não ficam expostos em texto puro.
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
