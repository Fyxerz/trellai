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
 * Creates an in-process MCP server scoped to a card for development.
 * Provides the report_test_results tool so agents can report test outcomes.
 */
export function createDevMcpServer(cardId: string) {
  return createSdkMcpServer({
    name: "trellai-dev",
    version: "1.0.0",
    tools: [
      tool(
        "report_test_results",
        "Report the results of running tests. Call this after running the test suite to record which tests passed and which failed. Each test should have a name and status.",
        {
          tests: z.array(
            z.object({
              name: z.string().describe("Test name or description"),
              status: z.enum(["passed", "failed", "skipped"]).describe("Test outcome"),
              error: z.string().optional().describe("Error message if the test failed"),
            })
          ).describe("Array of individual test results"),
        },
        async (args) => {
          const passed = args.tests.filter((t) => t.status === "passed").length;
          const failed = args.tests.filter((t) => t.status === "failed").length;
          const skipped = args.tests.filter((t) => t.status === "skipped").length;
          const total = args.tests.length;

          const testStatus = failed > 0 ? "failed" : passed > 0 ? "passed" : "no_tests";
          const testResults = JSON.stringify({
            passed,
            failed,
            skipped,
            total,
            tests: args.tests,
          });

          db.update(cards)
            .set({
              testStatus,
              testResults,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(cards.id, cardId))
            .run();

          try {
            emitToCard(cardId, "card:test-results", {
              cardId,
              testStatus,
              testResults: JSON.parse(testResults),
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
                  summary: `${passed} passed, ${failed} failed, ${skipped} skipped out of ${total} tests`,
                  testStatus,
                }),
              },
            ],
          };
        },
        {
          annotations: {
            title: "Report Test Results",
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

          // Set card status to awaiting_feedback so the board shows a badge
          try {
            db.update(cards)
              .set({ agentStatus: "awaiting_feedback", updatedAt: new Date().toISOString() })
              .where(eq(cards.id, cardId))
              .run();
            emitToCard(cardId, "agent:status", {
              cardId,
              status: "awaiting_feedback",
            });
          } catch {
            // DB/socket may not be available
          }

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
            const answer = await waitForAnswer(questionId, {
              cardId,
              question: args.question,
              options: args.options,
            });

            // Restore card status to running after answer received
            try {
              db.update(cards)
                .set({ agentStatus: "running", updatedAt: new Date().toISOString() })
                .where(eq(cards.id, cardId))
                .run();
              emitToCard(cardId, "agent:status", {
                cardId,
                status: "running",
              });
            } catch {
              // DB/socket may not be available
            }

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
      tool(
        "mark_ready",
        "Signal that the planning phase is complete and the card is ready for development. Use this when you and the user agree that the spec is finalized and implementation can begin.",
        {
          summary: z
            .string()
            .describe(
              "Brief summary of what was planned and is ready for development"
            ),
        },
        async (args) => {
          try {
            db.update(cards)
              .set({
                agentStatus: "ready_for_dev",
                updatedAt: new Date().toISOString(),
              })
              .where(eq(cards.id, cardId))
              .run();
            emitToCard(cardId, "agent:status", {
              cardId,
              status: "ready_for_dev",
            });
          } catch {
            // DB/socket may not be available
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  status: "ready_for_dev",
                  summary: args.summary,
                }),
              },
            ],
          };
        },
        {
          annotations: {
            title: "Mark Ready for Development",
            readOnlyHint: false,
          },
        }
      ),
    ],
  });
}
