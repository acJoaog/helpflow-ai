import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { $queryRaw: jest.Mock; refreshToken: { create: jest.Mock } };
  let jwt: { sign: jest.Mock };

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    jwt = { sign: jest.fn().mockReturnValue('signed-jwt') };

    service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService);
  });

  describe('login', () => {
    it('lança UnauthorizedException quando o e-mail não existe', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.login({ email: 'ninguem@example.com', password: 'qualquer' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lança UnauthorizedException quando a senha está incorreta', async () => {
      const passwordHash = await bcrypt.hash('senha-correta', 4);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'user-1', tenant_id: 'tenant-1', password_hash: passwordHash, role: 'ADMIN' },
      ]);

      await expect(
        service.login({ email: 'admin@example.com', password: 'senha-errada' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('emite tokens quando as credenciais estão corretas', async () => {
      const passwordHash = await bcrypt.hash('senha-correta', 4);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'user-1', tenant_id: 'tenant-1', password_hash: passwordHash, role: 'ADMIN' },
      ]);

      const result = await service.login({ email: 'admin@example.com', password: 'senha-correta' });

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.refreshToken).toBeDefined();
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', tenantId: 'tenant-1', role: 'ADMIN' }),
        expect.any(Object),
      );
      // O refresh token nunca deve ser persistido em texto puro
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenHash: expect.not.stringContaining(result.refreshToken),
          }),
        }),
      );
    });
  });
});
