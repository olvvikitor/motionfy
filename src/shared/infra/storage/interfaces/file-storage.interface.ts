export type UploadFile = {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
};

export interface FileStorageService {
    uploadFacePhoto(file: UploadFile, userId: string): Promise<string>;
    deleteFacePhoto(path: string): Promise<void>;
}

export const FILE_STORAGE = Symbol("FILE_STORAGE");
