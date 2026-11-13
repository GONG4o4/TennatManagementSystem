import { useState } from 'react';

const PAGE_SIZE = 10;

export function usePagination(items, resetKey = '') {
  const [pageState, setPageState] = useState({ key: '', page: 1 });
  const paginationKey = `${resetKey}:${items.length}`;
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = pageState.key === paginationKey ? pageState.page : 1;
  const currentPage = Math.min(page, pageCount);

  return {
    pageItems: items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    pagination: (
      <PaginationControls
        itemCount={items.length}
        page={currentPage}
        pageCount={pageCount}
        onPageChange={(nextPage) => setPageState({ key: paginationKey, page: nextPage })}
      />
    ),
  };
}

function PaginationControls({ itemCount, page, pageCount, onPageChange }) {
  if (itemCount <= PAGE_SIZE) return null;

  const firstItem = (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, itemCount);

  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 border-t border-purple-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">Showing {firstItem}–{lastItem} of {itemCount}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="secondary-btn !px-3 !py-2"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="px-2 text-sm text-slate-600" aria-live="polite">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          className="secondary-btn !px-3 !py-2"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
