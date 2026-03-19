import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getGuideBlock } from '@/config/guideBlocks';
import {
  fetchSeenGuideBlocks,
  markGuideBlockSeen,
  resetGuideBlocks,
} from '@/lib/updateSeenGuides';

const ContextualGuideContext = createContext();

export const ContextualGuideProvider = ({ children }) => {
  const { user } = useAuth();

  // Set of block IDs the user has already seen (source of truth: DB, cached here)
  const [seenBlocks, setSeenBlocks] = useState(new Set());
  const [loadedForUser, setLoadedForUser] = useState(null);

  // Currently active guide state
  const [activeBlock, setActiveBlock] = useState(null); // full block config object
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Help Center visibility
  const [isHelpCenterOpen, setIsHelpCenterOpen] = useState(false);

  // Queue: blocks can be triggered before DB load completes; hold them here
  const pendingTrigger = useRef(null);

  // ─── Load seen blocks from DB when user changes ──────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    if (loadedForUser === user.id) return;

    fetchSeenGuideBlocks(user.id).then((ids) => {
      setSeenBlocks(new Set(ids));
      setLoadedForUser(user.id);

      // Fire any trigger that arrived before the DB loaded
      if (pendingTrigger.current) {
        const blockId = pendingTrigger.current;
        pendingTrigger.current = null;
        if (!ids.includes(blockId)) {
          openBlock(blockId);
        }
      }
    });
  }, [user?.id]);

  // ─── Core: open a block guide ─────────────────────────────────────────────────
  const openBlock = useCallback((blockId) => {
    const block = getGuideBlock(blockId);
    if (!block) return;
    setActiveBlock(block);
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  /**
   * triggerBlock — call this from any page/component on mount (or on first action).
   * It will only open the guide if the user hasn't seen this block yet.
   */
  const triggerBlock = useCallback(
    (blockId) => {
      if (seenBlocks.has(blockId)) return;

      // DB not loaded yet → queue the trigger
      if (loadedForUser !== user?.id) {
        pendingTrigger.current = blockId;
        return;
      }

      openBlock(blockId);
    },
    [seenBlocks, loadedForUser, user?.id, openBlock]
  );

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const nextStep = useCallback(() => {
    if (!activeBlock) return;
    if (currentStep < activeBlock.steps.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [activeBlock, currentStep]);

  const prevStep = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  // ─── Complete / close ─────────────────────────────────────────────────────────
  const completeBlock = useCallback(async () => {
    if (!activeBlock) return;
    const blockId = activeBlock.id;

    setIsOpen(false);
    setSeenBlocks((prev) => new Set([...prev, blockId]));

    if (user?.id) {
      await markGuideBlockSeen(user.id, blockId);
    }
  }, [activeBlock, user?.id]);

  const closeBlock = useCallback(() => {
    setIsOpen(false);
  }, []);

  // ─── Help Center controls ─────────────────────────────────────────────────────
  const openHelpCenter = useCallback(() => setIsHelpCenterOpen(true), []);
  const closeHelpCenter = useCallback(() => setIsHelpCenterOpen(false), []);

  /**
   * replayBlock — opens a block guide from the Help Center regardless of seen state.
   */
  const replayBlock = useCallback((blockId) => {
    openBlock(blockId);
  }, [openBlock]);

  /**
   * resetBlock — marks a block as unseen (used from Help Center).
   * Pass null to reset all blocks.
   */
  const resetBlock = useCallback(
    async (blockId = null) => {
      if (!user?.id) return;
      await resetGuideBlocks(user.id, blockId);

      if (blockId) {
        setSeenBlocks((prev) => {
          const next = new Set(prev);
          next.delete(blockId);
          return next;
        });
      } else {
        setSeenBlocks(new Set());
      }
    },
    [user?.id]
  );

  return (
    <ContextualGuideContext.Provider
      value={{
        // State
        isOpen,
        activeBlock,
        currentStep,
        seenBlocks,
        isHelpCenterOpen,
        // Actions
        triggerBlock,
        replayBlock,
        resetBlock,
        nextStep,
        prevStep,
        completeBlock,
        closeBlock,
        openHelpCenter,
        closeHelpCenter,
      }}
    >
      {children}
    </ContextualGuideContext.Provider>
  );
};

export const useContextualGuide = () => useContext(ContextualGuideContext);
