import { BadRequestException, Body, Controller, Get, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Request } from 'express';
import { UserService } from '../services/user.service';
import { UserResponseDto } from '../dto/UserResponseDto';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import { CreateUserService } from '../services/create.user.service';
import { UpdateAfterCreateDto } from '../dto/UpdateAfterCreateDto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadFile } from 'src/shared/infra/storage/interfaces/file-storage.interface';

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

    @Post('upload-face-photo')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file', {
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
        fileFilter: (_req, file, cb) => {
            const isImage = /^image\/(jpeg|png|webp)$/.test(file.mimetype);
            if (!isImage) {
                return cb(new BadRequestException('Apenas imagens JPEG, PNG ou WEBP.'), false);
            }

            cb(null, true);
        },
    }))
    async uploadFacePhoto(@UploadedFile() file: UploadFile, @Req() req: MRequest) {
        if (!file) {
            throw new BadRequestException('Arquivo de imagem não enviado.');
        }

        return await this.createUser.uploadFacePhoto(req.user!.id, file);
    }

    @Put('face-photo')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file', {
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
        fileFilter: (_req, file, cb) => {
            const isImage = /^image\/(jpeg|png|webp)$/.test(file.mimetype);
            if (!isImage) {
                return cb(new BadRequestException('Apenas imagens JPEG, PNG ou WEBP.'), false);
            }

            cb(null, true);
        },
    }))
    async updateFacePhoto(@UploadedFile() file: UploadFile, @Req() req: MRequest) {
        if (!file) {
            throw new BadRequestException('Arquivo de imagem não enviado.');
        }

        return await this.createUser.uploadFacePhoto(req.user!.id, file);
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
