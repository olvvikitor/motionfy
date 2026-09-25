export type UploadFile = {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
};

export interface FileStorageService {
    uploadFacePhoto(file: UploadFile, userId: string): Promise<string>;
    deleteFacePhoto(path: string): Promise<void>;
    // Capa das playlists criadas na conta do Mofy (destaque do perfil).
    uploadPlaylistCover(file: UploadFile, userId: string): Promise<string>
}

export const FILE_STORAGE = Symbol("FILE_STORAGE");
