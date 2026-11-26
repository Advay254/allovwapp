import { useEffect } from 'react';
import { PRODUCT_NAME } from '@allov/shared';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} | ${PRODUCT_NAME}`;
  }, [title]);
}
