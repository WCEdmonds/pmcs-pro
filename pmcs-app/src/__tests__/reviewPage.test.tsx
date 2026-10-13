import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { TOKEN_KEY, type ApiProfile } from '../utils/api';
import { db } from '../utils/db';
import { useUserStore } from '../stores/userStore';
import type { ReviewFlag, ReviewState, ReviewVerdict } from '../utils/reviewApi';
import type { TroubleshootingTree } from '../types/diagnosis';
import ReviewPage from '../pages/ReviewPage';
import App from '../App';

// ---- a small fake tree (plus a second one for the picker) ----
const WONT_START: TroubleshootingTree = {
  categoryId: 'wont-start',
  vehicleType: 'M1097',
  tmReference: 'TM 9-2320-280-10, Table 3-1',
  rootNodeId: 'q1',
  nodes: {
    q1: {
      id: 'q1', type: 'question', text: 'Turn the switch to START. What happens?', tmPage: '3-6 #1',
      options: [{ label: 'Engine cranks', nextNodeId: 'a1' }, { label: 'Nothing happens', nextNodeId: 'q2' }],
    },
    a1: { id: 'a1', type: 'action', text: 'Check the fuel level', actionText: 'Fill the tank if low.', nextNodeId: 't1' },
    t1: { id: 't1', type: 'terminal', text: 'Engine runs', terminal: { readiness: 'PMC', resolution: 'operator-fix', summary: 'Fuel added' } },
    q2: {
      id: 'q2', type: 'question', text: 'Are the battery terminals tight?',
      options: [{ label: 'Loose', nextNodeId: 'a1' }, { label: 'Tight', nextNodeId: 't2' }],
    },
    t2: { id: 't2', type: 'terminal', text: 'Starting system fault', terminal: { readiness: 'NMC', resolution: 'needs-maintenance', summary: 'Notify maintenance' } },
    o1: { id: 'o1', type: 'terminal', text: 'Orphan result', terminal: { readiness: 'PMC', resolution: 'operator-fix', summary: '' } },
  },
};

const FLUID_LEAK: TroubleshootingTree = {
  categoryId: 'fluid-leak',
  vehicleType: 'M1097',
  tmReference: 'TM 9-2320-280-10, para 2-5',
  rootNodeId: 'f1',
  nodes: {
    f1: { id: 'f1', type: 'question', text: 'How big is the leak?', options: [{ label: 'Class III', nextNodeId: 'f2' }, { label: 'Class I', nextNodeId: 'f3' }] },
    f2: { id: 'f2', type: 'terminal', text: 'Class III leak', terminal: { readiness: 'NMC', resolution: 'needs-maintenance', summary: '' } },
    f3: { id: 'f3', type: 'terminal', text: 'Class I leak', terminal: { readiness: 'PMC', resolution: 'operator-fix', summary: '' } },
  },
};

vi.mock('../utils/reviewTrees', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../utils/reviewTrees')>();
  return {
    ...orig,
    loadReviewData: async () => ({ vehicles: orig.buildVehicles(), trees: [WONT_START, FLUID_LEAK].map(orig.buildReviewTree) }),
  };
});

// ---- fake API ----
const ME = 'user-me';
const OTHER = 'user-other';
const DOD = '1000000001';

type Req = { method: string; path: string; body: unknown };
type Handler = (req: Req) => { status: number; body?: unknown } | undefined;
let handler: Handler;
let requests: Req[];
let server: ReviewState;

function json(status: number, body?: unknown) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function flag(extra: Partial<ReviewFlag> = {}): ReviewFlag {
  return {
    id: 'f-1', tree: 'M1097.wont-start', node: 'q2', kind: 'wording', text: 'Say which terminals.', user_id: OTHER,
    created_at: '2026-10-01T12:00:00Z', resolved_at: null, resolved_by: null, ...extra,
  };
}

const PEOPLE = {
  [ME]: { rank: 'CW2', first_name: 'Jane', last_name: 'Doe' },
  [OTHER]: { rank: 'CW3', first_name: 'John', last_name: 'Roe' },
};

