import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Research Ledger CRUD Tests
 * Tests for Create, Read, Update, Delete operations on research entries
 */

// Types
interface ResearchEntry {
  id: string;
  title: string;
  companyName: string;
  sector: string;
  status: 'active' | 'pending' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateEntryInput {
  title: string;
  companyName: string;
  sector?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: string;
  notes?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

// Mock Research Ledger API
class ResearchLedgerAPI {
  private entries: Map<string, ResearchEntry> = new Map();
  private idCounter = 1;

  // CREATE
  createEntry(input: CreateEntryInput): { success: boolean; entry?: ResearchEntry; errors?: ValidationError[] } {
    const errors: ValidationError[] = [];

    // Validate required fields
    if (!input.title || input.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title is required' });
    }
    if (!input.companyName || input.companyName.trim().length === 0) {
      errors.push({ field: 'companyName', message: 'Company name is required' });
    }
    if (!input.assignedTo || input.assignedTo.trim().length === 0) {
      errors.push({ field: 'assignedTo', message: 'Assigned user is required' });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const now = new Date().toISOString();
    const entry: ResearchEntry = {
      id: `entry-${this.idCounter++}`,
      title: input.title.trim(),
      companyName: input.companyName.trim(),
      sector: input.sector || 'unspecified',
      status: 'active',
      priority: input.priority || 'medium',
      assignedTo: input.assignedTo.trim(),
      notes: input.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    this.entries.set(entry.id, entry);
    return { success: true, entry };
  }

  // READ - Single
  getEntry(id: string): ResearchEntry | null {
    return this.entries.get(id) || null;
  }

  // READ - Query (list with filters)
  queryEntries(filters?: {
    status?: ResearchEntry['status'];
    priority?: ResearchEntry['priority'];
    sector?: string;
    assignedTo?: string;
  }): ResearchEntry[] {
    let results = Array.from(this.entries.values());

    if (filters?.status) {
      results = results.filter(e => e.status === filters.status);
    }
    if (filters?.priority) {
      results = results.filter(e => e.priority === filters.priority);
    }
    if (filters?.sector) {
      results = results.filter(e => e.sector === filters.sector);
    }
    if (filters?.assignedTo) {
      results = results.filter(e => e.assignedTo === filters.assignedTo);
    }

    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // UPDATE
  updateEntry(
    id: string,
    updates: Partial<Pick<ResearchEntry, 'title' | 'companyName' | 'notes' | 'priority' | 'status'>>
  ): { success: boolean; entry?: ResearchEntry; error?: string } {
    const entry = this.entries.get(id);
    if (!entry) {
      return { success: false, error: 'Entry not found' };
    }

    // Apply updates
    Object.assign(entry, updates, { updatedAt: new Date().toISOString() });
    
    return { success: true, entry };
  }

  updateStatus(
    id: string,
    status: ResearchEntry['status']
  ): { success: boolean; entry?: ResearchEntry; error?: string } {
    return this.updateEntry(id, { status });
  }

  // ARCHIVE (soft delete)
  archiveEntry(id: string): { success: boolean; entry?: ResearchEntry; error?: string } {
    const entry = this.entries.get(id);
    if (!entry) {
      return { success: false, error: 'Entry not found' };
    }

    entry.status = 'archived';
    entry.updatedAt = new Date().toISOString();
    
    return { success: true, entry };
  }

  // HARD DELETE
  deleteEntry(id: string): { success: boolean; error?: string } {
    const exists = this.entries.has(id);
    if (!exists) {
      return { success: false, error: 'Entry not found' };
    }

    this.entries.delete(id);
    return { success: true };
  }

  // Utility
  getCount(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.idCounter = 1;
  }
}

describe('Research Ledger CRUD', () => {
  let api: ResearchLedgerAPI;

  beforeEach(() => {
    api = new ResearchLedgerAPI();
  });

  describe('CREATE - Entry with required fields', () => {
    it('should create entry with all required fields', () => {
      const input: CreateEntryInput = {
        title: 'Market Research: AI Sector',
        companyName: 'TechCorp Inc',
        assignedTo: 'analyst@company.com',
      };

      const result = api.createEntry(input);

      expect(result.success).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry!.id).toBeDefined();
      expect(result.entry!.title).toBe('Market Research: AI Sector');
      expect(result.entry!.companyName).toBe('TechCorp Inc');
      expect(result.entry!.assignedTo).toBe('analyst@company.com');
    });

    it('should create entry with optional fields', () => {
      const input: CreateEntryInput = {
        title: 'Competitor Analysis',
        companyName: 'Rival Corp',
        sector: 'Technology',
        priority: 'high',
        assignedTo: 'researcher@company.com',
        notes: 'Focus on their new product line',
      };

      const result = api.createEntry(input);

      expect(result.success).toBe(true);
      expect(result.entry!.sector).toBe('Technology');
      expect(result.entry!.priority).toBe('high');
      expect(result.entry!.notes).toBe('Focus on their new product line');
    });

    it('should reject entry without title', () => {
      const input: CreateEntryInput = {
        title: '',
        companyName: 'Some Corp',
        assignedTo: 'analyst@company.com',
      };

      const result = api.createEntry(input);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.field === 'title')).toBe(true);
    });

    it('should reject entry without company name', () => {
      const input: CreateEntryInput = {
        title: 'Research Task',
        companyName: '',
        assignedTo: 'analyst@company.com',
      };

      const result = api.createEntry(input);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.field === 'companyName')).toBe(true);
    });

    it('should reject entry without assigned user', () => {
      const input: CreateEntryInput = {
        title: 'Research Task',
        companyName: 'Some Corp',
        assignedTo: '',
      };

      const result = api.createEntry(input);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.field === 'assignedTo')).toBe(true);
    });

    it('should set default values for optional fields', () => {
      const input: CreateEntryInput = {
        title: 'Basic Research',
        companyName: 'Company Ltd',
        assignedTo: 'user@company.com',
      };

      const result = api.createEntry(input);

      expect(result.success).toBe(true);
      expect(result.entry!.status).toBe('active'); // Default status
      expect(result.entry!.priority).toBe('medium'); // Default priority
      expect(result.entry!.sector).toBe('unspecified'); // Default sector
      expect(result.entry!.notes).toBe(''); // Default notes
    });

    it('should generate unique IDs', () => {
      const result1 = api.createEntry({
        title: 'Entry 1',
        companyName: 'Corp 1',
        assignedTo: 'user@company.com',
      });
      const result2 = api.createEntry({
        title: 'Entry 2',
        companyName: 'Corp 2',
        assignedTo: 'user@company.com',
      });

      expect(result1.entry!.id).not.toBe(result2.entry!.id);
    });

    it('should set timestamps on creation', () => {
      const beforeCreate = Date.now();
      
      const result = api.createEntry({
        title: 'Timed Entry',
        companyName: 'Timed Corp',
        assignedTo: 'user@company.com',
      });
      
      const afterCreate = Date.now();

      const createdTimestamp = new Date(result.entry!.createdAt).getTime();
      expect(createdTimestamp).toBeGreaterThanOrEqual(beforeCreate);
      expect(createdTimestamp).toBeLessThanOrEqual(afterCreate);
      expect(result.entry!.createdAt).toBe(result.entry!.updatedAt);
    });
  });

  describe('READ - Query entries', () => {
    beforeEach(() => {
      // Seed with test data
      api.createEntry({
        title: 'High Priority AI Research',
        companyName: 'AI Corp',
        priority: 'critical',
        assignedTo: 'analyst@company.com',
      });
      api.createEntry({
        title: 'Medium Priority SaaS Analysis',
        companyName: 'SaaS Inc',
        priority: 'medium',
        assignedTo: 'analyst@company.com',
      });
      api.createEntry({
        title: 'Low Priority Retail Study',
        companyName: 'Retail Ltd',
        priority: 'low',
        assignedTo: 'researcher@company.com',
      });
    });

    it('should read single entry by ID', () => {
      const created = api.createEntry({
        title: 'Findable Entry',
        companyName: 'Findable Corp',
        assignedTo: 'user@company.com',
      });

      const found = api.getEntry(created.entry!.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.entry!.id);
      expect(found!.title).toBe('Findable Entry');
    });

    it('should return null for non-existent entry', () => {
      const found = api.getEntry('non-existent-id');
      expect(found).toBeNull();
    });

    it('should query all entries without filters', () => {
      const entries = api.queryEntries();
      expect(entries.length).toBeGreaterThanOrEqual(3);
    });

    it('should query entries by status', () => {
      const activeEntries = api.queryEntries({ status: 'active' });
      expect(activeEntries.length).toBeGreaterThan(0);
      activeEntries.forEach(entry => {
        expect(entry.status).toBe('active');
      });
    });

    it('should query entries by priority', () => {
      const criticalEntries = api.queryEntries({ priority: 'critical' });
      expect(criticalEntries.length).toBe(1);
      expect(criticalEntries[0].title).toBe('High Priority AI Research');
    });

    it('should query entries by assigned user', () => {
      const analystEntries = api.queryEntries({ assignedTo: 'analyst@company.com' });
      expect(analystEntries.length).toBe(2);
    });

    it('should return empty array for non-matching filters', () => {
      const entries = api.queryEntries({ priority: 'high' }); // No high priority entries
      expect(entries).toEqual([]);
    });
  });

  describe('UPDATE - Entry status', () => {
    it('should update entry status', () => {
      const created = api.createEntry({
        title: 'Update Test',
        companyName: 'Update Corp',
        assignedTo: 'user@company.com',
      });

      const result = api.updateStatus(created.entry!.id, 'completed');

      expect(result.success).toBe(true);
      expect(result.entry!.status).toBe('completed');
    });

    it('should update entry title and notes', () => {
      const created = api.createEntry({
        title: 'Original Title',
        companyName: 'Update Corp',
        assignedTo: 'user@company.com',
        notes: 'Original notes',
      });

      const result = api.updateEntry(created.entry!.id, {
        title: 'Updated Title',
        notes: 'Updated notes',
      });

      expect(result.success).toBe(true);
      expect(result.entry!.title).toBe('Updated Title');
      expect(result.entry!.notes).toBe('Updated notes');
    });

    it('should update updatedAt timestamp on modification', async () => {
      const created = api.createEntry({
        title: 'Timestamp Test',
        companyName: 'Time Corp',
        assignedTo: 'user@company.com',
      });

      const originalUpdatedAt = created.entry!.updatedAt;
      
      // Small delay to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = api.updateStatus(created.entry!.id, 'completed');

      expect(result.entry!.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should fail update for non-existent entry', () => {
      const result = api.updateEntry('non-existent-id', { title: 'New Title' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Entry not found');
    });

    it('should fail status update for non-existent entry', () => {
      const result = api.updateStatus('non-existent-id', 'completed');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Entry not found');
    });

    it('should allow all valid status transitions', () => {
      const created = api.createEntry({
        title: 'Status Transition Test',
        companyName: 'Status Corp',
        assignedTo: 'user@company.com',
      });

      const id = created.entry!.id;

      // active -> pending
      let result = api.updateStatus(id, 'pending');
      expect(result.entry!.status).toBe('pending');

      // pending -> active
      result = api.updateStatus(id, 'active');
      expect(result.entry!.status).toBe('active');

      // active -> completed
      result = api.updateStatus(id, 'completed');
      expect(result.entry!.status).toBe('completed');

      // completed -> active (reopen)
      result = api.updateStatus(id, 'active');
      expect(result.entry!.status).toBe('active');

      // active -> archived
      result = api.updateStatus(id, 'archived');
      expect(result.entry!.status).toBe('archived');
    });
  });

  describe('ARCHIVE/DELETE - Entry removal', () => {
    it('should archive entry (soft delete)', () => {
      const created = api.createEntry({
        title: 'Archive Test',
        companyName: 'Archive Corp',
        assignedTo: 'user@company.com',
      });

      const archived = api.archiveEntry(created.entry!.id);

      expect(archived.success).toBe(true);
      expect(archived.entry!.status).toBe('archived');
      expect(archived.entry!.title).toBe('Archive Test'); // Data preserved
    });

    it('should still retrieve archived entries', () => {
      const created = api.createEntry({
        title: 'Findable Archive',
        companyName: 'Archive Corp',
        assignedTo: 'user@company.com',
      });

      api.archiveEntry(created.entry!.id);
      const found = api.getEntry(created.entry!.id);

      expect(found).toBeDefined();
      expect(found!.status).toBe('archived');
    });

    it('should hard delete entry', () => {
      const created = api.createEntry({
        title: 'Delete Test',
        companyName: 'Delete Corp',
        assignedTo: 'user@company.com',
      });

      const id = created.entry!.id;
      const countBefore = api.getCount();

      const deleted = api.deleteEntry(id);

      expect(deleted.success).toBe(true);
      expect(api.getCount()).toBe(countBefore - 1);
      expect(api.getEntry(id)).toBeNull();
    });

    it('should fail archive for non-existent entry', () => {
      const result = api.archiveEntry('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Entry not found');
    });

    it('should fail delete for non-existent entry', () => {
      const result = api.deleteEntry('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Entry not found');
    });
  });
});
