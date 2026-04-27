import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendError, requireAuth } from "../../middleware.js";
import { searchAll } from "./search.service.js";

const querySchema = z.object({
  q: z.string().max(120).optional(),
  // Comma-separated list of fields to search in.
  // Examples: "customer", "customer,project", "location,amount".
  fields: z.string().max(60).optional(),
  minAmount: z.coerce.number().nonnegative().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  currency: z.enum(["GBP", "EUR", "USD", "TRY"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

function parseFields(raw: string | undefined): {
  customer?: boolean;
  project?: boolean;
  location?: boolean;
  amount?: boolean;
} {
  if (!raw) return {};
  const tokens = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return {
    customer: tokens.includes("customer"),
    project: tokens.includes("project"),
    location: tokens.includes("location"),
    amount: tokens.includes("amount"),
  };
}

export const registerSearchRoutes: FastifyPluginAsync = async (server) => {
  // Tighter rate limit on search since it's a UI-key-throttle target.
  server.get(
    "/",
    {
      config: {
        rateLimit: { max: 60, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          code: "INVALID_REQUEST",
          message: "Search query validation failed.",
          details: parsed.error.flatten(),
        });
      }

      try {
        const result = await searchAll({
          q: parsed.data.q,
          fields: parseFields(parsed.data.fields),
          minAmount: parsed.data.minAmount,
          maxAmount: parsed.data.maxAmount,
          currency: parsed.data.currency,
          limit: parsed.data.limit,
        });
        return result;
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );
};
