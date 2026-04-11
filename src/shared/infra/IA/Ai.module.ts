import { Module } from "@nestjs/common";
import { AiTextService } from "./AiText.service";
import { AiImageService } from "./AiImage.service";
import { EmotionAnalysisService } from "./emotion-analysis.service";
import { ImagePromptService } from "./ImagePrompt.service";

@Module({
    providers: [AiTextService, AiImageService, EmotionAnalysisService, ImagePromptService],
    exports: [AiTextService, AiImageService, ImagePromptService, EmotionAnalysisService],
})
export class AiModule {}