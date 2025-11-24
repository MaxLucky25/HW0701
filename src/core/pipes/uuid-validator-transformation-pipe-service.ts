import { Injectable, PipeTransform, Logger } from '@nestjs/common';
import { DomainException } from '../exceptions/domain-exceptions';
import { DomainExceptionCode } from '../exceptions/domain-exception-codes';

// Встроенная функция валидации UUID
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Not add it globally. Use only locally
 */
@Injectable()
export class UuidValidationPipe implements PipeTransform {
  private readonly logger = new Logger(UuidValidationPipe.name);

  transform(value: any): any {
    const timestamp = new Date().toISOString();
    this.logger.log(
      `[${timestamp}] [UuidValidationPipe.transform] START - Validating UUID value: "${value}" (type: ${typeof value})`,
    );

    // Проверяем, что value является строкой
    if (typeof value !== 'string') {
      this.logger.error(
        `[${timestamp}] [UuidValidationPipe.transform] ERROR - Invalid type: expected string, got ${typeof value}. Value: "${value}"`,
      );
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: `Invalid UUID: expected string, got ${typeof value}`,
        field: 'UUID',
      });
    }

    if (!isValidUUID(value)) {
      this.logger.error(
        `[${timestamp}] [UuidValidationPipe.transform] ERROR - Invalid UUID format: "${value}". Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`,
      );
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: `Invalid UUID: ${value}`,
        field: 'UUID',
      });
    }

    // Если валидация прошла, возвращаем значение без изменений
    this.logger.log(
      `[${timestamp}] [UuidValidationPipe.transform] SUCCESS - UUID validation passed: "${value}"`,
    );
    return value;
  }
}
