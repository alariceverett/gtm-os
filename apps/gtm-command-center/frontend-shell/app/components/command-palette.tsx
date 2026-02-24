'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Command, Search, X, ArrowRight } from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  shortcut?: string;
  icon: typeof Search;
  action: () => void;
}

interface CommandPaletteProps {
  className?: string;
}

// Mock commands - in production these would be real actions
const mockCommands: CommandItem[] = [
  { id: '1', title: 'Create new objective', shortcut: '⌘N', icon: ArrowRight, action: () => {} },
  { id: '2', title: 'View KPIs', shortcut: '⌘K', icon: Search, action: () => {} },
  { id: '3', title: 'Add qualified account', shortcut: '⌘A', icon: ArrowRight, action: () => {} },
  { id: '4', title: 'Schedule meeting', shortcut: '⌘M', icon: ArrowRight, action: () => {} },
  { id: '5', title: 'View research ledger', shortcut: '⌘R', icon: Search, action: () => {} },
];

export function CommandPalette({ className }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const filteredCommands = mockCommands.filter((cmd) =>
    cmd.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
    setSearchQuery('');
    setSelectedIndex(0);
  }, []);
  
  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key === 'k';
      const isEscape = e.key === 'Escape';
      
      if (isCmdK) {
        e.preventDefault();
        toggleOpen();
      }
      
      if (isEscape && isOpen) {
        setIsOpen(false);
      }
      
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => 
            Math.min(prev + 1, filteredCommands.length - 1)
          );
        }
        
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        }
        
        if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          setIsOpen(false);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, toggleOpen]);
  
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'hidden sm:inline-flex items-center gap-2 px-3 py-1.5',
          'bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs',
          'rounded-lg transition-all duration-200 border border-slate-200',
          className
        )}
      >
        <Search className="h-3.5 w-3.5" />
        Search
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white text-slate-400 rounded text-[10px] border border-slate-300"
        >
          <Command className="h-3 w-3" />
          K
        </kbd>
      </button>
    );
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100"
        >
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 text-lg text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
            autoFocus
          />
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Commands list */}
        <div className="max-h-[60vh] overflow-y-auto py-2"
        >
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center"
            >
              <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No commands found</p>
            </div>
          ) : (
            filteredCommands.map((command, index) => {
              const Icon = command.icon;
              const isSelected = index === selectedIndex;
              
              return (
                <button
                  key={command.id}
                  onClick={() => {
                    command.action();
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 transition-colors duration-150',
                    isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3"
                  >
                    <Icon className={cn(
                      'h-4 w-4',
                      isSelected ? 'text-blue-600' : 'text-slate-400'
                    )} />
                    <span className={cn(
                      'text-sm font-medium',
                      isSelected ? 'text-blue-900' : 'text-slate-700'
                    )}>
                      {command.title}
                    </span>
                  </div>
                  
                  {command.shortcut && (
                    <kbd className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded border border-slate-200"
                    >
                      {command.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500"
        >
          <div className="flex items-center gap-4"
          >
            <span>Select: ↓↑</span>
            <span>Run: Enter</span>
          </div>
          
          <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </div>
  );
}
