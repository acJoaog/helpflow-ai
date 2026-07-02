import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Para toda rota que passou por JwtAuthGuard (logo `request.user` já está
 * populado), abre uma transação com `app.current_tenant` setado e mantém
 * esse contexto disponível via AsyncLocalStorage durante toda a execução
 * do handler — inclusive dentro dos services chamados por ele.
 *
 * Rotas públicas (sem `request.user`, ex.: login, register-tenant) passam
 * direto, sem transação/contexto de tenant — ver ADR-0004 para os fluxos
 * que precisam operar antes do tenant ser conhecido.
 *
 * Trade-off aceito: a transação fica aberta pela duração inteira do
 * request autenticado (não só das queries). Para os endpoints atuais,
 * que são operações rápidas e majoritariamente de banco, isso é aceitável;
 * se o serviço passar a fazer chamadas externas lentas dentro de rotas
 * autenticadas, vale revisitar (ex.: mover para uma transação mais estreita
 * dentro do service específico).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.user?.tenantId;

    if (!tenantId) {
      return next.handle();
    }

    return from(this.prisma.runInTenantContext(tenantId, () => firstValueFrom(next.handle())));
  }
}
