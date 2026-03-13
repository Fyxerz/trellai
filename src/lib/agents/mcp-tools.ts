import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { emitToProject, emitToCard } from "@/lib/socket";
import { waitForAnswer } from "./question-queue";

/**
 * Creates an in-process MCP server scoped to a project.
 * Provides board management tools (e.g. create_card) that Claude
 * can invoke as structured function calls instead of fragile text markers.
 */
export function createBoardMcpServer(projectId: string) {
  return createSdkMcpServer({
    name: "trellai-board",
    version: "1.0.0",
    tools: [
      tool(
        "create_card",
        "Create a new card in the project backlog (features column). Use this when the user asks you to create tasks, features, or fixes on the board.",
        {
          title: z.string().describe("Short title for the card"),
          description: z
            .string()
            .describe("Detailed description of what needs to be done"),
          type: z
            .enum(["feature", "fix"])
            .default("feature")
            .describe("Card type — feature for new functionality, fix for bugs"),
        },
        async (args) => {
          const id = uuid();
          const now = new Date().toISOString();

          // Calculate next position in features column
          const existing = db
            .select()
            .from(cards)
            .where(eq(cards.projectId, projectId))
            .all();
          const featureCards = existing.filter((c) => c.column === "features");
          const maxPos = featureCards.reduce(
            (max, c) => Math.max(max, c.position),
            -1
          );

          db.insert(cards)
            .values({
              id,
              projectId,
              title: args.title,
              description: args.description || "",
              type: args.type === "fix" ? "fix" : "feature",
              column: "features",
              position: maxPos + 1,
              agentStatus: "idle",
              createdAt: now,
              updatedAt: now,
            })
            .run();

          // Notify frontend so board refreshes
          try {
            emitToProject(projectId, "project:card-created", {
              projectId,
              count: 1,
            });
          } catch {
            // Socket may not be available
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  id,
                  title: args.title,
                  column: "features",
                }),
              },
            ],
          };
        },
        {
          annotations: {
            title: "Create Board Card",
            readOnlyHint: false,
          },
        }
      ),
    ],
  });
}

/**
 * Creates an in-process MCP server scoped to a card.
 * Provides the ask_question tool so agents can ask structured
 * questions with selectable options (CLI-style interaction).
 */
export function createQuestionMcpServer(cardId: string) {
  return createSdkMcpServer({
    name: "trellai-questions",
    version: "1.0.0",
    tools: [
      tool(
        "ask_question",
        "Ask the user a clarifying question with predefined answer options. Use this whenever you need user input to proceed. Always provide 2-3 specific options. The user will also be able to write a custom response. Ask ONE question at a time — do not batch multiple questions into one call.",
        {
          question: z.string().describe("The question to ask the user"),
          options: z
            .array(z.string())
            .min(1)
            .max(5)
            .describe(
              "Predefined answer options (2-3 recommended). Keep each option concise but descriptive."
            ),
        },
        async (args) => {
          const questionId = uuid();

          // Emit the question to the frontend via socket
          try {
            emitToCard(cardId, "agent:question", {
              cardId,
              questionId,
              question: args.question,
              options: args.options,
            });
          } catch {
            // Socket may not be available
          }

          // Block until the user answers (or timeout)
          try {
            const answer = await waitForAnswer(questionId);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    answered: true,
                    question: args.question,
                    answer,
                  }),
                },
              ],
            };
          } catch (err) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    answered: false,
                    question: args.question,
                    error:
                      err instanceof Error ? err.message : "Unknown error",
                  }),
                },
              ],
            };
          }
        },
        {
          annotations: {
            title: "Ask User Question",
            readOnlyHint: true,
          },
        }
      ),
    ],
  });
}
