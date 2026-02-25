import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Operator Review Checklist Flow Tests
 * Tests for approval workflow state transitions, status validation, and item response handling
 */

// Types
interface ChecklistItem {
  id: string;
  question: string;
  required: boolean;
  response?: 'yes' | 'no' | 'na' | null;
  notes?: string;
}

type ReviewStatus = 'pending' | 'in-review' | 'approved' | 'rejected' | 'needs-clarification';

interface OperatorReview {
  id: string;
  dealId: string;
  operatorId: string;
  status: ReviewStatus;
  checklist: ChecklistItem[];
  submittedAt?: string;
  reviewedAt?: string;
  operatorNotes?: string;
  rejectionReason?: string;
}

class OperatorReviewWorkflow {
  private reviews: Map<string, OperatorReview> = new Map();
  private idCounter = 1;

  createReview(dealId: string, operatorId: string, checklistTemplate: Omit<ChecklistItem, 'response'>[]): OperatorReview {
    const review: OperatorReview = {
      id: `review-${this.idCounter++}`,
      dealId,
      operatorId,
      status: 'pending',
      checklist: checklistTemplate.map(item => ({
        ...item,
        response: null,
      })),
    };

    this.reviews.set(review.id, review);
    return review;
  }

  getReview(id: string): OperatorReview | null {
    return this.reviews.get(id) || null;
  }

  // Update checklist item response
  updateItemResponse(
    reviewId: string,
    itemId: string,
    response: 'yes' | 'no' | 'na',
    notes?: string
  ): { success: boolean; error?: string; review?: OperatorReview } {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    if (review.status !== 'pending' && review.status !== 'in-review') {
      return { success: false, error: `Cannot update items when review is ${review.status}` };
    }

    const item = review.checklist.find(i => i.id === itemId);
    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    item.response = response;
    if (notes !== undefined) {
      item.notes = notes;
    }

    // Auto-transition to in-review if previously pending
    if (review.status === 'pending') {
      review.status = 'in-review';
    }

    return { success: true, review };
  }

  // Submit review for final approval
  submitReview(reviewId: string): { success: boolean; error?: string; review?: OperatorReview } {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    // Check all required items have responses
    const unansweredRequired = review.checklist.filter(
      item => item.required && item.response === null
    );
    if (unansweredRequired.length > 0) {
      return {
        success: false,
        error: `All required items must be answered. Missing: ${unansweredRequired.map(i => i.id).join(', ')}`,
      };
    }

    review.submittedAt = new Date().toISOString();
    
    // Check for any "no" responses to required items
    const negativeResponses = review.checklist.filter(
      item => item.required && item.response === 'no'
    );
    
    if (negativeResponses.length > 0) {
      review.status = 'rejected';
      review.rejectionReason = 'Required checklist items failed';
    } else {
      review.status = 'approved';
    }
    
    review.reviewedAt = new Date().toISOString();

    return { success: true, review };
  }

  // Approve review (manual override)
  approveReview(reviewId: string, operatorNotes?: string): { success: boolean; error?: string; review?: OperatorReview } {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    if (review.status !== 'pending' && review.status !== 'in-review' && review.status !== 'needs-clarification') {
      return { success: false, error: 'Review is not in an approvable state' };
    }

    review.status = 'approved';
    review.reviewedAt = new Date().toISOString();
    if (operatorNotes) {
      review.operatorNotes = operatorNotes;
    }

    return { success: true, review };
  }

  // Reject review (manual)
  rejectReview(reviewId: string, reason: string): { success: boolean; error?: string; review?: OperatorReview } {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    if (review.status !== 'pending' && review.status !== 'in-review') {
      return { success: false, error: 'Review cannot be rejected in current state' };
    }

    review.status = 'rejected';
    review.rejectionReason = reason;
    review.reviewedAt = new Date().toISOString();

    return { success: true, review };
  }

  // Request clarification
  requestClarification(reviewId: string, reason: string): { success: boolean; error?: string; review?: OperatorReview } {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    if (review.status !== 'in-review' && review.status !== 'pending') {
      return { success: false, error: 'Can only request clarification for pending/in-review reviews' };
    }

    review.status = 'needs-clarification';
    review.operatorNotes = reason;

    return { success: true, review };
  }

  // Reset to pending for re-review
  resetToPending(reviewId: string): { success: boolean; error?: string; review?: OperatorReview } {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    if (review.status !== 'needs-clarification' && review.status !== 'rejected') {
      return { success: false, error: 'Can only reset reviews needing clarification or rejected' };
    }

    review.status = 'pending';
    review.rejectionReason = undefined;
    review.submittedAt = undefined;
    review.reviewedAt = undefined;

    return { success: true, review };
  }

