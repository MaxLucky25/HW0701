import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ResponseWithCookies } from '../../../../types/express-typed';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MeViewDto } from '../../user-accounts/api/view-dto/users.view-dto';
import { CreateUserInputDto } from '../../user-accounts/api/input-dto/users.input-dto';
import { LocalAuthGuard } from '../../guards/local/local-auth.guard';
import { JwtAuthGuard } from '../../guards/bearer/jwt-auth-guard';
import { RefreshTokenAuthGuard } from '../../guards/bearer/refresh-token-auth.guard';
import { UserContextDto } from '../../guards/dto/user-context.dto';
import { TokenContextDto } from '../../guards/dto/token-context.dto';
import { Cookies } from '../../guards/decorators/param/cookies.decorator';
import { PasswordRecoveryInputDto } from './input-dto/password-recovery.input.dto';
import { NewPasswordInputDto } from './input-dto/new-password.input.dto';
import { RegistrationConfirmationInputDto } from './input-dto/registration-confirmation.input.dto';
import { RegistrationEmailResendingInputDto } from './input-dto/registration-email-resending.input.dto';
import { LoginInputDto } from './input-dto/login.input.dto';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RegistrationUserCommand } from '../application/usecase/register-user.usecase';
import { LoginUserCommand } from '../application/usecase/login-user.usecase';
import { LoginResponseDto } from './view-dto/login.view-dto';
import { PasswordRecoveryCommand } from '../application/usecase/password-recovery.usecase';
import { NewPasswordCommand } from '../application/usecase/new-password.usecase';
import { RegistrationConfirmationCommand } from '../application/usecase/registration-confirmation.usecase';
import { RegistrationEmailResendingCommand } from '../application/usecase/registration-email-resending.usecase';
import { AuthMeQuery } from '../application/query-usecase/auth-me.usecase';
import { RefreshTokenCommand } from '../application/usecase/refresh-token.usecase';
import { LogoutUserCommand } from '../application/usecase/logout-user.usecase';
import { ExtractUserForJwtGuard } from '../../guards/decorators/param/extract-user-for-jwt-guard.decorator';
import { ExtractUserForRefreshTokenGuard } from '../../guards/decorators/param/extract-user-for-refresh-token-guard.decorator';
import { ExtractIp } from '../../guards/decorators/param/extract-ip.decorator';
import { ExtractUserAgent } from '../../guards/decorators/param/extract-user-agent.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
  ) {}

  @Post('registration')
  @HttpCode(204)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  registration(@Body() body: CreateUserInputDto): Promise<void> {
    return this.commandBus.execute(new RegistrationUserCommand(body));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({
    status: 200,
    description:
      'User logged in successfully, returns access token and sets refresh token in cookie',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        loginOrEmail: { type: 'string', example: 'login123' },
        password: { type: 'string', example: 'superpassword' },
      },
    },
  })
  async login(
    @Body() body: LoginInputDto,
    @ExtractIp() ip: string,
    @ExtractUserAgent() userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    return this.commandBus.execute(
      new LoginUserCommand(body, ip, userAgent, res),
    );
  }

  @Post('password-recovery')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Password recovery via Email confirmation. Email should be sent with RecoveryCode inside',
  })
  @ApiResponse({
    status: 204,
    description:
      "Even if current email is not registered (for prevent user's email detection)",
  })
  @ApiResponse({
    status: 400,
    description:
      'If the inputModel has invalid email (for example 222^gmail.com)',
  })
  @ApiResponse({
    status: 429,
    description: 'More than 5 attempts from one IP-address during 10 seconds',
  })
  @ApiBody({ type: PasswordRecoveryInputDto })
  async passwordRecovery(
    @Body() body: PasswordRecoveryInputDto,
  ): Promise<void> {
    await this.commandBus.execute(new PasswordRecoveryCommand(body));
  }

  @Post('new-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm Password recovery' })
  @ApiResponse({
    status: 204,
    description: 'If code is valid and new password is accepted',
  })
  @ApiResponse({
    status: 400,
    description:
      'If the inputModel has incorrect value (for incorrect password length) or RecoveryCode is incorrect or expired',
  })
  @ApiResponse({
    status: 429,
    description: 'More than 5 attempts from one IP-address during 10 seconds',
  })
  @ApiBody({ type: NewPasswordInputDto })
  async newPassword(@Body() body: NewPasswordInputDto): Promise<void> {
    await this.commandBus.execute(new NewPasswordCommand(body));
  }

  @Post('registration-confirmation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm registration' })
  @ApiResponse({
    status: 204,
    description: 'Email was verified. Account was activated',
  })
  @ApiResponse({
    status: 400,
    description:
      'If the confirmation code is incorrect, expired or already been applied',
  })
  @ApiResponse({
    status: 429,
    description: 'More than 5 attempts from one IP-address during 10 seconds',
  })
  @ApiBody({ type: RegistrationConfirmationInputDto })
  async registrationConfirmation(
    @Body() body: RegistrationConfirmationInputDto,
  ): Promise<void> {
    await this.commandBus.execute(new RegistrationConfirmationCommand(body));
  }

  @Post('registration-email-resending')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Resend confirmation registration Email if user exists',
  })
  @ApiResponse({
    status: 204,
    description:
      'Input data is accepted. Email with confirmation code will be send to passed email address.',
  })
  @ApiResponse({
    status: 400,
    description: 'If the inputModel has incorrect values',
  })
  @ApiResponse({
    status: 429,
    description: 'More than 5 attempts from one IP-address during 10 seconds',
  })
  @ApiBody({ type: RegistrationEmailResendingInputDto })
  async registrationEmailResending(
    @Body() body: RegistrationEmailResendingInputDto,
  ): Promise<void> {
    return this.commandBus.execute(new RegistrationEmailResendingCommand(body));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  @ApiResponse({ status: 200, description: 'Returns user info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@ExtractUserForJwtGuard() user: UserContextDto): Promise<MeViewDto> {
    return this.queryBus.execute(new AuthMeQuery(user));
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshTokenAuthGuard)
  @ApiOperation({
    summary: 'Refresh access token using refresh token from cookie',
  })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed successfully',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @ExtractUserForRefreshTokenGuard() user: TokenContextDto,
    @Cookies() cookies: Record<string, string> | undefined,
    @Res({ passthrough: true }) res: ResponseWithCookies,
  ): Promise<LoginResponseDto> {
    return this.commandBus.execute(new RefreshTokenCommand(user, cookies, res));
  }

  @Post('logout')
  @UseGuards(RefreshTokenAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout user',
    description: 'Revoke refresh token from cookie',
  })
  @ApiResponse({ status: 204, description: 'User logged out successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async logout(
    @ExtractUserForRefreshTokenGuard() user: TokenContextDto,
    @Cookies() cookies: Record<string, string> | undefined,
    @Res({ passthrough: true }) res: ResponseWithCookies,
  ): Promise<void> {
    await this.commandBus.execute(new LogoutUserCommand(user, cookies, res));
  }
}
