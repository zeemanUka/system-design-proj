import { BadRequestException, Body, Controller, Inject, Post } from '@nestjs/common';
import { loginRequestSchema, signupRequestSchema } from '@sdc/shared-types';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() body: unknown) {
    const parsed = signupRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.authService.signup(parsed.data);
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.authService.login(parsed.data);
  }
}