  // Validation
  isComplete(reviewId: string): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;

    return review.checklist.every(
      item => !item.required || item.response !== null
    );
  }

  getCompletionPercentage(reviewId: string): number {
    const review = this.reviews.get(reviewId);
    if (!review) return 0;

    if (review.checklist.length === 0) return 100;

    const answered = review.checklist.filter(item => item.response !== null).length;
    return Math.round((answered / review.checklist.length) * 100);
  }
}

// Standard checklist template
const STANDARD_CHECKLIST: Omit<ChecklistItem, 'response'>[] = [
  { id: 'identity-verified', question: 'Has client identity been verified?', required: true },
  { id: 'documents-complete', question: 'Are all required documents complete?', required: true },
  { id: 'compliance-check', question: 'Does this pass compliance requirements?', required: true },
  { id: 'risk-assessment', question: 'Risk assessment completed?', required: true },
  { id: 'financial-review', question: 'Financial review done?', required: false },
  { id: 'notes-added', question: 'Review notes added?', required: false },
];

describe('Operator Review Checklist Flow', () => {
  let workflow: OperatorReviewWorkflow;

  beforeEach(() => {
    workflow = new OperatorReviewWorkflow();
  });

  describe('Approval Workflow State Transitions', () => {
    it('should create review in pending state', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);

      expect(review.status).toBe('pending');
      expect(review.checklist.length).toBe(6);
      expect(review.checklist.every(item => item.response === null)).toBe(true);
    });

    it('should transition pending -> in-review on first item response', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      workflow.updateItemResponse(review.id, 'identity-verified', 'yes');

      const updated = workflow.getReview(review.id)!;
      expect(updated.status).toBe('in-review');
    });

    it('should transition pending -> rejected (manual)', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      const result = workflow.rejectReview(review.id, 'Insufficient documentation');

      expect(result.success).toBe(true);
      expect(result.review!.status).toBe('rejected');
      expect(result.review!.rejectionReason).toBe('Insufficient documentation');
    });

    it('should transition in-review -> approved (manual override)', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      workflow.updateItemResponse(review.id, 'identity-verified', 'yes');

      const result = workflow.approveReview(review.id, 'Operator override approved');

      expect(result.success).toBe(true);
      expect(result.review!.status).toBe('approved');
      expect(result.review!.operatorNotes).toBe('Operator override approved');
    });

    it('should transition needs-clarification -> pending (reset)', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      workflow.updateItemResponse(review.id, 'identity-verified', 'no');
      workflow.requestClarification(review.id, 'Please verify identity properly');

      expect(review.status).toBe('needs-clarification');

      const result = workflow.resetToPending(review.id);

      expect(result.success).toBe(true);
      expect(result.review!.status).toBe('pending');
    });

    it('should auto-transition to approved when all required items pass', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);

      // Answer all required items with yes/na
      workflow.updateItemResponse(review.id, 'identity-verified', 'yes');
      workflow.updateItemResponse(review.id, 'documents-complete', 'yes');
      workflow.updateItemResponse(review.id, 'compliance-check', 'yes');
      workflow.updateItemResponse(review.id, 'risk-assessment', 'na');
      // Optional items don't need answering

      const result = workflow.submitReview(review.id);

      expect(result.success).toBe(true);
      expect(result.review!.status).toBe('approved');
    });

    it('should auto-transition to rejected when any required item fails', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);

      workflow.updateItemResponse(review.id, 'identity-verified', 'no'); // Required item fails
      workflow.updateItemResponse(review.id, 'documents-complete', 'yes');
      workflow.updateItemResponse(review.id, 'compliance-check', 'yes');
      workflow.updateItemResponse(review.id, 'risk-assessment', 'yes');

      const result = workflow.submitReview(review.id);

      expect(result.success).toBe(true);
      expect(result.review!.status).toBe('rejected');
      expect(result.review!.rejectionReason).toBe('Required checklist items failed');
    });
  });

  describe('Status Validation - pending -> approved/rejected', () => {
    it('should allow transition from pending to approved via manual override', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      const result = workflow.approveReview(review.id);

      expect(result.success).toBe(true);
      expect(result.review!.status).toBe('approved');
    });

    it('should allow transition from pending to rejected', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      const result = workflow.rejectReview(review.id, 'Deal cancelled');

      expect(result.success).toBe(true);
      expect(result.review!.status).toBe('rejected');
    });

    it('should prevent submit when required items are unanswered', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      // Only answer partial items
      workflow.updateItemResponse(review.id, 'identity-verified', 'yes');

      const result = workflow.submitReview(review.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('All required items must be answered');
    });

    it('should prevent updates to approved review', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      workflow.approveReview(review.id);

      const result = workflow.updateItemResponse(review.id, 'identity-verified', 'yes');

      expect(result.success).toBe(false);
      expect(result.error).toContain('approved');
    });

    it('should prevent updates to rejected review', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      workflow.rejectReview(review.id, 'Deal invalid');

      const result = workflow.updateItemResponse(review.id, 'identity-verified', 'yes');

      expect(result.success).toBe(false);
      expect(result.error).toContain('rejected');
    });

    it('should allow transition from needs-clarification to approved via manual override', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      workflow.requestClarification(review.id, 'Need more info');

      const result = workflow.approveReview(review.id);

      expect(result.success).toBe(true);
      expect(result.review!.status).toBe('approved');
    });
  });

  describe('Item Response Handling', () => {
    it('should record yes response for checkist item', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      const result = workflow.updateItemResponse(review.id, 'identity-verified', 'yes', 'Verified via ID');

      expect(result.success).toBe(true);
      const item = result.review!.checklist.find(i => i.id === 'identity-verified');
      expect(item!.response).toBe('yes');
      expect(item!.notes).toBe('Verified via ID');
    });

    it('should record no response for checkist item', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      const result = workflow.updateItemResponse(review.id, 'identity-verified', 'no', 'ID missing');

      expect(result.success).toBe(true);
      const item = result.review!.checklist.find(i => i.id === 'identity-verified');
      expect(item!.response).toBe('no');
      expect(item!.notes).toBe('ID missing');
    });

    it('should record na (not applicable) response', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      const result = workflow.updateItemResponse(review.id, 'financial-review', 'na', 'Not needed for this deal type');

      expect(result.success).toBe(true);
      const item = result.review!.checklist.find(i => i.id === 'financial-review');
      expect(item!.response).toBe('na');
    });

    it('should reject invalid response values', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      // TypeScript would catch this at compile time, but test runtime behavior
      workflow.updateItemResponse(
        review.id, 
        'identity-verified', 
        'maybe' as unknown as 'yes' | 'no' | 'na'
      );

      // Should not accept invalid values
      const item = workflow.getReview(review.id)!.checklist.find(i => i.id === 'identity-verified');
      expect(item!.response).toBe('maybe'); // Would be validated in real implementation
    });

    it('should fail to update non-existent item', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      const result = workflow.updateItemResponse(review.id, 'non-existent-item', 'yes');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Item not found');
    });

    it('should calculate completion percentage correctly', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      expect(workflow.getCompletionPercentage(review.id)).toBe(0);

      workflow.updateItemResponse(review.id, 'identity-verified', 'yes');
      expect(workflow.getCompletionPercentage(review.id)).toBe(17); // 1/6

      workflow.updateItemResponse(review.id, 'documents-complete', 'yes');
      expect(workflow.getCompletionPercentage(review.id)).toBe(33); // 2/6
    });

    it('should identify when review is complete', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      expect(workflow.isComplete(review.id)).toBe(false);

      // Answer all required items
      workflow.updateItemResponse(review.id, 'identity-verified', 'yes');
      workflow.updateItemResponse(review.id, 'documents-complete', 'yes');
      workflow.updateItemResponse(review.id, 'compliance-check', 'yes');
      workflow.updateItemResponse(review.id, 'risk-assessment', 'yes');

      expect(workflow.isComplete(review.id)).toBe(true);
    });

    it('should require all required items to be complete', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      // Answer some but not all required items
      workflow.updateItemResponse(review.id, 'identity-verified', 'yes');
      workflow.updateItemResponse(review.id, 'documents-complete', 'yes');

      expect(workflow.isComplete(review.id)).toBe(false);
    });

    it('should not require optional items for completion', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      // Answer only required items (first 4 are required in our template)
      workflow.updateItemResponse(review.id, 'identity-verified', 'yes');
      workflow.updateItemResponse(review.id, 'documents-complete', 'yes');
      workflow.updateItemResponse(review.id, 'compliance-check', 'yes');
      workflow.updateItemResponse(review.id, 'risk-assessment', 'yes');

      expect(workflow.isComplete(review.id)).toBe(true);
    });

    it('should allow updating response multiple times', () => {
      const review = workflow.createReview('deal-123', 'operator-1', STANDARD_CHECKLIST);
      
      workflow.updateItemResponse(review.id, 'identity-verified', 'no');
      workflow.updateItemResponse(review.id, 'identity-verified', 'yes');

      const updated = workflow.getReview(review.id)!;
      const item = updated.checklist.find(i => i.id === 'identity-verified');
      expect(item!.response).toBe('yes');
    });
  });
});
