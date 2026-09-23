import { IsIn, IsInt, Max, Min } from 'class-validator';
import { EMOTION_CLUSTERS } from 'src/shared/infra/IA/emotion-analysis.service';

export class JourneyPlaylistDto {
    @IsIn(EMOTION_CLUSTERS, { message: `Sentimento de partida inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    from!: string;

    @IsIn(EMOTION_CLUSTERS, { message: `Sentimento de chegada inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    to!: string;

    @IsInt({ message: 'A duração deve ser um número inteiro de minutos.' })
    @Min(10, { message: 'A duração mínima é 10 minutos.' })
    @Max(90, { message: 'A duração máxima é 90 minutos.' })
    durationMin!: number;
}
