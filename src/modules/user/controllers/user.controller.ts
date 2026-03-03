import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {UserService} from '../services/user.service';
import { UserResponseDto } from '../dto/UserResponseDto';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';

export interface MRequest extends Request {
    user?: {
        id: string;
        email: string;
        provider: string
    };
}

@Controller('user')
export class UserController {

    constructor(private readonly userService: UserService) {
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getInfoUser(@Req() req: MRequest): Promise<UserResponseDto> {
        return await this.userService.getInfo(req.user?.id!)
    }

    @Get('lastTracks')
    @UseGuards(JwtAuthGuard)
    async getLastTracks(@Req() req: MRequest) {
        return await this.userService.lastTracks(req.user?.id!)
    }

    // @Get('savedTracks')
    // @UseGuards(AuthGuard)
    // async getSavedMusics(@Req() req: MRequest) {
    //     return await this.userService.getSavedTracks(req.user?.id!)
    // }

    @Get('mood')
    @UseGuards(JwtAuthGuard)
    async getMoodUser(@Req() req: MRequest) {
        return await this.userService.getMoodUserToday(req.user?.id!)
    }

    @Get('refreshMood')
    @UseGuards(JwtAuthGuard)
    async RefreshMoodUser(@Req() req: MRequest) {
        return await this.userService.RefreshMoodUserToday(req.user?.id!)
    }

}
