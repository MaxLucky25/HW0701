import { ApiProperty } from '@nestjs/swagger';
import { Session } from '../../domain/session.entity';

export class DeviceViewDto {
  @ApiProperty({
    description: 'Unique device identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  deviceId: string;

  @ApiProperty({
    description:
      'Device name: for example Chrome 105 (received by parsing http header "user-agent")',
    example: 'Chrome 105',
  })
  title: string;

  @ApiProperty({
    description: 'Device IP address',
    example: '192.168.1.100',
  })
  ip: string;

  @ApiProperty({
    description: 'Last activity date',
    example: '2023-12-01T10:30:00.000Z',
  })
  lastActiveDate: string;

  static mapToView(session: Session): DeviceViewDto {
    return {
      deviceId: session.deviceId,
      title: this.parseUserAgent(session.userAgent),
      ip: session.ip,
      lastActiveDate: session.lastActiveDate.toISOString(),
    };
  }

  private static parseUserAgent(userAgent: string): string {
    // Один regex для всех браузеров
    const match = userAgent.match(
      /(Chrome|Firefox|Safari|Edg|OPR|Opera)\/(\d+)/,
    );
    return match ? `${match[1]} ${match[2]}` : 'Unknown Browser';
  }
}
