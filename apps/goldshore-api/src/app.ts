import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { User } from "@goldshore/schema";

const app = new OpenAPIHono();

// Example: GET /v1/users/:id
const getUserRoute = createRoute({
  method: "get",
  path: "/v1/users/{id}",
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ example: "d290f1ee-6c54-4b01-90e6-d701748f0851" }),
    }),
  },
  responses: {
    200: {
      description: "User found",
      content: {
        "application/json": {
          schema: User,
        },
      },
    },
    404: {
      description: "User not found",
    },
  },
});

app.openapi(getUserRoute, async (c) => {
  const id = c.req.param("id");
  // ... fetch from KV/DB
  const user: User = {
    id,
    email: "test@example.com",
    name: "Test User",
    role: "admin",
    createdAt: new
Date().toISOString(),
  };
  return c.json(user);
});

export default app;
