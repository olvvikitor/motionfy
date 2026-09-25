import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { UserRepository } from "../../user/repository/user.repository";
import { JwtService } from "@nestjs/jwt";
import { FILE_STORAGE } from "src/shared/infra/storage/interfaces/file-storage.interface";
import type { FileStorageService, UploadFile } from "src/shared/infra/storage/interfaces/file-storage.interface";

// Mensagem usada pelo controller para mandar de volta ao login com o aviso certo.
export const SIGNUP_CLOSED = 'Contas novas são criadas pelo Last.fm.';

@Injectable()
export class CreateUserService {
    constructor(
        private userRepository: UserRepository,
        private jwtService: JwtService,
        @Inject(FILE_STORAGE) private readonly fileStorage: FileStorageService,
    ) { }

    // allowNew = false: só entra quem já tem conta (contas novas só pelo Last.fm).
    async create(data: User, provider: string, { allowNew = true } = {}): Promise<{ token: string; isNewUser: boolean }> {
        // Sem e-mail (Last.fm) a busca por e-mail pegaria qualquer conta sem e-mail: usa o id.
        const user = data.email
            ? await this.userRepository.getUserByEmail(data.email, provider)
            : await this.userRepository.getUserById(data.id);
        if (!user && !allowNew) throw new ForbiddenException(SIGNUP_CLOSED);
        if (!user) {
            await this.userRepository.createNewUser(data);
        } else if (data.refreshToken) {
            // Guarda o refresh token do login mais recente: ele carrega as permissões atuais
            // (o antigo continua com as de quando a conta foi criada). No Last.fm é a session key.
            await this.userRepository.updateTokens(user.id, data.accessToken!, data.refreshToken);
        } else {
            await this.userRepository.update(data.id, data.accessToken!);
        }

        const token = this.jwtService.sign({
            id: data.id,
            email: data.email,
            provider: data.provider,
        });

        return { token, isNewUser: !user };
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
