'use client';

/**
 * Conversation Thread
 * Right-side panel (collapsible)
 * Chat history of all commands/actions
 * Can branch/modify previous commands
 * References back to results
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThreadItem, CommandIntent, Prospect, ResearchJob } from '@/types';
import { parseCommand } from '@/lib/nlp/command-parser';

interface ThreadPanelProps {
  items: ThreadItem[];
  isOpen: boolean;
  onToggle: () => void;
  onBranch?: (itemId: string, newCommand: string) => void;
  onModify?: (itemId: string, modifiedIntent: CommandIntent) => void;
  onReference?: (itemId: string) => void;
}

interface ThreadItemProps {
  item: ThreadItem;
  onBranch?: (itemId: string, newCommand: string) => void;
  onModify?: (itemId: string, modifiedIntent: CommandIntent) => void;
  onReference?: (itemId: string) => void;
  isLast?: boolean;
}

// Icon mapping by thread item type
const TYPE_ICONS: Record<ThreadItem['type'], string> = {
  command: '💬',
  result: '✨',
  suggestion: '💡',
  action: '🎯',
  system: '🔔',
};

// Type colors
const TYPE_COLORS: Record<ThreadItem['type'], string> = {
  command: 'text-indigo-400',
  result: 'text-emerald-400',
  suggestion: 'text-amber-400',
  action: 'text-blue-400',
  system: 'text-slate-400',
};

function ResultPreview({ 
  data,
  onReference 
}: { 
  data: { job?: ResearchJob; prospects?: Prospect[] };
  onReference?: () => void;
}) {
  const { job, prospects } = data;
  const displayProspects = prospects || job?.results || [];

  if (displayProspects.length === 0) return null;

  return (
    <div>
      <div className="text-xs text-slate-500 mb-2">
        {job?.status === 'completed' ? 'Completed' : 'In progress'} – {displayProspects.length} prospects
      </div>
      
      <div className="space-y-1">
        {displayProspects.slice(0, 3).map((p) => (
          <div 
            key={p.id}
            className="flex items-center gap-2 text-xs"
          >
            <span className={`
              w-2 h-2 rounded-full
              ${p.scoreGrade === 'A+' ? 'bg-emerald-400' :
                p.scoreGrade === 'A' ? 'bg-emerald-300' :
                p.scoreGrade === 'B+' ? 'bg-blue-400' :
                'bg-slate-400'}
            `} />
            <span className="text-slate-300 truncate">{p.name}</span>
            <span className="text-slate-500">@ {p.company}</span>
          </div>
        ))}
        {displayProspects.length > 3 && (
          <div className="text-xs text-slate-600">+{displayProspects.length - 3} more...</div>
        )}
      </div>

      <button
        onClick={onReference}
        className="mt-2 text-xs px-2 py-1 rounded bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors"
      >
        📎 Reference this result
      </button>
    </div>
  );
}

// Intent breakdown component
function IntentBreakdown({ intent }: { intent: ReturnType<typeof parseCommand> }) {
  return (
    <div className="text-xs">
      <div className="text-slate-500 mb-1">Parsed Intent:</div>
      
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-slate-600">Action:</span>
          <span className="text-indigo-400">{intent.action}</span>
        </div>

        {intent.icp?.titles && intent.icp.titles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Titles:</span>
            <span className="text-emerald-400">{intent.icp.titles.join(', ')}</span>
          </div>
        )}

        {intent.icp?.industries && intent.icp.industries.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Industries:</span>
            <span className="text-emerald-400">{intent.icp.industries.join(', ')}</span>
          </div>
        )}

        {intent.icp?.locations && intent.icp.locations.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Locations:</span>
            <span className="text-amber-400">{intent.icp.locations.join(', ')}</span>
          </div>
        )}

        {intent.icp?.signals && intent.icp.signals.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Signals:</span>
            <span className="text-amber-400">{intent.icp.signals.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadMessage({ 
  item, 
  onBranch, 
  onModify, 
  onReference,
  isLast 
}: ThreadItemProps) {
  const [isExpanded, setIsExpanded] = useState(isLast);
  const [showActions, setShowActions] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Parse intent if this is a command
  const parsedIntent = item.type === 'command' 
    ? parseCommand(item.content)
    : null;

  const handleModify = () => {
    if (editMode && editValue.trim()) {
      const newIntent = parseCommand(editValue);
      onModify?.(item.id, newIntent);
      setEditMode(false);
    } else {
      setEditValue(item.content);
      setEditMode(true);
    }
  };

  const isCommand = item.type === 'command';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative pl-6"
    >
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-2 top-8 bottom-0 w-px bg-slate-800" />
      )}
      
      {/* Node */}
      <motion.div
        whileHover={{ scale: 1.2 }}
        className={`absolute left-0 top-2 w-4 h-4 rounded-full flex items-center justify-center text-xs bg-slate-900 border border-slate-700 ${
          item.isModified ? 'border-amber-500/50' : ''
        }`}
      >
        {item.isModified ? '✏️' : TYPE_ICONS[item.type]}
      </motion.div>

      {/* Content */}
      <div 
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        className="pb-4"
      >
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-3 rounded-xl bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800/50 transition-colors cursor-pointer"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${TYPE_COLORS[item.type]}`}>
                {item.type.toUpperCase()}
              </span>
              
              {parsedIntent && parsedIntent.confidence > 0.3 && (
                <span className="text-xs text-slate-600">
                  {Math.round(parsedIntent.confidence * 100)}%
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {showActions && isCommand && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onBranch?.(item.id, '');
                    }}
                    className="text-xs px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors"
                  >
                    Branch
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModify();
                    }}
                    className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                  >
                    {editMode ? 'Save' : 'Edit'}
                  </button>
                </>
              )}
              
              <span className="text-xs text-slate-600">
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Edit mode */}
          {editMode ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleModify();
                if (e.key === 'Escape') {
                  setEditMode(false);
                  setEditValue('');
                }
              }}
              autoFocus
              className="w-full bg-transparent text-sm text-slate-200 outline-none border-b border-indigo-500"
            />
          ) : (
            <div className="text-sm text-slate-300">{item.content}</div>
          )}
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && Boolean(item.data) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 ml-3 p-3 rounded-lg bg-slate-800/50 border border-slate-800"
              >
                {item.type === 'result' && Boolean(item.data) && (
                  <ResultPreview 
                    data={item.data as { job?: ResearchJob; prospects?: Prospect[] }} 
                    onReference={() => onReference?.(item.id)}
                  />
                )}

                {item.type === 'command' && parsedIntent && (
                  <IntentBreakdown intent={parsedIntent} />
                )}

                {item.branchIds && item.branchIds.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500"
                    >
                      Branched to: {item.branchIds.length} variations
                    </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function ThreadPanel({ 
  items, 
  isOpen, 
  onToggle, 
  onBranch, 
  onModify, 
  onReference 
}: ThreadPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new items
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items.length]);

  return (
    <>
      {/* Toggle button (visible when closed) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onClick={onToggle}
            className="fixed right-4 top-24 z-40 p-3 rounded-full bg-slate-900 border border-slate-700 shadow-lg hover:bg-slate-800 transition-colors"
          >
            <span className="text-xl">🕐</span>
            {items.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center"
              >
                {items.length}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main panel */}
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ 
          width: isOpen ? 380 : 0, 
          opacity: isOpen ? 1 : 0 
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 bottom-0 z-40 border-l border-slate-800 bg-slate-950/95 backdrop-blur-xl overflow-hidden"
      >
        {isOpen && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800"
              >
              <div className="flex items-center gap-2"
                >
                <span className="text-xl">🕐</span>
            
                <h2 className="font-semibold text-slate-200">Thread History</h2>
            
                {items.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400"
                  >
                    {items.length} items
                  </span>
              )}
              </div>

              <button
                onClick={onToggle}
                className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Thread content */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4"
              style={{ height: 'calc(100vh - 65px)' }}
              
            >
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center"
                >
                  <span className="text-4xl mb-4">🕐</span>
                  <p className="text-slate-500">No conversation yet.</p>
                  <p className="text-sm text-slate-600 mt-1"
                  >Start typing in the command bar!
                  </p>
                </div>
              ) : (
                <div className="space-y-0"
                >
                  {items.map((item, idx) => (
                    <ThreadMessage
                      key={item.id}
                      item={item}
                      onBranch={onBranch}
                      onModify={onModify}
                      onReference={onReference}
                      isLast={idx === items.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}
