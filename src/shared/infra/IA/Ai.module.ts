import { Module } from "@nestjs/common";
import { AiService } from "./Ai.service";
import { EmotionAnalysisService } from "./emotion-analysis.service";

@Module({
    providers:[AiService, EmotionAnalysisService],
    exports:[AiService],
})
export class AiModule{}