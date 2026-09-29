import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { PlaylistCoverService } from '../services/playlist-cover.service';

const PER_PAGE = 20;

type Row = Awaited<ReturnType<PlaylistCoverService['generationLog']>>['rows'][number];

function esc(text: string | null | undefined): string {
    return (text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const REFERENCE_LABEL: Record<string, string> = { none: 'sem foto', person: 'foto de pessoa', scene: 'foto de cenário' };

function card(row: Row): string {
    const date = row.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const image = row.imageUrl
        ? `<a href="${esc(row.imageUrl)}" target="_blank" rel="noopener"><img src="${esc(row.imageUrl)}" alt="" loading="lazy"></a>`
        : `<div class="noimg">imagem não salva</div>`;
    return `<article>
  ${image}
  <div class="info">
    <p class="meta">${esc(date)} · ${esc(row.user?.display_name ?? row.userId)} · ${esc(row.sentiment)} · ${esc(REFERENCE_LABEL[row.reference] ?? row.reference)} · ${esc(row.model)} / ${esc(row.quality)}</p>
    <h2>${esc(row.title) || 'Sem título'}</h2>
    <pre>${esc(row.prompt)}</pre>
    <p class="actions"><button type="button" data-copy>Copiar prompt</button>${row.imageUrl ? ` <a href="${esc(row.imageUrl)}" target="_blank" rel="noopener">Abrir imagem</a>` : ''}</p>
  </div>
</article>`;
}

function page(rows: Row[], total: number, current: number, key: string): string {
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const link = (p: number, label: string) => `<a href="?key=${encodeURIComponent(key)}&page=${p}">${label}</a>`;
    const nav = `<nav>${current > 1 ? link(current - 1, '← Mais novas') : '<span></span>'}<span>Página ${current} de ${pages} · ${total} capas</span>${current < pages ? link(current + 1, 'Mais antigas →') : '<span></span>'}</nav>`;
    return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Capas geradas · Mofy</title>
<style>
:root { --bg:#f6f6f4; --card:#fff; --text:#16161a; --muted:#6b6b73; --border:#e2e2de; --code:#f0f0ec; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg:#0c0c10; --card:#15151b; --text:#ececf0; --muted:#8d8d98; --border:#2a2a33; --code:#1d1d24; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin:0; padding:24px 16px 48px; background:var(--bg); color:var(--text); font:14px/1.5 system-ui, sans-serif; }
main { max-width:1100px; margin:0 auto; }
h1 { font-size:20px; margin:0 0 16px; }
nav { display:flex; justify-content:space-between; align-items:center; gap:12px; margin:16px 0; color:var(--muted); }
a { color:inherit; }
article { display:grid; grid-template-columns:280px 1fr; gap:20px; background:var(--card); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:16px; }
article img, .noimg { width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; display:block; }
.noimg { display:grid; place-items:center; background:var(--code); color:var(--muted); }
.info { min-width:0; }
.meta { margin:0; color:var(--muted); font-size:13px; }
h2 { font-size:16px; margin:4px 0 10px; }
pre { margin:0; padding:12px; background:var(--code); border-radius:8px; white-space:pre-wrap; word-break:break-word; font:12px/1.55 ui-monospace, monospace; max-height:320px; overflow:auto; }
.actions { margin:10px 0 0; display:flex; gap:16px; align-items:center; }
button { font:inherit; padding:6px 12px; border-radius:8px; border:1px solid var(--border); background:var(--card); color:var(--text); cursor:pointer; }
@media (max-width:720px) { article { grid-template-columns:1fr; } }
</style></head>
<body><main>
<h1>Capas geradas</h1>
${nav}
${rows.length ? rows.map(card).join('\n') : '<p>Nenhuma capa gerada ainda.</p>'}
${rows.length ? nav : ''}
</main>
<script>
document.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-copy]');
  if (!button) return;
  await navigator.clipboard.writeText(button.closest('.info').querySelector('pre').textContent);
  button.textContent = 'Copiado';
  setTimeout(() => { button.textContent = 'Copiar prompt'; }, 1500);
});
</script>
</body></html>`;
}

// Galeria das capas geradas pela IA, com o prompt de cada uma: GET admin/covers?key=MOFY_ADMIN_KEY[&page=2].
@Controller('admin')
export class CoverGalleryController {
    constructor(private readonly cover: PlaylistCoverService) { }

    @Get('covers')
    @Header('Cache-Control', 'no-store')
    async covers(@Query('key') key: string | undefined, @Query('page') pageParam: string | undefined, @Res() res: any) {
        const adminKey = process.env.MOFY_ADMIN_KEY;
        if (!adminKey || key !== adminKey) return res.status(403).send('Acesso negado.');
        const current = Math.max(1, Math.floor(Number(pageParam)) || 1);
        const { rows, total } = await this.cover.generationLog(current, PER_PAGE);
        res.type('html').send(page(rows, total, current, key));
    }
}
