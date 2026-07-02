import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { tenantContext } from '../common/tenant-context';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, label = 'valor'): void {
  // SET LOCAL não aceita bind parameters no protocolo do Postgres, então
  // esses valores acabam sendo interpolados como string — por isso
  // validamos o formato antes, como defesa em profundidade contra SQL
  // injection nesse ponto específico do código.
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${label} inválido: formato UUID esperado`);
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Cliente Prisma a ser usado por todo código de negócio.
   *
   * Se houver um contexto de tenant ativo no AsyncLocalStorage (setado
   * pelo TenantContextInterceptor para toda rota autenticada), retorna o
   * client de transação com `app.current_tenant` já configurado via
   * SET LOCAL — o que faz o Row-Level Security do Postgres realmente
   * filtrar as queries (ver ADR-0001 e ADR-0004).
   *
   * Fora de um request autenticado (ex.: registro de tenant, login),
   * retorna o client "cru" — sem contexto de tenant, pois nesses fluxos
   * o tenant_id ainda não é conhecido ou o acesso passa por uma função
   * SECURITY DEFINER dedicada (ver ADR-0004).
   */
  get db(): PrismaClient | Prisma.TransactionClient {
    return tenantContext.getStore()?.tx ?? this;
  }

  /**
   * Roda `callback` com o contexto de tenant setado na sessão do banco
   * (SET LOCAL app.current_tenant) durante toda a duração de uma
   * transação. Usado pelo TenantContextInterceptor para envolver requests
   * autenticados inteiros — services não precisam chamar isso diretamente,
   * apenas usar `this.prisma.db` nas queries.
   */
  async runInTenantContext<T>(tenantId: string, callback: () => Promise<T>): Promise<T> {
    assertUuid(tenantId, 'tenantId');

    return this.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`);
      return tenantContext.run({ tx, tenantId }, callback);
    });
  }
}
