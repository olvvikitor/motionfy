// ---------------------------------------------------------------------------
// Termos de busca no Spotify associados a cada sentimento. Usados para achar
// candidatas novas quando o acervo analisado não cobre uma parada do caminho.
// Ajuste livremente: a ordem importa (os primeiros são tentados antes).
// ---------------------------------------------------------------------------
export const SENTIMENT_SEARCH_TERMS: Record<string, string[]> = {
    Euforia: ['genre:edm', 'genre:"dance pop"', 'genre:"funk carioca"', 'genre:house'],
    Celebracao: ['genre:pagode', 'genre:axe', 'genre:"dance pop"', 'genre:forro'],
    Confianca: ['genre:trap', 'genre:"hip hop"', 'genre:"trap brasileiro"', 'genre:"hard rock"'],
    Energia: ['genre:rock', 'genre:"drum and bass"', 'genre:"pop punk"', 'genre:techno'],
    Amor: ['genre:"sertanejo universitario"', 'genre:"r&b"', 'genre:"romantic"', 'genre:"soul"'],
    Paz: ['genre:"bossa nova"', 'genre:acoustic', 'genre:"lo-fi"', 'genre:ambient'],
    Reflexao: ['genre:mpb', 'genre:"indie folk"', 'genre:"singer-songwriter"', 'genre:jazz'],
    Tensao: ['genre:"trap metal"', 'genre:industrial', 'genre:drill', 'genre:"post-punk"'],
    Revolta: ['genre:punk', 'genre:"hardcore hip hop"', 'genre:metal', 'genre:"rap nacional"'],
    Frustracao: ['genre:grunge', 'genre:emo', 'genre:"alternative rock"', 'genre:"post-hardcore"'],
    Melancolia: ['genre:"indie pop"', 'genre:"sad"', 'genre:mpb', 'genre:"dream pop"'],
    Tristeza: ['genre:"sad"', 'genre:"piano"', 'genre:"slowcore"', 'genre:"sofrencia"'],
    Vazio: ['genre:ambient', 'genre:"slowcore"', 'genre:"shoegaze"', 'genre:"dark ambient"'],
    Ambivalente: ['genre:"indie rock"', 'genre:"alternative"', 'genre:"art pop"'],
};
