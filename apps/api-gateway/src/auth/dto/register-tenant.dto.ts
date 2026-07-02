import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  @MinLength(2, { message: 'Nome da empresa deve ter ao menos 2 caracteres' })
  companyName!: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  adminEmail!: string;

  @IsString()
  @MinLength(8, { message: 'Senha deve ter ao menos 8 caracteres' })
  adminPassword!: string;
}
