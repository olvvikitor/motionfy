import axios from "axios";
import * as cheerio from 'cheerio';

export class GeniusProvider {
    constructor() {
    }
    async getLyricsAndAnalyze(artist: string, title: string, trackId: string) {
        try {
            // 1. Busca a música na API da Genius
            const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${title}`)}`;
            const { data } = await axios.get(searchUrl, {
                headers: { Authorization: `Bearer ${process.env.ACCESS_TOKEN_GENIUS}` }
            });

            const songPath = data.response.hits[0]?.result?.path;
            if (!songPath) return null;

            // 2. Faz o "Scrape" da página da letra
            const { data: html } = await axios.get(`https://genius.com${songPath}`);
            const $ = cheerio.load(html);

            // O Genius muda as classes as vezes, mas os seletores de 'Lyrics' costumam ser consistentes
            let lyrics = $('div[class^="Lyrics__Container"], .lyrics').text().trim();

            if (!lyrics) return null;

            return lyrics;
        } catch (error) {
            console.error('Erro ao buscar letra:', error);
            return null;
        }
    }
}