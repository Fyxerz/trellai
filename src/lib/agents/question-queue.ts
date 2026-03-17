/**
 * In-memory queue for pending questions from Claude agents.
 * When the ask_question MCP tool is called, it creates a promise
 * that blocks until the user answers via the UI.
 */

interface PendingQuestion {
  resolve: (answer: string) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  cardId: string;
  question: string;
  options: string[];
}

const pendingQuestions = new Map<string, PendingQuestion>();

/**
 * Get the pending question for a specific card, if any.
 * Used by the API to restore question state when the popup is reopened.
 */
export function getPendingQuestionForCard(cardId: string): {
  questionId: string;
  question: string;
  options: string[];
} | null {
  for (const [questionId, pending] of pendingQuestions) {
    if (pending.cardId === cardId) {
      return {
        questionId,
        question: pending.question,
        options: pending.options,
      };
    }
  }
  return null;
}

/** 10-minute timeout for unanswered questions */
const QUESTION_TIMEOUT_MS = 600_000;

/**
 * Wait for a user answer to a question. Returns a promise that resolves
 * when submitAnswer() is called with the matching questionId.
 */
export function waitForAnswer(
  questionId: string,
  metadata?: { cardId: string; question: string; options: string[] }
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (pendingQuestions.has(questionId)) {
        pendingQuestions.delete(questionId);
        reject(new Error("Question timed out after 10 minutes"));
      }
    }, QUESTION_TIMEOUT_MS);

    pendingQuestions.set(questionId, {
      resolve,
      reject,
      timeout,
      cardId: metadata?.cardId || "",
      question: metadata?.question || "",
      options: metadata?.options || [],
    });
  });
}

/**
 * Submit a user's answer to a pending question.
 * Called from the API route when the user clicks an option or types a response.
 */
export function submitAnswer(questionId: string, answer: string): boolean {
  const pending = pendingQuestions.get(questionId);
  if (!pending) return false;

  clearTimeout(pending.timeout);
  pending.resolve(answer);
  pendingQuestions.delete(questionId);
  return true;
}

/**
 * Cancel all pending questions for cleanup (e.g., when agent stops).
 */
export function cancelPendingQuestions(questionId?: string): void {
  if (questionId) {
    const pending = pendingQuestions.get(questionId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Question cancelled"));
      pendingQuestions.delete(questionId);
    }
  } else {
    for (const [id, pending] of pendingQuestions) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Question cancelled"));
      pendingQuestions.delete(id);
    }
  }
}
