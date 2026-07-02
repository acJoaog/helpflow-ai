import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthLookupUserRow {
  id: string;
  tenant_id: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Usa a mesma função SECURITY DEFINER que o AuthService usa no login —
  // não depende de contexto de tenant, então pode ser chamada livremente
  // nas asserções dos testes sem ser bloqueada pelo RLS.
  async function lookupUserByEmail(email: string) {
    const rows = await prisma.$queryRaw<AuthLookupUserRow[]>`
      SELECT * FROM auth_lookup_user_by_email(${email})
    `;
    return rows[0];
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  // US-101
  it('registra um novo tenant com usuário admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({
        companyName: 'Empresa Teste',
        adminEmail: `admin-${Date.now()}@example.com`,
        adminPassword: 'senha-segura-123',
      })
      .expect(201);

    expect(res.body.tenantId).toBeDefined();
  });

  // US-102
  it('faz login e retorna access + refresh token escopados ao tenant', async () => {
    const email = `login-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/auth/register-tenant').send({
      companyName: 'Empresa Login',
      adminEmail: email,
      adminPassword: 'senha-segura-123',
    });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'senha-segura-123' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('rejeita login com senha incorreta', async () => {
    const email = `wrongpass-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/auth/register-tenant').send({
      companyName: 'Empresa Errada',
      adminEmail: email,
      adminPassword: 'senha-correta-123',
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'senha-errada' })
      .expect(401);
  });

  it('renova o par de tokens via refresh, revogando o token anterior', async () => {
    const email = `refresh-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/auth/register-tenant').send({
      companyName: 'Empresa Refresh',
      adminEmail: email,
      adminPassword: 'senha-segura-123',
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'senha-segura-123' });

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);

    expect(refreshed.body.accessToken).toBeDefined();
    expect(refreshed.body.refreshToken).toBeDefined();
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);

    // Token antigo já foi rotacionado — reuso deve ser rejeitado
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  // US-901 — isolamento de tenant: um usuário de um tenant não pode
  // afetar dados de outro tenant usando o próprio token.
  it('não permite que ADMIN de um tenant afete dados de outro tenant', async () => {
    const emailA = `tenant-a-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/auth/register-tenant').send({
      companyName: 'Tenant A',
      adminEmail: emailA,
      adminPassword: 'senha-segura-123',
    });
    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: emailA, password: 'senha-segura-123' });

    const inviteRes = await request(app.getHttpServer())
      .post('/auth/invite')
      .set('Authorization', `Bearer ${loginA.body.accessToken}`)
      .send({ email: 'novo-atendente@example.com', role: 'AGENT' })
      .expect(201);

    // O convite criado deve pertencer ao tenant do usuário autenticado.
    // Como RLS está de fato ativo, esta consulta de verificação também
    // precisa rodar dentro do contexto de tenant correspondente — do
    // contrário o próprio RLS bloquearia a leitura.
    const userA = await lookupUserByEmail(emailA);
    const invite = await prisma.runInTenantContext(userA!.tenant_id, () =>
      prisma.db.invite.findUnique({ where: { id: inviteRes.body.inviteId } }),
    );

    expect(invite?.tenantId).toBe(userA!.tenant_id);
  });

  // Prova direta de que o RLS está ativo no banco, não só "confiado" pela
  // aplicação: mesmo pedindo explicitamente os dados do Tenant B enquanto
  // a sessão está com o contexto do Tenant A, o Postgres não retorna
  // nenhuma linha. Este é o cenário que mais importa em US-901 — a
  // proteção precisa sobreviver a um bug futuro no código da aplicação que
  // esqueça de filtrar por tenantId numa query nova.
  it('RLS bloqueia no nível do banco mesmo se a aplicação esquecer de filtrar por tenant', async () => {
    const emailA = `rls-a-${Date.now()}@example.com`;
    const emailB = `rls-b-${Date.now()}@example.com`;

    await request(app.getHttpServer()).post('/auth/register-tenant').send({
      companyName: 'RLS Tenant A',
      adminEmail: emailA,
      adminPassword: 'senha-segura-123',
    });
    await request(app.getHttpServer()).post('/auth/register-tenant').send({
      companyName: 'RLS Tenant B',
      adminEmail: emailB,
      adminPassword: 'senha-segura-123',
    });

    const userA = await lookupUserByEmail(emailA);
    const userB = await lookupUserByEmail(emailB);

    const leaked = await prisma.runInTenantContext(userA!.tenant_id, () =>
      prisma.db.user.findMany({ where: { id: userB!.id } }),
    );

    expect(leaked).toHaveLength(0);
  });

  // TODO (US futura — aceite de convite): testar que AGENT recebe 403 ao
  // tentar convidar outros usuários. Requer endpoint de aceite de convite
  // para gerar um token de AGENT válido primeiro.
  it.todo('bloqueia AGENT de convidar novos usuários (RBAC)');
});
