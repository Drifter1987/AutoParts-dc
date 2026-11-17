import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { trackEvent } from '../../services/telemetry';

interface ShareButtonProps {
  label?: string;
  className?: string;
}

export default function ShareButton({ label = 'Share', className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        trackEvent('share_sheet_opened', { path: window.location.pathname });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackEvent('share_link_copied', { path: window.location.pathname });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className={className || 'btn btn-ghost'} onClick={share}>
      {copied ? <Check size={14} /> : <Share2 size={14} />}
      {copied ? 'Link copied' : label}
    </button>
  );
}
