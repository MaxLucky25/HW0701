import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import { IsStringWithTrim } from '../../../../../core/decorators/validation/is-string-with-trim';
import { loginConstraints, passwordConstraints } from './user-constraints';
import { Trim } from '../../../../../core/decorators/transform/trim';

export class CreateUserInputDto {
  @ApiProperty({ example: 'user123', description: 'Login' })
  @IsStringWithTrim(loginConstraints.minLength, loginConstraints.maxLength)
  login: string;

  @ApiProperty({ example: 'password', description: 'Password' })
  @IsStringWithTrim(
    passwordConstraints.minLength,
    passwordConstraints.maxLength,
  )
  password: string;

  @ApiProperty({ example: 'user@mail.com', description: 'Email' })
  @IsString()
  @Trim()
  @IsEmail()
  email: string;
}
