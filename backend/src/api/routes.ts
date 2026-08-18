import { Router } from "express";
import { analyzeBooleanFunction } from "./analyze";

export const analyzeRouter = Router();

analyzeRouter.post("/analyze", (request, response, next) => {
  try {
    return response.status(200).json(analyzeBooleanFunction(request.body));
  } catch (error) {
    return next(error);
  }
});
