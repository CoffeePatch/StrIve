import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { confirmListImport } from '../index';

// Initialize Firebase Test SDK
const test = functionsTest();

// Mock data for testing
const mockUserId = 'test-user-id';
const mockListId = 'test-list-id';
const mockMovieItems = [
  {
    id: '123',
    title: 'Test Movie',
    release_date: '2022-01-01',
    poster_path: '/test-poster.jpg',
    vote_average: 8.5,
    media_type: 'movie',
    dateAdded: new Date().toISOString(),
  },
  {
    id: '456',
    title: 'Another Test Movie',
    release_date: '2023-05-15',
    poster_path: '/test-poster2.jpg',
    vote_average: 7.8,
    media_type: 'movie',
    dateAdded: new Date().toISOString(),
  }
];

describe('Confirm List Import Function', () => {
  let mockAuth: any;
  let mockFirestore: any;

  beforeAll(() => {
    // Initialize Firebase Admin SDK with test project ID
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'test-project',
      });
    }
    
    // Mock auth and Firestore
    mockAuth = jest.spyOn(admin, 'auth');
    mockFirestore = jest.spyOn(admin, 'firestore');
  });

  afterAll(() => {
    test.cleanup();
    jest.clearAllMocks();
  });

  it('should return 401 if no authorization header is provided', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/confirm`,
      headers: {},
      body: { moviesToImport: ['123', '456'] }
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    await confirmListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Missing or invalid authorization header' });
  });

  it('should return 401 if invalid token is provided', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/confirm`,
      headers: {
        authorization: 'Bearer invalid-token',
      },
      body: { moviesToImport: ['123', '456'] }
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to fail
    const mockVerifyIdToken = jest.fn().mockRejectedValue(new Error('Invalid token'));
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });

    await confirmListImport(req as any, res as any);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('invalid-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
  });

  it('should return 404 if list does not exist', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/confirm`,
      headers: {
        authorization: 'Bearer valid-token',
      },
      body: { moviesToImport: ['123', '456'] }
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to succeed
    const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: mockUserId });
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
    
    // Mock Firestore to return a non-existing list
    const mockGet = jest.fn().mockResolvedValue({ exists: false });
    const mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    const mockDb = {
      collection: mockCollection,
    };
    
    mockFirestore.mockReturnValue(mockDb);

    await confirmListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'List not found' });
  });

  it('should return 403 if user does not own the list', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/confirm`,
      headers: {
        authorization: 'Bearer valid-token',
      },
      body: { moviesToImport: ['123', '456'] }
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to succeed
    const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: mockUserId });
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
    
    // Mock Firestore to return a list that doesn't belong to the user
    const mockGet = jest.fn().mockResolvedValue({ 
      exists: true,
      data: () => ({ ownerId: 'different-user-id' }) 
    });
    const mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    const mockDb = {
      collection: mockCollection,
    };
    
    mockFirestore.mockReturnValue(mockDb);

    await confirmListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: You do not have permission to access this list' });
  });

  it('should return 400 if request body is invalid', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/confirm`,
      headers: {
        authorization: 'Bearer valid-token',
      },
      body: { } // Missing moviesToImport
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to succeed
    const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: mockUserId });
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
    
    // Mock Firestore to return a valid list
    const mockListGet = jest.fn().mockResolvedValue({ 
      exists: true,
      data: () => ({ ownerId: mockUserId }) 
    });
    const mockListDoc = jest.fn().mockReturnValue({ get: mockListGet });
    const mockItemsGet = jest.fn().mockResolvedValue({ 
      docs: [],
    });
    const mockItemsCollectionRef = jest.fn().mockReturnValue({ get: mockItemsGet });
    const mockCollection = jest.fn((...args) => {
      if (args[0] === 'users') {
        const mockUserCollection = jest.fn((userId) => {
          if (userId === mockUserId) {
            const mockCustomListsCollection = jest.fn((listType) => {
              if (listType === 'custom_lists') {
                const mockListRef = jest.fn((listId) => {
                  if (listId === mockListId) {
                    return { get: mockListGet, collection: mockItemsCollectionRef };
                  }
                  return { get: jest.fn().mockResolvedValue({ exists: false }) };
                });
                return mockListRef;
              }
              return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
            });
            return mockCustomListsCollection;
          }
          return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
        });
        return mockUserCollection;
      }
      return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
    });
    
    const mockDb = {
      collection: mockCollection,
    };
    
    mockFirestore.mockReturnValue(mockDb);

    await confirmListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Request body must contain an array of moviesToImport' });
  });

  it('should successfully add movies that are not duplicates to the list', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/confirm`,
      headers: {
        authorization: 'Bearer valid-token',
      },
      body: { moviesToImport: ['123', '789'] } // 123 already exists, 789 is new
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to succeed
    const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: mockUserId });
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
    
    // Mock Firestore to return a valid list and items
    const mockListGet = jest.fn().mockResolvedValue({ 
      exists: true,
      data: () => ({ ownerId: mockUserId }) 
    });
    const mockListDoc = jest.fn().mockReturnValue({ get: mockListGet });
    
    // Mock existing items - movie with ID '123' already exists
    const mockItemsGet = jest.fn().mockResolvedValue({ 
      docs: [
        { data: () => ({ id: '123', title: 'Existing Movie', release_date: '2022-01-01' }) }
      ]
    });
    const mockSet = jest.fn();
    const mockCommit = jest.fn().mockResolvedValue([]);
    const mockBatch = jest.fn(() => ({
      set: mockSet,
      commit: mockCommit
    }));
    
    const mockItemsCollectionRef = jest.fn().mockReturnValue({ 
      get: mockItemsGet,
      doc: jest.fn(() => ({})) // Mock doc method
    });
    
    const mockCollection = jest.fn((...args) => {
      if (args[0] === 'users') {
        const mockUserCollection = jest.fn((userId) => {
          if (userId === mockUserId) {
            const mockCustomListsCollection = jest.fn((listType) => {
              if (listType === 'custom_lists') {
                const mockListRef = jest.fn((listId) => {
                  if (listId === mockListId) {
                    return { get: mockListGet, collection: mockItemsCollectionRef };
                  }
                  return { get: jest.fn().mockResolvedValue({ exists: false }) };
                });
                return mockListRef;
              }
              return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
            });
            return mockCustomListsCollection;
          }
          return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
        });
        return mockUserCollection;
      }
      return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
    });
    
    const mockDb = {
      collection: mockCollection,
      batch: mockBatch
    };
    
    mockFirestore.mockReturnValue(mockDb);
    (admin.firestore as any).FieldValue = {
      serverTimestamp: jest.fn(() => ({ __type: 'serverTimestamp' })),
    };

    const originalFetch = (globalThis as any).fetch;
    process.env.TMDB_API_KEY = 'test-key';
    (globalThis as any).fetch = jest.fn(async (url: string) => {
      if (url.includes('/movie/789')) {
        return {
          ok: true,
          json: async () => ({
            id: 789,
            title: 'New Movie',
            release_date: '2023-01-01',
            poster_path: '/new-movie.jpg',
            vote_average: 7.7,
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    await confirmListImport(req as any, res as any);

    (globalThis as any).fetch = originalFetch;
    delete process.env.TMDB_API_KEY;

    expect(res.status).toHaveBeenCalledWith(201);
    // Only 1 movie should be added since '123' already exists
    expect(res.json).toHaveBeenCalledWith({ 
      success: true, 
      moviesAdded: 1,
      message: '1 movies successfully added to the list'
    });
  });

  it('should return success with 0 movies added if all are duplicates', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/confirm`,
      headers: {
        authorization: 'Bearer valid-token',
      },
      body: { moviesToImport: ['123', '456'] } // Both already exist
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to succeed
    const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: mockUserId });
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
    
    // Mock Firestore to return a valid list and items
    const mockListGet = jest.fn().mockResolvedValue({ 
      exists: true,
      data: () => ({ ownerId: mockUserId }) 
    });
    const mockListDoc = jest.fn().mockReturnValue({ get: mockListGet });
    
    // Mock existing items - both movies already exist
    const mockItemsGet = jest.fn().mockResolvedValue({ 
      docs: [
        { data: () => ({ id: '123', title: 'Existing Movie 1', release_date: '2022-01-01' }) },
        { data: () => ({ id: '456', title: 'Existing Movie 2', release_date: '2023-01-01' }) }
      ]
    });
    const mockItemsCollectionRef = jest.fn().mockReturnValue({ 
      get: mockItemsGet,
      doc: jest.fn(() => ({})) // Mock doc method
    });
    
    const mockCollection = jest.fn((...args) => {
      if (args[0] === 'users') {
        const mockUserCollection = jest.fn((userId) => {
          if (userId === mockUserId) {
            const mockCustomListsCollection = jest.fn((listType) => {
              if (listType === 'custom_lists') {
                const mockListRef = jest.fn((listId) => {
                  if (listId === mockListId) {
                    return { get: mockListGet, collection: mockItemsCollectionRef };
                  }
                  return { get: jest.fn().mockResolvedValue({ exists: false }) };
                });
                return mockListRef;
              }
              return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
            });
            return mockCustomListsCollection;
          }
          return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
        });
        return mockUserCollection;
      }
      return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
    });
    
    const mockDb = {
      collection: mockCollection,
      batch: jest.fn(() => ({
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue([])
      }))
    };
    
    mockFirestore.mockReturnValue(mockDb);

    await confirmListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ 
      success: true, 
      moviesAdded: 0,
      message: '0 movies successfully added to the list'
    });
  });
});