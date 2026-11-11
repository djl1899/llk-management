// Aufgaben → Gründung: Checkliste zur UG-Gründung (Phase, Aufgabe, Wer, Wann, Status, Hinweise)
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useApi, useForm, invalidateAll } from '../lib/useApi.js';
import { Button, Modal, Field, Select, Spinner, ErrorBox, Empty, Segmented, useUi, handleFormError } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { fmtDateTime } from '../lib/format.js';
import { FOUNDING_STATUSES } from '../../shared/constants.js';

const TONE = { Offen: 'open', 'In Arbeit': 'doing', Erledigt: 'done' };

export function FoundingChecklist() {
  const { data, error, loading, reload } = useApi('/founding');
  const { toast } = useUi();
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [items, setItems] = useState(null);
  useEffect(() => { if (data) setItems(data.items); }, [data]);

  const list = items || [];
  const done = list.filter((i) => i.status === 'Erledigt').length;
  const doing = list.filter((i) => i.status === 'In Arbeit').length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;

  const phases = useMemo(() => {
    const map = new Map();
    for (const it of list) {
      if (filter === 'open' && it.status === 'Erledigt') continue;
      if (filter === 'done' && it.status !== 'Erledigt') continue;
      const key = it.phase || 'Ohne Phase';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return [...map.entries()];
  }, [list, filter]);
  const allPhases = [...new Set(list.map((i) => i.phase).filter(Boolean))];

  const setStatus = async (item, status) => {
    const prev = items;
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, status } : x)));
    try {
      const r = await api.patch(`/founding/${item.id}`, { status });
      setItems((xs) => xs.map((x) => (x.id === item.id ? r.item : x)));
      invalidateAll();
    } catch (err) {
      setItems(prev);
      toast(err.message, 'error');
    }
  };

  if (!data && loading) return <Spinner />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <div className="founding">
      <div className="card fd-head">
        <div className="fd-progress">
          <div className="fd-progress-top">
            <div>
              <div className="fd-title">UG-Gründung</div>
              <div className="muted small">{done} von {list.length} erledigt{doing ? ` · ${doing} in Arbeit` : ''}</div>
            </div>
            <div className="fd-pct">{pct} %</div>
          </div>
          <div className="fd-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="fd-actions">
          <Segmented value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'Alle', count: list.length },
            { value: 'open', label: 'Noch offen', count: list.length - done },
            { value: 'done', label: 'Erledigt', count: done },
          ]} />
          <Button variant="primary" icon="plus" onClick={() => setModal({ item: null })}>Neuer Punkt</Button>
        </div>
      </div>

      {!phases.length ? (
        <div className="card"><Empty icon="check" title={filter === 'done' ? 'Noch nichts erledigt' : 'Alles erledigt'} text={filter === 'open' ? 'Alle Punkte der Gründung sind abgehakt.' : ''} /></div>
      ) : phases.map(([phase, rows]) => {
        const pDone = list.filter((i) => (i.phase || 'Ohne Phase') === phase && i.status === 'Erledigt').length;
        const pAll = list.filter((i) => (i.phase || 'Ohne Phase') === phase).length;
        return (
          <section key={phase} className="card fd-phase">
            <div className="fd-phase-head">
              <h2>{phase}</h2>
              <span className="muted small">{pDone}/{pAll} erledigt</span>
            </div>
            <div className="table-wrap">
              <table className="table fd-table">
                <thead>
                  <tr><th className="fd-col-status">Status</th><th>Aufgabe</th><th className="fd-col-who">Wer</th><th className="fd-col-when">Wann</th><th>Hinweise</th><th aria-label="Bearbeiten" /></tr>
                </thead>
                <tbody>
                  {rows.map((it) => (
                    <tr key={it.id} className={`fd-row fd-${TONE[it.status] || 'open'}`}>
                      <td className="fd-col-status" data-label="Status">
                        <select
                          id={`fd-status-${it.id}`}
                          className={`fd-status fd-status-${TONE[it.status] || 'open'}`}
                          value={it.status}
                          onChange={(e) => setStatus(it, e.target.value)}
                          aria-label={`Status für ${it.title}`}
                        >
                          {FOUNDING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="fd-task" data-label="Aufgabe"><div className="fd-task-in">
                        <button type="button" className="fd-check" onClick={() => setStatus(it, it.status === 'Erledigt' ? 'Offen' : 'Erledigt')}
                          aria-label={it.status === 'Erledigt' ? 'Wieder öffnen' : 'Als erledigt markieren'} title={it.status === 'Erledigt' ? 'Wieder öffnen' : 'Erledigt'}>
                          {it.status === 'Erledigt' && <Icon name="check" size={13} />}
                        </button>
                        <span className="fd-task-text">{it.title}</span>
                      </div></td>
                      <td className="fd-col-who" data-label="Wer">{it.who || <span className="muted">–</span>}</td>
                      <td className="fd-col-when" data-label="Wann">{it.due_text || <span className="muted">–</span>}</td>
                      <td className="fd-notes" data-label="Hinweise">{it.notes || <span className="muted">–</span>}</td>
                      <td className="fd-edit"><button type="button" className="icon-btn" onClick={() => setModal({ item: it })} aria-label="Bearbeiten" title="Bearbeiten"><Icon name="edit" size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <FoundingModal open={!!modal} item={modal?.item} phases={allPhases} onClose={() => setModal(null)} onSaved={reload} />
    </div>
  );
}

function FoundingModal({ open, item, phases, onClose, onSaved }) {
  const { toast, confirm } = useUi();
  const f = useForm({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    f.setErrors({});
    f.setValues({
      phase: item?.phase || phases[phases.length - 1] || '', title: item?.title || '', who: item?.who || '',
      due_text: item?.due_text || '', status: item?.status || 'Offen', notes: item?.notes || '',
    });
  }, [open]); // eslint-disable-line
  const v = f.values;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (item) await api.patch(`/founding/${item.id}`, v);
      else await api.post('/founding', v);
      invalidateAll();
      onSaved();
      toast(item ? 'Gespeichert.' : 'Punkt hinzugefügt.');
      onClose();
    } catch (err) {
      handleFormError(err, f.setErrors, toast);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    const ok = await confirm({ title: 'Punkt löschen?', message: `„${item.title}“ wird aus der Gründungs-Checkliste entfernt.`, confirmLabel: 'Löschen', danger: true });
    if (!ok) return;
    try {
      await api.del(`/founding/${item.id}`);
      invalidateAll();
      onSaved();
      toast('Punkt gelöscht.');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={item ? 'Punkt bearbeiten' : 'Neuer Punkt'}
      footer={<>
        {item && <Button variant="ghost-danger" icon="trash" onClick={remove} className="mr-auto">Löschen</Button>}
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="primary" type="submit" form="founding-form" loading={saving}>Speichern</Button>
      </>}>
      <form id="founding-form" className="form-grid" onSubmit={submit}>
        <Field label="Phase" error={f.errors.phase}>
          <input id="fd-phase" className="input" list="fd-phases" value={v.phase || ''} onChange={f.set('phase')} placeholder="z. B. 2 · Behörden" />
          <datalist id="fd-phases">{phases.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
        <Field label="Status" error={f.errors.status}>
          <Select id="fd-status" value={v.status} onChange={f.set('status')} options={FOUNDING_STATUSES} />
        </Field>
        <Field label="Aufgabe" required error={f.errors.title} className="span-2">
          <input id="fd-title" className="input" value={v.title || ''} onChange={f.set('title')} required autoFocus={!item} />
        </Field>
        <Field label="Wer" error={f.errors.who}>
          <input id="fd-who" className="input" value={v.who || ''} onChange={f.set('who')} placeholder="z. B. David, Alle, Notar" />
        </Field>
        <Field label="Wann" error={f.errors.due_text}>
          <input id="fd-when" className="input" value={v.due_text || ''} onChange={f.set('due_text')} placeholder="z. B. diese Woche, bis 10.12.2026" />
        </Field>
        <Field label="Hinweise" error={f.errors.notes} className="span-2">
          <textarea id="fd-notes" className="input" rows={4} value={v.notes || ''} onChange={f.set('notes')} />
        </Field>
        {item?.updated_by_name && <p className="muted small span-2">Zuletzt geändert von {item.updated_by_name} am {fmtDateTime(item.updated_at)}</p>}
      </form>
    </Modal>
  );
}
