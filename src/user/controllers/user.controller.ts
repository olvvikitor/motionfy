import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from 'src/shared/providers/jwt/authGuardService';
import UserService from '../services/user.service';
import { UserResponseDto } from '../dto/UserResponseDto';
export interface MRequest extends Request {
    user?: {
        id: string;
        email: string;
    };
}

@Controller('user')
export class UserController {

    constructor(private userService:UserService) {
    }

    @Get('me')
    @UseGuards(AuthGuard)
    async getInfoUser(@Req() req: MRequest):Promise<UserResponseDto> {
        return await this.userService.getInfo(req.user?.id!)
    }

    @Get('lastTracks')
    @UseGuards(AuthGuard)
    async getLastGet(@Req() req:MRequest){
        return await this.userService.lastTracks(req.user?.id!)
    }

    @Get('savedTracks')
    @UseGuards(AuthGuard)
    async getSavedMusics(@Req() req:MRequest){
        return await this.userService.getSavedTracks(req.user?.id!)
    }
    
    @Get('mood')
    @UseGuards(AuthGuard)
    async getMoodUser(@Req() req:MRequest){
        return await this.userService.getMoodUserToday(req.user?.id!)
    }
    
    @Get('refreshMood')
    @UseGuards(AuthGuard)
    async RefreshMoodUser(@Req() req:MRequest){
        return await this.userService.RefreshMoodUserToday(req.user?.id!)
    }

}
