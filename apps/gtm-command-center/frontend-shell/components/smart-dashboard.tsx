/**
 * SmartDashboard Component
 * 
 * Demonstrates the Phase 2 Learning Core integration:
 * - Personalized card ordering
 * - Smart suggestions
 * - Learning pipeline status
 * - User feedback integration
 */

'use client';

import React, { useEffect, useState } from 'react';
import { usePersonalization } from '../hooks/use-personalization';
import { useSuggestions, AnySuggestion } from '../lib/suggestion-engine';
import { useLearningScheduler, getSchedulerStatus } from '../lib/learning-scheduler';
import { FeedbackButton } from './feedback-button';
import { DwellTimeTracker } from '../hooks/use-dwell-time';

interface SmartDashboardProps {
  children: React.ReactNode;
  pageName: string;
}

export function SmartDashboard({ children, pageName }: SmartDashboardProps) {
  const { 
    model, 
    uiConfig, 
    isLoading: isModelLoading,
    error: modelError 
  } = usePersonalization();
  
  const { suggestions, isLoading: isSuggestionsLoading } = useSuggestions({
    limit: 3,
    context: { currentPage: pageName },
  });
  
  const scheduler = useLearningScheduler();
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  // Training examples indicator
  const trainingProgress = model?.training_examples 
    ? Math.min((model.training_examples / 50) * 100, 100) 
    : 0;
  
  return (
    <DwellTimeTracker
      sectionId={`dashboard-${pageName}`}
      page={pageName}
      threshold={5000}
    >
      <div className="smart-dashboard">
        {/* Learning Status Bar */}
        <div className="learning-status-bar">
          <div className="learning-status-left">
            <span className="learning-indicator">
              {scheduler.isRunning ? '🧠' : '⏸️'}
            </span>
            <span className="learning-text">
              {scheduler.isRunning ? 'Learning Active' : 'Learning Paused'}
            </span>
            {model && (
              <span className="training-badge">
                {model.training_examples} examples
              </span>
            )}
          </div>
          
          <div className="learning-status-right">
            {model?.prediction_accuracy !== undefined && (
              <span className="accuracy-badge">
                {(model.prediction_accuracy * 100).toFixed(0)}% accuracy
              </span>
            )}
            
            <FeedbackButton
              context={{
                page: pageName,
                section: 'dashboard',
              }}
              variant="minimal"
            />
          </div>
        </div>
        
        {/* Suggestions Panel */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions-panel">
            <div className="suggestions-header">
              <h4>💡 Smart Suggestions</h4>
              <button 
                className="close-btn"
                onClick={() => setShowSuggestions(false)}
              >
                ×
              </button>
            </div>
            
            <div className="suggestions-list">
              {suggestions.map((suggestion) => (
                <SuggestionCard 
                  key={suggestion.id} 
                  suggestion={suggestion} 
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Model Training Progress */}
        {trainingProgress < 100 && (
          <div className="training-progress">
            <div className="training-progress-bar">
              <div 
                className="training-progress-fill"
                style={{ width: `${trainingProgress}%` }}
              />
            </div>
            <span className="training-progress-text">
              {trainingProgress < 30 
                ? 'Learning your preferences... Keep using the dashboard!'
                : trainingProgress < 70
                ? 'Getting to know you better...'
                : 'Almost there! Personalization improving...'
              }
            </span>
          </div>
        )}
        
        {/* Main Content */}
        <div className="dashboard-content">
          {children}
        </div>
        
        {/* Personalization Debug Panel (development) */}
        {process.env.NODE_ENV === 'development' && model && (
          <div className="debug-panel">
            <summary>🐛 Learning Debug</summary>
            <pre>{JSON.stringify({
              user_id: model.user_id,
              version: model.model_version,
              accuracy: model.prediction_accuracy,
              examples: model.training_examples,
              ui_config: uiConfig,
              top_features: Object.entries(model.feature_weights || {})
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5),
            }, null, 2)}</pre>
          </div>
        )}
        
        
        <style jsx>{`
          .smart-dashboard {
            position: relative;
          }
          
          .learning-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 16px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 13px;
          }
          
          .learning-status-left {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .learning-indicator {
            font-size: 16px;
          }
          
          .learning-text {
            color: #495057;
            font-weight: 500;
          }
          
          .training-badge {
            background: #6c757d;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
          }
          
          .learning-status-right {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          
          .accuracy-badge {
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
          }
          
          .suggestions-panel {
            background: linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%);
            border: 1px solid #ffc107;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 20px;
          }
          
          .suggestions-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }
          
          .suggestions-header h4 {
            margin: 0;
            color: #856404;
            font-size: 14px;
            font-weight: 600;
          }
          
          .close-btn {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #856404;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
          }
          
          .close-btn:hover {
            background: rgba(133, 100, 4, 0.1);
          }
          
          .suggestions-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .training-progress {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
          }
          
          .training-progress-bar {
            height: 4px;
            background: #dee2e6;
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 8px;
          }
          
          .training-progress-fill {
            height: 100%;
            background: linear-gradient(135deg, #de347f 0%, #ff5d74 100%);
            transition: width 0.3s ease;
          }
          
          .training-progress-text {
            font-size: 12px;
            color: #6c757d;
          }
          
          .dashboard-content {
            /* Main dashboard content styles */
          }
          
          .debug-panel {
            margin-top: 24px;
            padding: 16px;
            background: #f8f9fa;
            border-radius: 8px;
            font-size: 12px;
          }
          
          .debug-panel pre {
            margin: 0;
            overflow-x: auto;
          }
        `}
        </style>
      </div>
    </DwellTimeTracker>
  );
}

/**
 * Individual suggestion card
 */
function SuggestionCard({ suggestion }: { suggestion: AnySuggestion }) {
  const confidenceColor = {
    high: '#22c55e',
    medium: '#f59e0b',
    low: '#6b7280',
  }[suggestion.confidence];
  
  return (
    <div className="suggestion-card">
      <div className="suggestion-confidence">
        <span 
          className="confidence-dot"
          style={{ background: confidenceColor }}
        />
        <span className="confidence-text">{suggestion.confidence}</span>
      </div>
      
      <h5 className="suggestion-title">{suggestion.title}</h5>
      <p className="suggestion-description">{suggestion.description}</p>
      
      <span className="suggestion-reason">{suggestion.reason}</span>
      
      {suggestion.action && 'handler' in suggestion.action && (
        <button 
          className="suggestion-action"
          onClick={suggestion.action.handler}
        >
          {suggestion.action.label}
        </button>
      )}
      
      <style jsx>{`
        .suggestion-card {
          background: white;
          border-radius: 8px;
          padding: 12px;
          border-left: 3px solid ${confidenceColor};
        }
        
        .suggestion-confidence {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        
        .confidence-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        
        .confidence-text {
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 600;
          color: ${confidenceColor};
        }
        
        .suggestion-title {
          margin: 0 0 4px;
          font-size: 13px;
          font-weight: 600;
          color: #212529;
        }
        
        .suggestion-description {
          margin: 0 0 8px;
          font-size: 12px;
          color: #495057;
          line-height: 1.4;
        }
        
        .suggestion-reason {
          display: block;
          font-size: 11px;
          color: #6c757d;
          font-style: italic;
        }
        
        .suggestion-action {
          margin-top: 8px;
          background: linear-gradient(135deg, #de347f 0%, #ff5d74 100%);
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        
        .suggestion-action:hover {
          transform: translateY(-1px);
        }
      `}
      </style>
    </div>
  );
}

export default SmartDashboard;