/** Default fake server: keeps flags and verdicts in `server`. */
const defaultHandler: Handler = ({ method, path, body }) => {
  if (method === 'GET' && path === '/review') return { status: 200, body: server };
  if (method === 'POST' && path === '/review/flags') {
    const b = body as { tree: string; node: string; kind: ReviewFlag['kind']; text: string };
    const f = flag({ id: `f-${server.flags.length + 10}`, ...b, user_id: ME, created_at: '2026-10-02T12:00:00Z' });
    server = { ...server, flags: [...server.flags, f] };
    return { status: 200, body: f };
  }
  const m = path.match(/^\/review\/flags\/(.+)$/);
  if (m && method === 'PATCH') {
    const resolved = (body as { resolved: boolean }).resolved;
    const f = { ...server.flags.find((x) => x.id === m[1])!, resolved_at: resolved ? '2026-10-03T12:00:00Z' : null, resolved_by: resolved ? ME : null };
    server = { ...server, flags: server.flags.map((x) => (x.id === f.id ? f : x)) };
    return { status: 200, body: f };
  }
  if (m && method === 'DELETE') {
    server = { ...server, flags: server.flags.filter((x) => x.id !== m[1]) };
    return { status: 200, body: { ok: true } };
  }
  const v = path.match(/^\/review\/verdicts\/(.+)$/);
  if (v && method === 'PUT') {
    const tree = decodeURIComponent(v[1]);
    const b = body as { status: ReviewVerdict['status']; note?: string };
    if (b.status === 'approved' && server.flags.some((f) => f.tree === tree && !f.resolved_at)) {
      return { status: 409, body: { error: 'This tree still has open flags. Resolve them, or mark it Needs changes.', code: 'OPEN_FLAGS' } };
    }
    const verdict: ReviewVerdict = { tree, user_id: ME, status: b.status, note: b.note ?? null, updated_at: '2026-10-04T12:00:00Z' };
    server = { ...server, verdicts: [...server.verdicts.filter((x) => !(x.tree === tree && x.user_id === ME)), verdict] };
    return { status: 200, body: verdict };
  }
  if (v && method === 'DELETE') {
    const tree = decodeURIComponent(v[1]);
    server = { ...server, verdicts: server.verdicts.filter((x) => !(x.tree === tree && x.user_id === ME)) };
    return { status: 200, body: { ok: true } };
  }
  return undefined;
};

function setUser(role: 'member' | 'admin' = 'member') {
  useUserStore.setState({
    user: { id: ME, dodId: DOD, rank: 'CW2', firstName: 'Jane', lastName: 'Doe', mi: '', unit: 'WXYZA0', role },
    offlineProfile: false,
    isLoading: false,
  });
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.hash}</div>;
}

function renderPage(entry = '/review#M1097.wont-start') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/review" element={<><ReviewPage /><LocationProbe /></>} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const outline = () => screen.getByTestId('outline');
const stepEl = (id: string) => document.querySelector(`[data-node="${id}"]`) as HTMLElement;
/** The step's own row (not its children). */
const stepHead = (id: string) => stepEl(id).firstElementChild as HTMLElement;

