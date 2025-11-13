import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { TokenContextDto } from '../dto/token-context.dto';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('refresh') {
  handleRequest(err: any, user: any): any {
    if (err || !user) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'Invalid refresh token',
        field: 'refreshToken',
      });
    }
    return user as TokenContextDto;
  }
}
