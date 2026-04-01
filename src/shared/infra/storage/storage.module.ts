import { Module } from "@nestjs/common";
import { LocalFileStorageService } from "./local/local-file-storage.service";
import { FILE_STORAGE } from "./interfaces/file-storage.interface";
import { ImageKitProvider } from "./local/imageKit-storage.provider";

@Module({
    providers: [
        ImageKitProvider,
        {
            provide: FILE_STORAGE,
            useExisting: ImageKitProvider,
        },
    ],
    exports: [FILE_STORAGE],
})
export class StorageModule {}
