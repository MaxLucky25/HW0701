import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserContextDto } from '../../dto/user-context.dto';

export const ExtractUserIdForJwtOptionalGuard = createParamDecorator(
  (data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user || user === false) {
      return undefined;
    }

    // После проверок выше user гарантированно UserContextDto
    return (user as UserContextDto).id;
  },
);
