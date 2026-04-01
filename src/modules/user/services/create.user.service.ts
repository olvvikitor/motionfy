import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { UserRepository } from "../../user/repository/user.repository";
import { JwtService } from "@nestjs/jwt";
import { FILE_STORAGE } from "src/shared/infra/storage/interfaces/file-storage.interface";
import type { FileStorageService, UploadFile } from "src/shared/infra/storage/interfaces/file-storage.interface";

@Injectable()
export class CreateUserService {
    constructor(
        private userRepository: UserRepository,
        private jwtService: JwtService,
        @Inject(FILE_STORAGE) private readonly fileStorage: FileStorageService,
    ) { }

    async create(data: User, provider: string): Promise<string> {
        const user = await this.userRepository.getUserByEmail(data.email!, provider);
        if (!user) {
            await this.userRepository.createNewUser(data);
        } else {
            await this.userRepository.update(data.id, data.accessToken!);
        }

        const token = this.jwtService.sign({
            id: data.id,
            email: data.email,
            provider: data.provider,
        });

        return token;
    }

    async updateAfterCreate(id_user: string, data: { push: boolean; email: boolean; weekly: boolean }): Promise<void> {
        const user = await this.userRepository.getUserById(id_user);
        if (!user) {
            throw new BadRequestException('Refaça o procedimento de criação');
        }
        await this.userRepository.updateAfterCreate(id_user, data);
    }

    async uploadFacePhoto(id_user: string, file: UploadFile): Promise<{ path: string }> {
        const user = await this.userRepository.getUserById(id_user);
        if (!user) {
            throw new BadRequestException('Refaça o procedimento de criação');
        }

        if (user.face_photo_path) {
            try {
                await this.fileStorage.deleteFacePhoto(user.face_photo_path);
            } catch (error) {
                console.warn('Falha ao remover foto anterior do usuário:', error);
            }
        }

        const path = await this.fileStorage.uploadFacePhoto(file, id_user);
        await this.userRepository.updateFacePhotoPath(id_user, path);

        return { path };
    }
}
