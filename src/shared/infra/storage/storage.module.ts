import { Module } from "@nestjs/common";
import { LocalFileStorageService } from "./local/local-file-storage.service";
import { FILE_STORAGE } from "./interfaces/file-storage.interface";

@Module({
    providers: [
        LocalFileStorageService,
        {
            provide: FILE_STORAGE,
            useExisting: LocalFileStorageService,
        },
    ],
    exports: [FILE_STORAGE],
})
export class StorageModule {}
