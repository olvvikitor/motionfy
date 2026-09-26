import 'dotenv/config';
import { PrismaService } from './src/config/prisma.service';
const p = new PrismaService();
(async () => {
  const total = await p.tracksAnalysis.count();
  const byMonth = await p.$queryRawUnsafe<any[]>(`select to_char(date_trunc('month',"analyzedAt"),'YYYY-MM') m, count(*)::int c from "TracksAnalysis" group by 1 order by 1`);
  const inUse = await p.$queryRawUnsafe<any[]>(`select count(distinct a.spotifyid)::int c from "TracksAnalysis" a join "Track" t on t."spotifyId"=a.spotifyid where exists (select 1 from "ListeningHistory" h where h."trackId"=t.id) or exists (select 1 from "SavedTrack" s where s."trackId"=t.id)`).catch(e => e.message);
  console.log({ total, byMonth, inUse });
  await p.$disconnect();
})();
