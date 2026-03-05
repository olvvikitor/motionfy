import { Injectable } from "@nestjs/common";
import { MusicProviderInterface, ProviderTrack, ProviderUserProfile } from "../music.provider.interface";
import axios from "axios";
import { UserRepository } from "src/modules/user/repository/user.repository";
import { mapSpotifyHistoryToPrisma } from "src/modules/tracks/mappers/spotifyToPrisma";
import { TrackInput } from "src/shared/types/TrackInput";


@Injectable()
export class SpotifyProvider implements MusicProviderInterface {
    constructor() { }

    async getProfile(accessToken: string): Promise<ProviderUserProfile> {
        const response = await axios.get('https://api.spotify.com/v1/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        })

        return {
            id: response.data.id,
            email: response.data.email,
            displayName: response.data.display_name,
            country: response.data.country,
            imageUrl: response.data.images?.[0]?.url,
        }
    }
    
    async getTopTracks(): Promise<TrackInput[]> {
        throw new Error("Method not implemented.");
    }
    async getLastRecentlyPlayed(accessToken: string): Promise<TrackInput[]> {

        const token = await this.refreshToken(accessToken)

        const response = await axios.get(
            'https://api.spotify.com/v1/me/player/recently-played?limit=50',
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        );

        const tracksProcessed = mapSpotifyHistoryToPrisma(response.data.items);


        return tracksProcessed
    }
    async refreshToken(refreshToken: string) {

        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken!,
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization:
                        'Basic ' +
                        Buffer.from(
                            process.env.SPOTIFY_CLIENT_ID +
                            ':' +
                            process.env.SPOTIFY_CLIENT_SECRET,
                        ).toString('base64'),
                },
            },
        );

        const { access_token } = response.data
        return access_token;
    }



}