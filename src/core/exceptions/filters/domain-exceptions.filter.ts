import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { DomainException } from '../domain-exceptions';
import { Response, Request } from 'express';
import { mapDomainCodeToHttpStatus } from './map-domain-code-to-http-status';
import { DomainExceptionCode } from '../domain-exception-codes';

@Catch(DomainException)
export class DomainHttpExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainHttpExceptionsFilter.name);

  catch(exception: DomainException, host: ArgumentsHost): void {
    const timestamp = new Date().toISOString();
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = mapDomainCodeToHttpStatus(exception.code);
    const responseBody = this.buildResponseBody(exception);

    // Логируем информацию об исключении
    const method = request.method || 'UNKNOWN';
    const url = request.url || 'UNKNOWN';
    const domainCodeName =
      DomainExceptionCode[exception.code] || `CODE_${exception.code}`;

    this.logger.error(
      `[${timestamp}] [DomainHttpExceptionsFilter.catch] EXCEPTION HANDLED - ` +
        `Method: ${method}, URL: ${url}, ` +
        `DomainExceptionCode: ${domainCodeName} (${exception.code}), ` +
        `HTTP Status: ${status}, ` +
        `Message: "${exception.message}", ` +
        `Field: "${exception.field}"`,
    );

    response.status(status).json(responseBody);
  }

  private buildResponseBody(exception: DomainException): {
    errorsMessages: Array<{ message: string; field: string }>;
  } {
    // Если есть массив extensions — возвращаем его (валидация или бизнес-ошибка с несколькими полями)
    if (
      Array.isArray(exception.extensions) &&
      exception.extensions.length > 0
    ) {
      const errorsMessages = exception.extensions.map((ext) => ({
        message: ext.message,
        field: ext.key,
      }));
      return { errorsMessages };
    }

    // Иначе — одна ошибка
    return {
      errorsMessages: [
        {
          message: exception.message,
          field: exception.field,
        },
      ],
    };
  }
}
