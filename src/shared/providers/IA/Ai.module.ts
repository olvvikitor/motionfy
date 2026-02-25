import { Module } from "@nestjs/common";
import { AiService } from "./Ai.service";

@Module({
    providers:[AiService],
    exports:[AiService],
})
export class AiModule{}