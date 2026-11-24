import { useState, type FormEvent } from 'react';

const statuses = ['To apply', 'Applied', 'Interview', 'Offer', 'Closed'] as const;
type Status = typeof statuses[number];
type Application = { id: string; company: string; role: string; date: string; status: Status };
const storageKey = 'vos.career.applications.v1';
const control = 'rounded border border-slate-400 bg-transparent px-2 py-1.5';

function readApplications(): Application[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (Array.isArray(saved)) return saved.filter(item => item && typeof item.id === 'string' &&
      typeof item.company === 'string' && typeof item.role === 'string' &&
      typeof item.date === 'string' && statuses.includes(item.status));
  } catch { /* A fresh list is available when storage is inaccessible. */ }
  return [];
}

function normalizedWords(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}+#.]+/gu, ' ').trim().replace(/\s+/g, ' ').replace(/\.(?=\s|$)/g, '');
}

function includesTerm(text: string, term: string) {
  return (' ' + text + ' ').includes(' ' + term + ' ');
}

export function CareerPractice() {
  const [applications, setApplications] = useState(readApplications);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [storageError, setStorageError] = useState('');
  const [description, setDescription] = useState('');
  const [resume, setResume] = useState('');
  const [keywords, setKeywords] = useState('');
  const terms = [...new Set(keywords.split(/[,\n]+/).map(term => normalizedWords(term)).filter(Boolean))].slice(0, 50);
  const jobWords = normalizedWords(description);
  const resumeWords = normalizedWords(resume);
  const matches = terms.map(term => ({ term, inJob: includesTerm(jobWords, term), inResume: includesTerm(resumeWords, term) }));

  function save(next: Application[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError('');
    } catch {
      setStorageError('This browser could not save the tracker. Changes are available until the page reloads.');
    }
    setApplications(next);
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company.trim() || !role.trim()) return;
    save([{ id: crypto.randomUUID(), company: company.trim(), role: role.trim(), date: new Date().toISOString(), status: 'To apply' }, ...applications]);
    setCompany('');
    setRole('');
  }

  return <section className="space-y-5 p-4 sm:p-6 max-w-4xl mx-auto">
    <h1 className="text-2xl font-bold">Career Prep</h1>
    <section className="space-y-3 rounded-md border p-4">
      <h2 className="font-semibold">Application tracker</h2>
      <p className="text-sm">Entries are saved in this browser.</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={add}>
        <label className="block text-sm">Company <input required maxLength={120} className={control + ' block'} value={company} onChange={event => setCompany(event.target.value)} /></label>
        <label className="block text-sm">Role <input required maxLength={120} className={control + ' block'} value={role} onChange={event => setRole(event.target.value)} /></label>
        <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white">Add application</button>
      </form>
      {storageError && <p role="alert" className="text-sm">{storageError}</p>}
      {applications.length > 0 && <ul className="divide-y">
        {applications.map(application => <li key={application.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div><p className="font-medium">{application.role} · {application.company}</p><time className="text-sm" dateTime={application.date}>{new Date(application.date).toLocaleDateString()}</time></div>
          <label className="text-sm">Status <select aria-label={'Status for ' + application.company + ' ' + application.role} value={application.status} className={control} onChange={event => {
            const status = event.target.value as Status;
            save(applications.map(entry => entry.id === application.id ? { ...entry, status } : entry));
          }}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
        </li>)}
      </ul>}
    </section>
    <section className="space-y-3 rounded-md border p-4">
      <h2 className="font-semibold">Job description keyword review</h2>
      <p className="text-sm">Enter keywords from the posting to check whether those phrases appear in your resume. Add a missing skill only if you can substantiate it.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Job description <textarea className={control + ' block w-full'} rows={5} maxLength={24000} value={description} onChange={event => setDescription(event.target.value)} /></label>
        <label className="text-sm">Resume text <textarea className={control + ' block w-full'} rows={5} maxLength={24000} value={resume} onChange={event => setResume(event.target.value)} /></label>
      </div>
      <label className="block text-sm">Keywords, separated by commas or new lines <textarea className={control + ' block w-full'} rows={2} maxLength={2500} value={keywords} onChange={event => setKeywords(event.target.value)} /></label>
      {matches.length > 0 && <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead><tr><th className="p-2">Keyword</th><th className="p-2">Job description</th><th className="p-2">Resume</th></tr></thead>
          <tbody>{matches.map(({term, inJob, inResume}) => <tr className="border-t" key={term}>
            <th scope="row" className="p-2 font-medium">{term}</th><td className="p-2">{inJob ? 'Present' : 'Missing'}</td><td className="p-2">{inResume ? 'Present' : 'Missing'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </section>;
}
