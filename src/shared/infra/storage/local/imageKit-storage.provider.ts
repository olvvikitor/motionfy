import { extname, join } from "path";
import { FileStorageService, UploadFile } from "../interfaces/file-storage.interface";
import ImageKit from "imagekit";
import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ImageKitProvider implements FileStorageService {
    private publicKey: string = process.env.IMAGEKIT_PUBLIC_KEY as string
    private privateKey: string = process.env.IMAGEKIT_PRIVATE_KEY as string
    private urlEndpoint: string = process.env.IMAGEKIT_URL as string

    private imageKit = new ImageKit({
        privateKey: this.privateKey,
        publicKey: this.publicKey,
        urlEndpoint: this.urlEndpoint
    }
    )


    async uploadFacePhoto(file: UploadFile, userId: string): Promise<string> {
        const safeExt = extname(file.originalname || "").toLowerCase() || ".jpg";
        const fileName = `${randomUUID()}${safeExt}`;
        const result = await this.imageKit.upload({
            file: file.buffer, // buffer da imagem
            fileName: fileName,
            folder: "/faces",
        });

        return result.url
    }
    async deleteFacePhoto(path: string): Promise<void> {
        // Para URLs do ImageKit, o delete requer fileId.
        // Como hoje armazenamos apenas a URL, fazemos no-op para não quebrar o fluxo.
        return;
    }
    async uploadMoodPhoto(file: UploadFile, userId: any): Promise<string> {
        const safeExt = extname(file.originalname || "").toLowerCase() || ".jpg";
        const fileName = `${randomUUID()}${safeExt}`;
        const result = await this.imageKit.upload({
            file: file.buffer, // buffer da imagem
            fileName: fileName,
            folder: "/moods",
        });

        return result.url
    }

}