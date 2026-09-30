import { Injectable } from "@nestjs/common";
import { LibraryRepository } from "../repository/library.repository";

// Biblioteca do usuário = tudo o que ele já ouviu (ListeningHistory). Nada é escolhido à mão:
// cada música que chega pelo histórico entra sozinha e é analisada pelo Jev (UserService.analyzeHistory).
@Injectable()
export class LibraryService {
    constructor(private readonly repository: LibraryRepository) { }

    async list(userId: string) {
        const [tracks, total] = await Promise.all([this.repository.list(userId), this.repository.count(userId)]);
        return { total, tracks };
    }
}
