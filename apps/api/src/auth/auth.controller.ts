import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  Req,
  Res
} from '@nestjs/common';
import { loginRequestSchema, signupRequestSchema } from '@sdc/shared-types';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service.js';
import { AUTH_COOKIE_NAME, clearAuthCookie, parseCookieValue, setAuthCookie } from './auth-cookie.util.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('signup')
  async signup(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body() body: unknown
  ) {
    const parsed = signupRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const response = await this.authService.signup(parsed.data);
    setAuthCookie(reply, request, response.token);
    return response;
  }

  @Post('login')
  async login(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body() body: unknown
  ) {
    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const response = await this.authService.login(parsed.data);
    setAuthCookie(reply, request, response.token);
    return response;
  }

  @Post('logout')
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const cookieToken = parseCookieValue(request.headers.cookie, AUTH_COOKIE_NAME);
    const authHeader = request.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : null;
    await this.authService.logoutByToken(cookieToken || bearerToken);
    clearAuthCookie(reply, request);
    return {
      ok: true
    };
  }
}
