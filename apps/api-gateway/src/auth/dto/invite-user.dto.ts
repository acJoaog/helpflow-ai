import { IsEmail, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class InviteUserDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @IsEnum(Role, { message: 'Papel deve ser ADMIN ou AGENT' })
  role!: Role;
}
