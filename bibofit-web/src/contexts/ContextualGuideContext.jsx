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
        const pending =
          typeof pendingTrigger.current === 'string'
            ? { blockId: pendingTrigger.current, options: {} }
            : pendingTrigger.current;
        const blockId = pending?.blockId;
        const options = pending?.options || {};
        pendingTrigger.current = null;
        if (blockId && !ids.includes(blockId)) {
          openBlock(blockId, options);
        }
      }
    });
  }, [user?.id]);

  // ─── Core: open a block guide ─────────────────────────────────────────────────
  const openBlock = useCallback((blockId, options = {}) => {
    const block = getGuideBlock(blockId);
    if (!block) return;

    const sourceSteps = Array.isArray(block.steps) ? block.steps : [];
    let resolvedSteps = sourceSteps;

    if (Array.isArray(options.stepOrder) && options.stepOrder.length > 0) {
      const usedIndexes = new Set();
      const reordered = [];

      options.stepOrder.forEach((stepIndex) => {
        const idx = Number(stepIndex);
        if (!Number.isInteger(idx)) return;
        if (idx < 0 || idx >= sourceSteps.length) return;
        if (usedIndexes.has(idx)) return;
        usedIndexes.add(idx);
        reordered.push(sourceSteps[idx]);
      });

      sourceSteps.forEach((step, idx) => {
        if (!usedIndexes.has(idx)) reordered.push(step);
      });

      if (reordered.length > 0) resolvedSteps = reordered;
    }

    const resolvedBlock =
      resolvedSteps === sourceSteps ? block : { ...block, steps: resolvedSteps };
    const requestedStartStep = Number(options.startStep);
    const maxStep = Math.max(0, resolvedSteps.length - 1);
    const safeStartStep = Number.isInteger(requestedStartStep)
      ? Math.min(maxStep, Math.max(0, requestedStartStep))
      : 0;

    setActiveBlock(resolvedBlock);
    setCurrentStep(safeStartStep);
    setIsOpen(true);
  }, []);

  /**
   * triggerBlock — call this from any page/component on mount (or on first action).
   * It will only open the guide if the user hasn't seen this block yet.
   */
  const triggerBlock = useCallback(
    (blockId, options = {}) => {
      if (seenBlocks.has(blockId)) return;

      // DB not loaded yet → queue the trigger
      if (loadedForUser !== user?.id) {
        pendingTrigger.current = { blockId, options };
        return;
      }

      openBlock(blockId, options);
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
  const replayBlock = useCallback((blockId, options = {}) => {
    openBlock(blockId, options);
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

  /**
   * setBlockSeenState — allows manual toggle from Help Center.
   * seen=true  -> mark as seen
   * seen=false -> mark as unseen
   */
  const setBlockSeenState = useCallback(
    async (blockId, seen) => {
      if (!user?.id || !blockId) return;

      if (seen) {
        await markGuideBlockSeen(user.id, blockId);
        setSeenBlocks((prev) => new Set([...prev, blockId]));
        return;
      }

      await resetGuideBlocks(user.id, blockId);
      setSeenBlocks((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });
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
        setBlockSeenState,
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
