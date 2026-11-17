import { useEffect } from 'react';

export function usePageMetadata(title: string, description: string): void {
  useEffect(() => {
    document.title = title;
    document
      .head
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', description);
  }, [title, description]);
}
