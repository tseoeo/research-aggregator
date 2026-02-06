"use client";

import { useEffect, useCallback } from "react";

interface UseKeyboardNavigationOptions {
  papers: { id: string }[];
  selectedPaperId: string | null;
  drawerOpen: boolean;
  onSelectPaper: (paperId: string | null) => void;
  onOpenDrawer: (paperId: string) => void;
  onCloseDrawer: () => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onToggleSave?: () => void;
}

export function useKeyboardNavigation({
  papers,
  selectedPaperId,
  drawerOpen,
  onSelectPaper,
  onOpenDrawer,
  onCloseDrawer,
  onNextPage,
  onPrevPage,
  onToggleSave,
}: UseKeyboardNavigationOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture when user is typing in an input/select
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      const currentIndex = papers.findIndex((p) => p.id === selectedPaperId);

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = currentIndex < papers.length - 1 ? currentIndex + 1 : 0;
          const nextPaper = papers[nextIndex];
          if (nextPaper) {
            onSelectPaper(nextPaper.id);
            if (drawerOpen) {
              onOpenDrawer(nextPaper.id);
            }
          }
          break;
        }

        case "k":
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : papers.length - 1;
          const prevPaper = papers[prevIndex];
          if (prevPaper) {
            onSelectPaper(prevPaper.id);
            if (drawerOpen) {
              onOpenDrawer(prevPaper.id);
            }
          }
          break;
        }

        case "Enter":
        case "ArrowRight": {
          if (selectedPaperId && !drawerOpen) {
            e.preventDefault();
            onOpenDrawer(selectedPaperId);
          }
          break;
        }

        case "Escape":
        case "ArrowLeft": {
          if (drawerOpen) {
            e.preventDefault();
            onCloseDrawer();
          }
          break;
        }

        case "s": {
          if (drawerOpen && onToggleSave) {
            e.preventDefault();
            onToggleSave();
          }
          break;
        }

        case "n": {
          if (!drawerOpen) {
            e.preventDefault();
            onNextPage();
          }
          break;
        }

        case "p": {
          if (!drawerOpen) {
            e.preventDefault();
            onPrevPage();
          }
          break;
        }
      }
    },
    [
      papers,
      selectedPaperId,
      drawerOpen,
      onSelectPaper,
      onOpenDrawer,
      onCloseDrawer,
      onNextPage,
      onPrevPage,
      onToggleSave,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
