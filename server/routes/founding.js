// Team: Aufgaben → Gründung. Checkliste zur UG-Gründung (Phase, Aufgabe, Wer, Wann, Status, Hinweise)
import { q, one } from '../db.js';
import { HttpError, readJson, idParam, json } from '../http.js';
import { v, validate } from '../validate.js';
import { logActivity } from '../activity.js';
import { FOUNDING_STATUSES } from '../../shared/constants.js';

const schema = {
  phase: v.str({ label: 'Phase', max: 80 }),
  title: v.str({ label: 'Aufgabe', required: true, max: 500 }),
  who: v.str({ label: 'Wer', max: 120 }),
  due_text: v.str({ label: 'Wann', max: 120 }),
  status: v.oneOf(FOUNDING_STATUSES, { label: 'Status', def: 'Offen' }),
  notes: v.str({ label: 'Hinweise', max: 5000 }),
};

const SELECT = `select f.*, u.name as updated_by_name from founding_items f left join users u on u.id = f.updated_by`;

export default function register(route) {
  route('GET', '/founding', async () => {
    const items = await q(`${SELECT} order by f.sort, f.id`);
    return { items, statuses: FOUNDING_STATUSES };
  });

  route('POST', '/founding', async ({ req, user }) => {
    const d = validate(await readJson(req), schema);
    // Neue Aufgabe ans Ende ihrer Phase (oder ganz ans Ende): alles dahinter rückt eins nach hinten
    const last = await one(`select max(sort) as s from founding_items where phase = $1`, [d.phase || '']);
    const sort = last?.s != null ? Number(last.s) + 1 : Number((await one(`select coalesce(max(sort), 0) + 1 as s from founding_items`)).s);
    await q(`update founding_items set sort = sort + 1 where sort >= $1`, [sort]);
    const row = await one(
      `insert into founding_items (sort, phase, title, who, due_text, status, notes, updated_by, completed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, case when $6 = 'Erledigt' then now() end) returning id`,
      [sort, d.phase || '', d.title, d.who, d.due_text, d.status, d.notes, user.id]
    );
    return json({ item: await one(`${SELECT} where f.id = $1`, [row.id]) }, 201);
  });

  route('PATCH', '/founding/:id', async ({ req, params, user }) => {
    const id = idParam(params.id);
    const d = validate(await readJson(req), schema, { partial: true });
    const before = await one(`select title, status from founding_items where id = $1`, [id]);
    if (!before) throw new HttpError(404, 'Eintrag nicht gefunden.');
    const keys = Object.keys(d);
    if (keys.length) {
      await q(
        `update founding_items set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')},
           completed_at = case when ${'status' in d ? `$${keys.indexOf('status') + 2}` : 'status'} = 'Erledigt' then coalesce(completed_at, now()) else null end,
           updated_by = $${keys.length + 2}, updated_at = now()
         where id = $1`,
        [id, ...keys.map((k) => d[k]), user.id]
      );
      if (d.status && d.status !== before.status && d.status === 'Erledigt') {
        await logActivity({ userId: user.id, entityType: 'founding', entityId: id, action: 'founding_done', message: `hat „${d.title || before.title}“ in der Gründungs-Checkliste erledigt.` });
      }
    }
    return { item: await one(`${SELECT} where f.id = $1`, [id]) };
  });

  route('DELETE', '/founding/:id', async ({ params }) => {
    const row = await one(`delete from founding_items where id = $1 returning id`, [idParam(params.id)]);
    if (!row) throw new HttpError(404, 'Eintrag nicht gefunden.');
    return { ok: true };
  });
}
