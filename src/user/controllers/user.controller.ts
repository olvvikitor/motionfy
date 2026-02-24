import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/shared/providers/jwt/authGuardService';


@Controller('user')
export class UserController {

    @Get('me')
    @UseGuards(AuthGuard)
    async getInfoUser(re){
    }
  }
