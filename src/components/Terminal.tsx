import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Terminal as TerminalIcon } from 'lucide-react';

interface TerminalProps {
  logs: LogEntry[];
}

export const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-deploy-card border border-deploy-border rounded-lg overflow-hidden flex flex-col h-full font-mono text-sm shadow-xl">
      <div className="bg-[#1a1a1a] p-2 border-b border-deploy-border flex items-center gap-2">
        <TerminalIcon size={14} className="text-gray-400" />
        <span className="text-gray-400 text-xs">Deployment Console</span>
      </div>
      <div className="p-4 flex-1 overflow-y-auto space-y-2 bg-black/50 min-h-[200px] max-h-[400px]">
        {logs.length === 0 && (
          <div className="text-gray-600 italic">Waiting for instructions...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2">
            <span className="text-gray-500 shrink-0">
              [{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}]
            </span>
            <span className={`break-all ${
              log.type === 'error' ? 'text-red-500' :
              log.type === 'success' ? 'text-green-500' :
              log.type === 'warning' ? 'text-yellow-500' :
              'text-gray-300'
            }`}>
              {log.type === 'info' && '> '}
              {log.message}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};