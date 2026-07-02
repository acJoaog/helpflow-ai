import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';

/**
 * Propaga o cliente de transação Prisma (já com `app.current_tenant`
 * setado via SET LOCAL) por toda a cadeia assíncrona de um request.
 *
 * Isso resolve o problema descrito no ADR-0001: "toda query precisa do
 * contexto de tenant configurado" deixaria de ser uma responsabilidade
 * manual de cada service e passa a ser automática — ver TenantContextInterceptor.
 */
export interface TenantStore {
  tx: Prisma.TransactionClient;
  tenantId: string;
}

export const tenantContext = new AsyncLocalStorage<TenantStore>();
