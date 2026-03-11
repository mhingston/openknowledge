import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgePlugin } from './plugin';
import { DatabaseAdapter } from './database';
import { KnowledgeInjection } from './injection';
import { KnowledgePipeline } from './pipeline';
import { KnowledgeRetrieval } from './retrieval';

describe('KnowledgePlugin', () => {
  let plugin: KnowledgePlugin;
  let mockDb: any;
  let mockInjector: any;
  let mockPipeline: any;
  let mockRetrieval: any;

  beforeEach(() => {
    mockDb = {
      getAllKnowledge: vi.fn(),
      createKnowledge: vi.fn(),
      getByType: vi.fn(),
      getByStatus: vi.fn(),
      getByImportance: vi.fn(),
      getKnowledge: vi.fn(),
    };

    mockInjector = {
      generateXML: vi.fn(),
    };

    mockPipeline = {
      processSession: vi.fn(),
    };

    mockRetrieval = {
      search: vi.fn(),
    };
    
    plugin = new KnowledgePlugin({
      db: mockDb,
      injector: mockInjector,
      pipeline: mockPipeline,
      retrieval: mockRetrieval
    });
  });

  describe('constructor', () => {
    it('initializes with injected dependencies', () => {
      expect(plugin.db).toBe(mockDb);
      expect(plugin.injector).toBe(mockInjector);
      expect(plugin.pipeline).toBe(mockPipeline);
      expect(plugin.retrieval).toBe(mockRetrieval);
    });
  });

  describe('registerHooks', () => {
    it('registers sessionStart hook', async () => {
      const mockRegister = vi.fn();
      
      await plugin.registerHooks({ register: mockRegister });
      
      expect(mockRegister).toHaveBeenCalledWith('sessionStart', expect.any(Function));
    });

    it('registers sessionEnd hook', async () => {
      const mockRegister = vi.fn();
      
      await plugin.registerHooks({ register: mockRegister });
      
      expect(mockRegister).toHaveBeenCalledWith('sessionEnd', expect.any(Function));
    });

    it('registers sessionIdle hook', async () => {
      const mockRegister = vi.fn();
      
      await plugin.registerHooks({ register: mockRegister });
      
      expect(mockRegister).toHaveBeenCalledWith('sessionIdle', expect.any(Function));
    });
  });

  describe('onSessionStart', () => {
    it('injects knowledge into session', async () => {
      const mockGenerateXML = vi.fn().mockReturnValue('<xml/>');
      mockInjector.generateXML = mockGenerateXML;
      
      await plugin.onSessionStart({ sessionId: 'test-123' });
      
      expect(mockGenerateXML).toHaveBeenCalledWith(10, 'test-123');
    });
  });

  describe('onSessionEnd', () => {
    it('triggers extraction pipeline when patterns are detected', async () => {
      const mockProcess = vi.fn().mockReturnValue({ extracted: [{ id: '1' }] });
      mockPipeline.processSession = mockProcess;
      
      const result = await plugin.onSessionEnd({ 
        sessionId: 'test-123',
        messages: [{ role: 'user', content: 'We decided to use microservices architecture' }]
      });
      
      expect(mockProcess).toHaveBeenCalled();
      expect(result.extracted).toBe(1);
    });

    it('skips extraction when no patterns detected', async () => {
      const result = await plugin.onSessionEnd({ 
        sessionId: 'test-123',
        messages: [{ role: 'user', content: 'hello' }]
      });
      
      expect(result.extracted).toBe(0);
    });
  });

  describe('onSessionIdle', () => {
    it('runs extraction for high-signal sessions', async () => {
      const mockProcess = vi.fn().mockReturnValue({ extracted: [{ id: '1' }] });
      mockPipeline.processSession = mockProcess;
      
      const result = await plugin.onSessionIdle({ 
        sessionId: 'test-123',
        messages: [{ role: 'user', content: 'We switched to a new framework' }],
        idleTime: 300000
      });
      
      expect(mockProcess).toHaveBeenCalled();
      expect(result.extracted).toBe(1);
    });
  });

  describe('CLI commands', () => {
    describe('list-knowledge', () => {
      it('lists all knowledge objects', async () => {
        mockDb.getAllKnowledge.mockReturnValue([
          { id: '1', summary: 'Test knowledge', type: 'insight', title: 'Test', importance: 0.8 }
        ]);
        
        const output = await plugin.listKnowledge({ limit: 10 });
        
        expect(mockDb.getAllKnowledge).toHaveBeenCalled();
        expect(output).toContain('Test');
      });

      it('returns message when no knowledge found', async () => {
        mockDb.getAllKnowledge.mockReturnValue([]);
        
        const output = await plugin.listKnowledge({ limit: 10 });
        
        expect(output).toBe('No knowledge objects found.');
      });
    });

    describe('search-knowledge', () => {
      it('searches knowledge by query', async () => {
        mockRetrieval.search.mockReturnValue([
          { id: '1', summary: 'Relevant knowledge', type: 'decision', title: 'Relevant', importance: 0.9 }
        ]);
        
        const output = await plugin.searchKnowledge({ query: 'relevant', limit: 5 });
        
        expect(mockRetrieval.search).toHaveBeenCalledWith('relevant', 5);
        expect(output).toContain('Relevant');
      });

      it('returns message when no results found', async () => {
        mockRetrieval.search.mockReturnValue([]);
        
        const output = await plugin.searchKnowledge({ query: 'nonexistent', limit: 5 });
        
        expect(output).toBe('No results found for query: nonexistent');
      });
    });
  });
});
