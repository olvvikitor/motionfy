import { Body, Controller, Get, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {UserService} from '../services/user.service';
import { UserResponseDto } from '../dto/UserResponseDto';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import { CreateUserService } from '../services/create.user.service';

export interface MRequest extends Request {
    user?: {
        id: string;
        email: string;
        provider: string
    };
}

@Controller('user')
export class UserController {

    constructor(private readonly userService: UserService, private readonly crateUser:CreateUserService) {
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

    @Put('updateAfterCreate')
    @UseGuards(JwtAuthGuard)
    async updateAfterCreate(@Body() payload:{data: { push: true, email: true, weekly: true }},  @Req() req:MRequest){
       return await this.crateUser.updateAfterCreate(req.user?.id!,payload.data) 
    }

    @Get('refreshMood')
    @UseGuards(JwtAuthGuard)
    async RefreshMoodUser(@Req() req: MRequest) {
        return await this.userService.RefreshMoodUserToday(req.user?.id!)
    }

}
