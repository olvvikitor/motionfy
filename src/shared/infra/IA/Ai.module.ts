import { Module } from "@nestjs/common";
import { AiService } from "./Ai.service";
import { EmotionAnalysisService } from "./emotion-analysis.service";
import { ImagePromptService } from "./ImagePrompt.service";

@Module({
    providers:[AiService, EmotionAnalysisService,ImagePromptService],
    exports:[AiService,ImagePromptService],
})
export class AiModule{}