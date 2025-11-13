import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateUserInputDto {
  @ApiProperty({ example: 'user@mail.com', description: 'Email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'newlogin', description: 'Login' })
  @IsString()
  @MinLength(3)
  @MaxLength(10)
  login: string;
}
