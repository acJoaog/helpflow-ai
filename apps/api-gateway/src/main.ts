import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // US-903 — cabeçalhos de segurança básicos (OWASP)
  app.use(helmet());

  // Rejeita qualquer campo não declarado nos DTOs — reduz superfície de
  // ataque de mass assignment
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? [],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
   
  console.log(`api-gateway rodando na porta ${port}`);
}

bootstrap();
