'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Menekan Enter (di landing) => langsung ke halaman login. Diabaikan bila fokus di input.
export default function EnterToStart({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.prefetch(href);
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      router.push(href);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [href, router]);
  return null;
}
