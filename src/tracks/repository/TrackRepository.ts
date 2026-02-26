import { Inject, Injectable } from "@nestjs/common";
import { Prisma, Track } from "@prisma/client";
import { PrismaService } from "src/config/prisma.service";

@Injectable()
export class TrackRepository {
    constructor(@Inject() private prisma: PrismaService) {
    }
    async createNewTrack(data: Prisma.TrackCreateInput): Promise<Track> {
        return await this.prisma.track.upsert({
            where: { spotifyId: data.spotifyId! },
            update: {},
            create: data,
        });
    }
    async saveLyrics(trackId: string, lirycs: string) {
        await this.prisma.lyrics.upsert({
            where: { id: trackId },
            update: {},
            create: { content: lirycs, trackId: trackId }
        })
    }
    async saveMood(trackId: string, mood: any) {
        await this.prisma.moodAnalysis.create({
            data: {
                moodScore: mood.moodScore,
                sentiment: mood.sentiment,
                emotions: mood.emotions,
                trackId: trackId
            }
        });
    }
    async findMoodMusicById(trackId: string) {
        return await this.prisma.moodAnalysis.findUnique({
            where: { trackId: trackId }
        });
    }

    async getLyrics(trackId: string) {
        return await this.prisma.lyrics.findUnique({
            where: {
                trackId: trackId
            }
        })
    }
    async getMusicAndMoods() {
        return await this.prisma.track.findMany({
            include: {
                mood: true
            }
        })
    }
    async getTrackById(id: string): Promise<Track | null> {
        return await this.prisma.track.findFirst({
            where: {
                id: id
            }
        })
    }
    async saveHistoryListen(userId:string, trackId:string, playedAt:Date): Promise<any> {
        await this.prisma.listeningHistory.upsert({
           where:{
            userId_trackId_playedAt:{
                playedAt:playedAt, trackId:trackId, userId:userId
            }
           },
            update:{},
            create: {
                userId,
                trackId,
                playedAt
            }
        })
    }


}