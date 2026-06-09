/**
 * Cloud sync for recurring templates + per-day completions.
 *
 * Strategy (mirrors useCloudGoals):
 *  - On mount with userId: pull templates from cloud.
 *    • Cloud has data → write to localStorage (cloud wins / multi-device).
 *    • Cloud empty + local has data → push local up (first-time migration).
 *  - Pull today's completions from cloud → apply to localStorage silently,
 *    then fire one RECURRING_CHANGED to refresh any mounted UIs.
 *  - Returns helpers (pushTemplateOp, deleteTemplateOp, pushCompletionOp)
 *    so pages can fire-and-forget individual record writes after each mutation.
 *
 * A sessionStorage flag prevents re-running the initial pull on re-renders.
 */

import { useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  bulkPushTemplates,
  deleteCloudTemplate,
  pullCompletions,
  pullTemplates,
  pushCompletion,
  pushTemplate,
} from "@/lib/recurringRepo";
import {
  loadTemplates,
  RECURRING_CHANGED,
  saveTemplates,
  setRecurringCompletedSilent,
  setRecurringSkippedSilent,
} from "@/lib/recurring";

const SYNCED_FLAG = "alfred.recurring.cloud_synced";

export function useRecurringSync(userId: string | null | undefined) {
  const pulledRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (pulledRef.current) return;
    pulledRef.current = true;

    const today = format(new Date(), "yyyy-MM-dd");
    const alreadySynced = sessionStorage.getItem(SYNCED_FLAG) === userId;

    // ── Templates ────────────────────────────────────────────────
    pullTemplates(userId)
      .then((cloud) => {
        if (cloud.length > 0) {
          // Cloud has templates — it's the source of truth
          saveTemplates(cloud); // fires RECURRING_CHANGED
        } else if (!alreadySynced) {
          // Cloud is empty — migrate local data up
          const local = loadTemplates();
          if (local.length > 0) {
            bulkPushTemplates(userId, local).catch(console.error);
          }
        }
        sessionStorage.setItem(SYNCED_FLAG, userId);
      })
      .catch(console.error);

    // ── Today's completions ───────────────────────────────────────
    pullCompletions(userId, today)
      .then((records) => {
        records.forEach((r) => {
          if (r.completed) setRecurringCompletedSilent(r.templateId, r.dateStr, true);
          if (r.skipped) setRecurringSkippedSilent(r.templateId, r.dateStr, true);
        });
        if (records.length > 0) {
          window.dispatchEvent(new CustomEvent(RECURRING_CHANGED));
        }
      })
      .catch(console.error);
  }, [userId]);

  /** Push one template to the cloud after a local save. */
  const pushTemplateOp = useCallback(
    (t: import("@/lib/recurring").RecurringTemplate) => {
      if (!userId) return;
      pushTemplate(userId, t).catch(console.error);
    },
    [userId],
  );

  /** Delete one template from the cloud after a local delete. */
  const deleteTemplateOp = useCallback(
    (clientId: string) => {
      if (!userId) return;
      deleteCloudTemplate(userId, clientId).catch(console.error);
    },
    [userId],
  );

  /** Push a completion / skip record to the cloud after a local toggle. */
  const pushCompletionOp = useCallback(
    (templateId: string, dateStr: string, completed: boolean, skipped: boolean) => {
      if (!userId) return;
      const completedAt = completed ? new Date().toISOString() : undefined;
      pushCompletion(userId, templateId, dateStr, completed, skipped, completedAt).catch(
        console.error,
      );
    },
    [userId],
  );

  return { pushTemplateOp, deleteTemplateOp, pushCompletionOp };
}
