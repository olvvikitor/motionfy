import MusicProviderInterface, { ProviderTrack, ProviderUserProfile } from "../music.provider.interface";
import axios from "axios";

export class SpotifyProvider implements MusicProviderInterface {
    async getProfile(accessToken:string): Promise<ProviderUserProfile> {
        const response = await axios.get('https://api.spotify.com/v1/me',{
            headers:{
                Authorization:`Bearer ${accessToken}`
            }
        })
        
        return {
            id: response.data.id,
            email:response.data.email, 
            displayName: response.data.display_name,
            country:response.data.country,
            imageUrl: response.data.images?.[0]?.url,
        }
    }
    getTopTracks(): Promise<ProviderTrack[]> {
        throw new Error("Method not implemented.");
    }
    getLastTracgetRecentlyPlayed(accessToken: string): Promise<ProviderTrack[]> {
        throw new Error("Method not implemented.");
    }

}