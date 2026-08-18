import express, { type ErrorRequestHandler } from "express";
import { analyzeRouter } from "./api/routes";
import { DomainError } from "./errors";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  app.use("/api", analyzeRouter);

  app.use(((error, _request, response, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
      return response.status(400).json({
        error: { code: "MALFORMED_REQUEST", message: "Request body must contain valid JSON." },
      });
    }
    if (error instanceof DomainError) {
      return response.status(error.status).json({
        error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
      });
    }
    console.error("Unhandled API error", error);
    return response.status(500).json({
      error: { code: "MINIMIZATION_ERROR", message: "An unexpected error occurred while analyzing the Boolean function." },
    });
  }) satisfies ErrorRequestHandler);

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3001);
  createApp().listen(port, () => {
    console.log(`Digital Circuits backend listening on http://localhost:${port}`);
  });
}
