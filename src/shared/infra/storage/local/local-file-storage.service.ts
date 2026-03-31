import { Injectable } from "@nestjs/common";
import { promises as fs } from "fs";
import { join, extname } from "path";
import { randomUUID } from "crypto";
import { FileStorageService, UploadFile } from "../interfaces/file-storage.interface";

@Injectable()
export class LocalFileStorageService implements FileStorageService {
    private readonly uploadsDir = join(process.cwd(), "uploads", "faces");
    private readonly publicPrefix = "/api/uploads/faces/";

    async uploadMoodPhoto(file: UploadFile, userId: any): Promise<string> {
        await fs.mkdir(this.uploadsDir, { recursive: true });

        const safeExt = extname(file.originalname || "").toLowerCase() || ".jpg";
        const fileName = `${userId}-${randomUUID()}${safeExt}`;
        const fullPath = join(this.uploadsDir, fileName);

        await fs.writeFile(fullPath, file.buffer);

        return `${this.publicPrefix}${fileName}`;
    }
    async uploadFacePhoto(file: UploadFile, userId: string): Promise<string> {
        await fs.mkdir(this.uploadsDir, { recursive: true });

        const safeExt = extname(file.originalname || "").toLowerCase() || ".jpg";
        const fileName = `${userId}-${randomUUID()}${safeExt}`;
        const fullPath = join(this.uploadsDir, fileName);

        await fs.writeFile(fullPath, file.buffer);

        return `${this.publicPrefix}${fileName}`;
    }

    async deleteFacePhoto(path: string): Promise<void> {
        if (!path || !path.startsWith(this.publicPrefix)) return;

        const fileName = path.slice(this.publicPrefix.length);
        if (!fileName || fileName.includes("/") || fileName.includes("\\")) return;

        const fullPath = join(this.uploadsDir, fileName);

        try {
            await fs.unlink(fullPath);
        } catch (error: any) {
            if (error?.code !== "ENOENT") {
                throw error;
            }
        }
    }
}