beforeEach(async () => {
  cleanup();
  requests = [];
  server = { flags: [], verdicts: [], people: PEOPLE };
  handler = defaultHandler;
  vi.stubGlobal('fetch', vi.fn(async (input: URL | string, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const req = { method: init.method ?? 'GET', path: url.pathname, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined };
    requests.push(req);
    const r = handler(req) ?? { status: 200, body: { ok: true } };
    return json(r.status, r.body);
  }));
  localStorage.clear();
  sessionStorage.clear();
  await db.delete();
  await db.open();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  setUser();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Troubleshooting review: outline', () => {
  it('numbers steps from the root, labels answers, links repeats and shows end results', async () => {
    renderPage();
    await screen.findByTestId('outline');
    const tags = [...outline().querySelectorAll('[data-node]')].map((el) => el.firstElementChild!.firstElementChild!.textContent);
    expect(tags).toEqual(['1 · Question', '2 · Action', '3 · End result', '4 · Question', '5 · End result', '6 · End result']);

    // IF / THEN labels
    expect(within(stepEl('q1')).getByText('Engine cranks')).toBeTruthy();
    expect(within(stepEl('a1')).getByText('THEN')).toBeTruthy();
    // a1 is reached again from q2: shown once, then "continues at Step 2"
    const cont = within(stepEl('q2')).getByRole('link', { name: 'Step 2' });
    expect(cont.parentElement!.textContent).toMatch(/continues at Step 2 \(action shown above\)/);
    // End results
    expect(within(stepEl('t1')).getByText('PMC')).toBeTruthy();
    expect(within(stepEl('t1')).getByText('Operator fix')).toBeTruthy();
    expect(within(stepEl('t2')).getByText('NMC')).toBeTruthy();
    expect(within(stepEl('t2')).getByText('Needs maintenance')).toBeTruthy();
    // Unreachable step warning
    expect(screen.getByText(/1 step in this tree can't be reached from the start/)).toBeTruthy();
    // TM paragraph links open the PDF at the page, in a new tab
    const tm = within(stepHead('q1')).getByRole('link', { name: 'TM 3-6 #1' }) as HTMLAnchorElement;
    expect(tm.href).toMatch(/TM-9-2320-280-10\.pdf#page=\d+$/);
    expect(tm.target).toBe('_blank');
    expect(within(stepHead('a1')).getByText('no TM ref')).toBeTruthy();
    // Tree header
    expect(screen.getByTestId('tree-head').textContent).toMatch(/6 steps · 3 end results \(1 NMC, 2 PMC\) · 0 open flags/);
    expect(screen.getByTestId('signed-in').textContent).toMatch(/CW2 Jane Doe/);
  });

  it('deep-links to the tree in the #hash', async () => {
    renderPage('/review#M1097.fluid-leak');
    expect(await screen.findByRole('heading', { level: 2, name: 'Fluid Leak' })).toBeTruthy();
  });

  it('the picker switches tree and updates the #hash', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 2, name: "Won't Start" });
    const picker = screen.getByLabelText('Choose a tree') as HTMLSelectElement;
    const options = [...picker.querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual(["M1097 HMMWV (Heavy) — Won't Start", 'M1097 HMMWV (Heavy) — Fluid Leak']);
    fireEvent.change(picker, { target: { value: 'M1097.fluid-leak' } });
    expect(await screen.findByRole('heading', { level: 2, name: 'Fluid Leak' })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/review#M1097.fluid-leak');
    expect(screen.getByText('How big is the leak?')).toBeTruthy();
  });
});

describe('Troubleshooting review: flags', () => {
  it('raises a flag on a step, then the author can resolve or delete it', async () => {
    renderPage();
    await screen.findByTestId('outline');
    await waitFor(() => expect((within(stepHead('q2')).getByRole('button', { name: /Flag step 4/ }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(stepHead('q2')).getByRole('button', { name: /Flag step 4/ }));
    fireEvent.change(screen.getByLabelText('What kind of problem'), { target: { value: 'tm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save flag' }));
    expect(await screen.findByText('Describe the problem first.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Flag details'), { target: { value: '  Cite para 3-10.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save flag' }));

    const card = await screen.findByTestId('flag-card');
    expect(requests.find((r) => r.method === 'POST')).toMatchObject({
      path: '/review/flags',
      body: { tree: 'M1097.wont-start', node: 'q2', kind: 'tm', text: 'Cite para 3-10.' },
    });
    expect(card.textContent).toMatch(/Wrong or missing TM reference/);
    expect(card.textContent).toMatch(/CW2 Jane Doe \(you\)/);
    expect(screen.queryByLabelText('Flag details')).toBeNull();
    expect(within(stepHead('q2')).getByRole('button', { name: /Flag step 4 \(1 open\)/ })).toBeTruthy();

    fireEvent.click(within(card).getByRole('button', { name: 'Mark resolved' }));
    await waitFor(() => expect(within(screen.getByTestId('flag-card')).getByRole('button', { name: 'Reopen' })).toBeTruthy());
    expect(requests.find((r) => r.method === 'PATCH')).toMatchObject({ path: '/review/flags/f-10', body: { resolved: true } });
    // A resolved flag can't be deleted
    expect(within(screen.getByTestId('flag-card')).queryByRole('button', { name: 'Delete' })).toBeNull();
    fireEvent.click(within(screen.getByTestId('flag-card')).getByRole('button', { name: 'Reopen' }));
    await waitFor(() => expect(within(screen.getByTestId('flag-card')).getByRole('button', { name: 'Delete' })).toBeTruthy());
    fireEvent.click(within(screen.getByTestId('flag-card')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByTestId('flag-card')).toBeNull());
    expect(requests.some((r) => r.method === 'DELETE' && r.path === '/review/flags/f-10')).toBe(true);
  });

  it("another reviewer's flag: a member can't resolve or delete it", async () => {
    server.flags = [flag()];
    renderPage();
    const card = await screen.findByTestId('flag-card');
    expect(card.textContent).toMatch(/CW3 John Roe/);
    expect(within(card).queryByRole('button', { name: 'Mark resolved' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it("an admin can resolve another reviewer's flag but not delete it", async () => {
    setUser('admin');
    server.flags = [flag()];
    renderPage();
    const card = await screen.findByTestId('flag-card');
    expect(within(card).queryByRole('button', { name: 'Delete' })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Mark resolved' }));
    await waitFor(() => expect(screen.getByTestId('flag-card').textContent).toMatch(/resolved/));
    expect(requests.find((r) => r.method === 'PATCH')).toMatchObject({ path: '/review/flags/f-1', body: { resolved: true } });
  });

  it('lists open flags across trees and jumps to the step', async () => {
    server.flags = [flag(), flag({ id: 'f-2', tree: 'M1097.fluid-leak', node: 'f2', text: 'Class III is NMC per Table 2-1.' }), flag({ id: 'f-3', resolved_at: '2026-10-02T00:00:00Z' })];
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'All open flags (2)' }));
    const all = screen.getByTestId('all-flags');
    expect(within(all).getAllByTestId('flag-card')).toHaveLength(2);
    expect(within(all).getByText('M1097 HMMWV (Heavy) — Fluid Leak')).toBeTruthy();
    fireEvent.click(within(all).getAllByRole('link', { name: 'Step 2' })[0]);
    expect(await screen.findByRole('heading', { level: 2, name: 'Fluid Leak' })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/review#M1097.fluid-leak');
  });

  it('a refresh does not wipe a half-typed flag', async () => {
    renderPage();
    await screen.findByTestId('outline');
    await waitFor(() => expect((within(stepHead('q1')).getByRole('button', { name: /Flag step 1/ }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(stepHead('q1')).getByRole('button', { name: /Flag step 1/ }));
    fireEvent.change(screen.getByLabelText('Flag details'), { target: { value: 'Half typed' } });
    const gets = requests.filter((r) => r.path === '/review').length;
    server.flags = [flag()];
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await screen.findByTestId('flag-card');
    expect(requests.filter((r) => r.path === '/review').length).toBe(gets + 1);
    expect((screen.getByLabelText('Flag details') as HTMLTextAreaElement).value).toBe('Half typed');
  });

  it('offline: says so and disables flagging and verdicts', async () => {
    handler = () => {
      throw new TypeError('Failed to fetch');
    };
    renderPage();
    expect((await screen.findByTestId('offline-notice')).textContent).toMatch(/You're offline\. The troubleshooting review needs a connection/);
    expect((within(stepHead('q1')).getByRole('button', { name: /Flag step 1/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Approved' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Troubleshooting review: verdicts', () => {
  it('approve is blocked while the tree has open flags; Needs changes saves', async () => {
    server.flags = [flag()];
    renderPage();
    await screen.findByTestId('flag-card');
    const verdict = screen.getByTestId('verdict');
    await waitFor(() => expect((within(verdict).getByRole('button', { name: 'Approved' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(verdict).getByRole('button', { name: 'Approved' }));
    expect(within(verdict).getByRole('alert').textContent).toBe('This tree still has 1 open flag. Resolve them, or choose Needs changes.');
    const save = within(verdict).getByRole('button', { name: 'Save verdict' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(requests.some((r) => r.method === 'PUT')).toBe(false);

    fireEvent.click(within(verdict).getByRole('button', { name: 'Needs changes' }));
    fireEvent.change(within(verdict).getByLabelText('Verdict note'), { target: { value: 'Step 4 needs the TM para.' } });
    fireEvent.click(within(verdict).getByRole('button', { name: 'Save verdict' }));
    await waitFor(() => expect(within(screen.getByTestId('verdict-list')).getByText('NEEDS CHANGES')).toBeTruthy());
    expect(requests.find((r) => r.method === 'PUT')).toMatchObject({
      path: '/review/verdicts/M1097.wont-start',
      body: { status: 'changes', note: 'Step 4 needs the TM para.' },
    });
    expect(within(verdict).getByRole('button', { name: 'Update verdict' })).toBeTruthy();
    expect(screen.getByTestId('stats').textContent).toMatch(/1need changes/);
  });

  it("shows the server's OPEN_FLAGS refusal (a flag raised meanwhile)", async () => {
    renderPage();
    const verdict = await screen.findByTestId('verdict');
    await waitFor(() => expect((within(verdict).getByRole('button', { name: 'Approved' }) as HTMLButtonElement).disabled).toBe(false));
    server.flags = [flag()]; // raised by someone else after our last refresh
    fireEvent.click(within(verdict).getByRole('button', { name: 'Approved' }));
    fireEvent.click(within(verdict).getByRole('button', { name: 'Save verdict' }));
    expect(await within(verdict).findByText('This tree still has open flags. Resolve them, or mark it Needs changes.')).toBeTruthy();
    await screen.findByTestId('flag-card'); // refetched
  });

  it('approves a tree with no open flags and can withdraw it', async () => {
    renderPage();
    const verdict = await screen.findByTestId('verdict');
    await waitFor(() => expect((within(verdict).getByRole('button', { name: 'Approved' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(verdict).getByRole('button', { name: 'Approved' }));
    fireEvent.click(within(verdict).getByRole('button', { name: 'Save verdict' }));
    await waitFor(() => expect(within(screen.getByTestId('verdict-list')).getByText('APPROVED')).toBeTruthy());
    expect(requests.find((r) => r.method === 'PUT')?.body).toEqual({ status: 'approved' });
    expect(screen.getByTestId('stats').textContent).toMatch(/1of 2 trees approved/);
    fireEvent.click(within(verdict).getByRole('button', { name: 'Withdraw my verdict' }));
    await waitFor(() => expect(within(screen.getByTestId('verdict-list')).getByText('No verdicts yet.')).toBeTruthy());
    expect(requests.some((r) => r.method === 'DELETE' && r.path === '/review/verdicts/M1097.wont-start')).toBe(true);
  });
});

describe('Troubleshooting review: walk through', () => {
  it('answers questions, goes back and starts over', async () => {
    renderPage();
    await screen.findByTestId('outline');
    fireEvent.click(screen.getByRole('button', { name: 'Walk through' }));
    const walkText = () => screen.getByTestId('walk-text').textContent;
    expect(walkText()).toBe('Turn the switch to START. What happens?');
    expect((screen.getByRole('button', { name: '← Back' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Nothing happens' }));
    expect(walkText()).toBe('Are the battery terminals tight?');
    fireEvent.click(screen.getByRole('button', { name: 'Loose' }));
    expect(walkText()).toBe('Check the fuel level');
    fireEvent.click(screen.getByRole('button', { name: 'Done — continue' }));
    expect(walkText()).toBe('Engine runs');
    expect(within(screen.getByTestId('walk')).getByText('Operator fix')).toBeTruthy();
    expect(screen.getByTestId('walk-trail').textContent).toMatch(/Are the battery terminals tight\? → Loose/);

    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(walkText()).toBe('Check the fuel level');
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(walkText()).toBe('Turn the switch to START. What happens?');
    expect(screen.queryByTestId('walk-trail')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show in outline' }));
    expect(screen.getByTestId('outline')).toBeTruthy();
  });
});

describe('Troubleshooting review: sign-in', () => {
  function b64url(obj: unknown) {
    return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const token = `${b64url({ alg: 'HS256' })}.${b64url({ sub: ME, dod_id: DOD, exp: 4102444800 })}.sig`;
  const profile: ApiProfile = {
    id: ME, dod_id: DOD, rank: 'CW2', last_name: 'Doe', first_name: 'Jane', mi: '', unit: 'WXYZA0',
    created_at: '2026-01-01T00:00:00Z', role: 'member', must_change_pin: 0, email: null, email_verified_at: null,
  };

  it('a signed-out visitor signs in and lands back on the same tree', async () => {
    useUserStore.setState({ user: null });
    handler = (req) => {
      if (req.path.startsWith('/auth/exists')) return { status: 200, body: { exists: true } };
      if (req.path === '/auth/login') return { status: 200, body: { token, profile } };
      if (req.path === '/me') return { status: 200, body: profile };
      return defaultHandler(req);
    };
    window.history.pushState({}, '', '/review#M1097.fluid-leak');
    render(<App />);
    fireEvent.change(await screen.findByLabelText('DOD ID Number', {}, { timeout: 5000 }), { target: { value: DOD } });
    fireEvent.submit(screen.getByLabelText('DOD ID Number').closest('form')!);
    fireEvent.change(await screen.findByLabelText('PIN'), { target: { value: '135790' } });
    fireEvent.submit(screen.getByLabelText('PIN').closest('form')!);
    expect(await screen.findByRole('heading', { level: 2, name: 'Fluid Leak' }, { timeout: 5000 })).toBeTruthy();
    expect(window.location.pathname + window.location.hash).toBe('/review#M1097.fluid-leak');
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token);
    expect(useUserStore.getState().user?.id).toBe(ME);
  });
});
