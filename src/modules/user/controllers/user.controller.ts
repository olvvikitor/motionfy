import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserService } from '../services/user.service';
import { UserResponseDto } from '../dto/UserResponseDto';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import { CreateUserService } from '../services/create.user.service';
import { UpdateAfterCreateDto } from '../dto/UpdateAfterCreateDto';

export interface MRequest extends Request {
    user?: {
        id: string;
        email: string;
        provider: string;
    };
}

@Controller('user')
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly createUser: CreateUserService,
    ) { }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getInfoUser(@Req() req: MRequest): Promise<UserResponseDto> {
        return await this.userService.getInfo(req.user!.id);
    }

    @Get('lastTracks')
    @UseGuards(JwtAuthGuard)
    async getLastTracks(@Req() req: MRequest) {
        return await this.userService.lastTracks(req.user!.id);
    }

    @Get('mood')
    @UseGuards(JwtAuthGuard)
    async getMoodUser(@Req() req: MRequest) {
        return await this.userService.getMoodUserToday(req.user!.id);
    }

    @Put('updateAfterCreate')
    @UseGuards(JwtAuthGuard)
    async updateAfterCreate(@Body() payload: UpdateAfterCreateDto, @Req() req: MRequest) {
        return await this.createUser.updateAfterCreate(req.user!.id, payload.data);
    }

    @Get('refreshMood')
    @UseGuards(JwtAuthGuard)
    async RefreshMoodUser(@Req() req: MRequest) {
        return await this.userService.RefreshMoodUserToday(req.user!.id);
    }

    @Get('musicListeningNow')
    @UseGuards(JwtAuthGuard)
    async getMusicListenNow(@Req() req: MRequest) {
        return await this.userService.listeningNow(req.user!.id)
    }
}
