import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { listsExport } from '../index';

// Initialize Firebase Test SDK
const test = functionsTest();

const mockUserId = 'test-user-id';
const mockListId = 'test-list-id';

const mockItemsMixed = [
  { id: '123', title: 'Test Movie', release_date: '2022-01-01', vote_average: 7.3, vote_count: 111, media_type: 'movie' },
  { id: '456', name: 'Test Show', first_air_date: '2019-03-10', vote_average: 8.1, vote_count: 222, media_type: 'tv' },
];

describe('listsExport unified CSV export', () => {
  let mockAuth: any;
  let mockFirestore: any;

  beforeAll(() => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: 'test-project' });
    }
    mockAuth = jest.spyOn(admin, 'auth');
    mockFirestore = jest.spyOn(admin, 'firestore');
  });

  afterAll(() => {
    test.cleanup();
    jest.clearAllMocks();
  });

  const makeRes = () => {
    const res: any = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.set = jest.fn(() => res);
    res.send = jest.fn(() => res);
    res.end = jest.fn(() => res);
    return res;
  };

  it('returns 401 when missing auth', async () => {
    const req: any = { method: 'GET', path: `/lists/${mockListId}/export`, headers: {} };
    const res = makeRes();
    await listsExport(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for invalid token', async () => {
    const req: any = { method: 'GET', path: `/lists/${mockListId}/export`, headers: { authorization: 'Bearer bad' } };
    const res = makeRes();
    mockAuth.mockReturnValue({ verifyIdToken: jest.fn().mockRejectedValue(new Error('bad')) });
    await listsExport(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when custom list not found', async () => {
    const req: any = { method: 'GET', path: `/lists/${mockListId}/export`, headers: { authorization: 'Bearer ok' } };
    const res = makeRes();
    mockAuth.mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue({ uid: mockUserId }) });
    const db = {
      collection: (name: string) => name === 'users' ? ({
        doc: (uid: string) => ({
          collection: (sub: string) => sub === 'custom_lists' ? ({
            doc: (listId: string) => ({ get: jest.fn().mockResolvedValue({ exists: false }) })
          }) : ({})
        })
      }) : ({})
    };
    mockFirestore.mockReturnValue(db as any);
    await listsExport(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when not owner', async () => {
    const req: any = { method: 'GET', path: `/lists/${mockListId}/export`, headers: { authorization: 'Bearer ok' } };
    const res = makeRes();
    mockAuth.mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue({ uid: mockUserId }) });
    const db = {
      collection: (name: string) => name === 'users' ? ({
        doc: (uid: string) => ({
          collection: (sub: string) => sub === 'custom_lists' ? ({
            doc: (listId: string) => ({ get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ ownerId: 'x' }) }) })
          }) : ({})
        })
      }) : ({})
    };
    mockFirestore.mockReturnValue(db as any);
    await listsExport(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 204 when list empty', async () => {
    const req: any = { method: 'GET', path: `/lists/${mockListId}/export`, headers: { authorization: 'Bearer ok' } };
    const res = makeRes();
    mockAuth.mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue({ uid: mockUserId }) });
    const db = {
      collection: (name: string) => name === 'users' ? ({
        doc: (uid: string) => ({
          collection: (sub: string) => sub === 'custom_lists' ? ({
            doc: (listId: string) => ({
              get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ ownerId: mockUserId, name: 'My List' }) }),
              collection: (sub2: string) => sub2 === 'items' ? ({ get: jest.fn().mockResolvedValue({ empty: true, docs: [] }) }) : ({})
            })
          }) : ({})
        })
      }) : ({})
    };
    mockFirestore.mockReturnValue(db as any);
    await listsExport(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  it('custom list success with movie and tv rows', async () => {
    const req: any = { method: 'GET', path: `/lists/${mockListId}/export`, headers: { authorization: 'Bearer ok' } };
    const res = makeRes();
    mockAuth.mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue({ uid: mockUserId }) });
    const mockItemsGet = jest.fn().mockResolvedValue({ empty: false, docs: mockItemsMixed.map(it => ({ data: () => it })) });
    const mockListGet = jest.fn().mockResolvedValue({ exists: true, data: () => ({ ownerId: mockUserId, name: 'Favorites' }) });
    const db = {
      collection: (name: string) => name === 'users' ? ({
        doc: (uid: string) => ({
          collection: (sub: string) => sub === 'custom_lists' ? ({
            doc: (listId: string) => ({
              get: mockListGet,
              collection: (sub2: string) => sub2 === 'items' ? ({ get: mockItemsGet }) : ({})
            })
          }) : ({})
        })
      }) : ({})
    };
    mockFirestore.mockReturnValue(db as any);

    delete process.env.TMDB_API_KEY; // avoid external calls
    await listsExport(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const csv = res.send.mock.calls[0][0] as string;
    const header = 'tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes';
    expect(csv.split('\n')[0]).toBe(header);
    expect(csv).toContain('123,,Test Movie,2022,movie,7.3,,111,');
    expect(csv).toContain('456,,Test Show,2019,tv,8.1,,222,');
    const cd = res.set.mock.calls.find(c => c[0] === 'Content-Disposition')[1] as string;
    expect(cd).toMatch(/attachment; filename="Favorites-\d{8}\.csv"/);
  });

  it('watchlist success', async () => {
    const req: any = { method: 'GET', path: `/lists/watchlist/export`, headers: { authorization: 'Bearer ok' } };
    const res = makeRes();
    mockAuth.mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue({ uid: mockUserId }) });
    const mockItemsGet = jest.fn().mockResolvedValue({ empty: false, docs: mockItemsMixed.map(it => ({ data: () => it })) });
    const db = {
      collection: (name: string) => name === 'users' ? ({
        doc: (uid: string) => ({
          collection: (sub: string) => sub === 'watchlist' ? ({ get: mockItemsGet }) : ({})
        })
      }) : ({})
    };
    mockFirestore.mockReturnValue(db as any);

    delete process.env.TMDB_API_KEY; // avoid external calls
    await listsExport(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const cd = res.set.mock.calls.find(c => c[0] === 'Content-Disposition')[1] as string;
    expect(cd).toMatch(/attachment; filename="Watchlist-\d{8}\.csv"/);
  });

  it('IMDb failure fallback leaves IMDb fields empty and keeps TMDB fields', async () => {
    const req: any = { method: 'GET', path: `/lists/${mockListId}/export`, headers: { authorization: 'Bearer ok' } };
    const res = makeRes();
    mockAuth.mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue({ uid: mockUserId }) });
    const items = [{ id: '999', title: 'No IMDb', release_date: '2020-01-01', vote_average: 6.2, vote_count: 10, media_type: 'movie' }];
    const db = {
      collection: (name: string) => name === 'users' ? ({
        doc: (uid: string) => ({
          collection: (sub: string) => sub === 'custom_lists' ? ({
            doc: (listId: string) => ({
              get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ ownerId: mockUserId, name: 'X' }) }),
              collection: (sub2: string) => sub2 === 'items' ? ({ get: jest.fn().mockResolvedValue({ empty: false, docs: items.map(it => ({ data: () => it })) }) }) : ({})
            })
          }) : ({})
        })
      }) : ({})
    };
    mockFirestore.mockReturnValue(db as any);

    delete process.env.TMDB_API_KEY;
    await listsExport(req, res);

    const csv = res.send.mock.calls[0][0] as string;
    expect(csv).toContain('999,,No IMDb,2020,movie,6.2,,10,');
  });
});
