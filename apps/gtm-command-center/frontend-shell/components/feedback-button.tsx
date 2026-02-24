'use client';

import React, { useState, useCallback } from 'react';

export interface FeedbackContext {
    page: string;
    section: string;
    previous_actions?: string[];
    ui_state?: Record<string, any>;
}

export interface FeedbackButtonProps {
    context: FeedbackContext;
    onFeedbackSubmit?: (feedback: {
        signal_type: 'explicit_positive' | 'explicit_negative';
        content?: string;
        context: FeedbackContext;
    }) => Promise<void> | void;
    variant?: 'thumbs' | 'smiley' | 'minimal';
    className?: string;
}

interface FeedbackSubmission {
    signal_type: 'explicit_positive' | 'explicit_negative';
    content?: string;
    context: FeedbackContext;
}

export function FeedbackButton({
    context,
    onFeedbackSubmit,
    variant = 'thumbs',
    className = ''
}: FeedbackButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [feedbackType, setFeedbackType] = useState<'positive' | 'negative' | null>(null);
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleQuickFeedback = useCallback(async (type: 'positive' | 'negative') => {
        setFeedbackType(type);
        setIsOpen(true);
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!feedbackType) return;

        setIsSubmitting(true);

        const submission: FeedbackSubmission = {
            signal_type: feedbackType === 'positive' ? 'explicit_positive' : 'explicit_negative',
            content: content.trim() || undefined,
            context
        };

        try {
            // Store in localStorage as backup
            const feedbackQueue = JSON.parse(localStorage.getItem('feedback_queue') || '[]');
            feedbackQueue.push({
                ...submission,
                timestamp: new Date().toISOString(),
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            });
            localStorage.setItem('feedback_queue', JSON.stringify(feedbackQueue.slice(-50))); // Keep last 50

            // Send to backend if handler provided
            if (onFeedbackSubmit) {
                await onFeedbackSubmit(submission);
            } else {
                // Default: send to backend API
                await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submission)
                });
            }

            setSubmitted(true);
            setTimeout(() => {
                setIsOpen(false);
                setSubmitted(false);
                setContent('');
                setFeedbackType(null);
            }, 1500);
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            // Feedback is queued in localStorage, so user can retry later
        } finally {
            setIsSubmitting(false);
        }
    }, [feedbackType, content, context, onFeedbackSubmit]);

    const handleClose = useCallback(() => {
        if (!isSubmitting) {
            setIsOpen(false);
            setFeedbackType(null);
            setContent('');
        }
    }, [isSubmitting]);

    // Button icons based on variant
    const renderButton = () => {
        switch (variant) {
            case 'smiley':
                return (
                    <>
                        <button
                            onClick={() => handleQuickFeedback('positive')}
                            className="feedback-btn smiley"
                            aria-label="Positive feedback"
                            title="Helpful"
                        >
                            😊
                        </button>
                        <button
                            onClick={() => handleQuickFeedback('negative')}
                            className="feedback-btn smiley"
                            aria-label="Negative feedback"
                            title="Not helpful"
                        >
                            😔
                        </button>
                    </>
                );
            case 'minimal':
                return (
                    <button
                        onClick={() => setIsOpen(true)}
                        className="feedback-btn minimal"
                        aria-label="Give feedback"
                        title="Feedback"
                    >
                        💬
                    </button>
                );
            case 'thumbs':
            default:
                return (
                    <>
                        <button
                            onClick={() => handleQuickFeedback('positive')}
                            className="feedback-btn thumbs"
                            aria-label="Thumbs up"
                            title="Helpful"
                        >
                            👍
                        </button>
                        <button
                            onClick={() => handleQuickFeedback('negative')}
                            className="feedback-btn thumbs"
                            aria-label="Thumbs down"
                            title="Not helpful"
                        >
                            👎
                        </button>
                    </>
                );
        }
    };

    return (
        <div className={`feedback-button-container ${className}`}>
            <div className="feedback-buttons">
                {renderButton()}
            </div>

            {isOpen && (
                <div className="feedback-modal-overlay" onClick={handleClose}>
                    <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
                        {!submitted ? (
                            <>
                                <div className="feedback-modal-header">
                                    <h4>
                                        {feedbackType === 'positive' ? '😊 Thank you!' : '😔 We\'re sorry to hear that'}
                                    </h4>
                                    <button
                                        className="feedback-close-btn"
                                        onClick={handleClose}
                                        aria-label="Close"
                                    >
                                        ×
                                    </button>
                                </div>
                                <p className="feedback-hint">
                                    {feedbackType === 'positive'
                                        ? 'What did you find helpful?'
                                        : 'How can we improve?'}
                                </p>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Optional: share your thoughts..."
                                    className="feedback-textarea"
                                    rows={3}
                                    disabled={isSubmitting}
                                />
                                <div className="feedback-actions">
                                    <button
                                        className="feedback-submit-btn"
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Sending...' : 'Submit'}
                                    </button>
                                    <button
                                        className="feedback-skip-btn"
                                        onClick={handleClose}
                                        disabled={isSubmitting}
                                    >
                                        Skip
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="feedback-success">
                                <div className="feedback-success-icon">✓</div>
                                <p>Thank you for your feedback!</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                .feedback-button-container {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }

                .feedback-buttons {
                    display: flex;
                    gap: 4px;
                }

                .feedback-btn {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 16px;
                    padding: 4px 6px;
                    border-radius: 6px;
                    opacity: 0.6;
                    transition: all 0.2s ease;
                }

                .feedback-btn:hover {
                    opacity: 1;
                    background: rgba(0, 0, 0, 0.05);
                }

                .feedback-btn.thumbs {
                    font-size: 14px;
                }

                .feedback-btn.smiley {
                    font-size: 18px;
                }

                .feedback-btn.minimal {
                    font-size: 14px;
                    padding: 6px;
                }

                .feedback-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    animation: fadeIn 0.2s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .feedback-modal {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    width: 90%;
                    max-width: 400px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    animation: slideUp 0.3s ease;
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .feedback-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }

                .feedback-modal-header h4 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }

                .feedback-close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                    line-height: 1;
                    padding: 0;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                }

                .feedback-close-btn:hover {
                    background: #f0f0f0;
                }

                .feedback-hint {
                    margin: 0 0 12px;
                    font-size: 14px;
                    color: #666;
                }

                .feedback-textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    font-family: inherit;
                    resize: vertical;
                    min-height: 80px;
                }

                .feedback-textarea:focus {
                    outline: none;
                    border-color: #c42874;
                }

                .feedback-textarea:disabled {
                    background: #f5f5f5;
                }

                .feedback-actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 16px;
                    justify-content: flex-end;
                }

                .feedback-submit-btn {
                    background: linear-gradient(135deg, #de347f 0%, #ff5d74 100%);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                }

                .feedback-submit-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                }

                .feedback-submit-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .feedback-skip-btn {
                    background: transparent;
                    border: none;
                    color: #666;
                    padding: 10px 16px;
                    font-size: 14px;
                    cursor: pointer;
                }

                .feedback-skip-btn:hover:not(:disabled) {
                    color: #333;
                }

                .feedback-skip-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .feedback-success {
                    text-align: center;
                    padding: 20px;
                }

                .feedback-success-icon {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    margin: 0 auto 16px;
                }

                .feedback-success p {
                    margin: 0;
                    font-size: 14px;
                    color: #333;
                }
            `}</style>
        </div>
    );
}

export default FeedbackButton;
