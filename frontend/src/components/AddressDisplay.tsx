import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface AddressDisplayProps {
  address: string;
  shorten?: boolean;
  showExplorer?: boolean;
  className?: string;
}

export function AddressDisplay({ address, shorten = true, showExplorer = true, className = '' }: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const display = shorten ? `${address.slice(0, 4)}...${address.slice(-4)}` : address;

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm ${className}`}>
      <span className="text-gray-300">{display}</span>
      <button onClick={handleCopy} className="text-gray-600 hover:text-gray-400 transition-colors">
        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      </button>
      {showExplorer && (
        <a
          href={`https://solscan.io/account/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-brand-400 transition-colors"
        >
          <ExternalLink size={12} />
        </a>
      )}
    </span>
  );
}
