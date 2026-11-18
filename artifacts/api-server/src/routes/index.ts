import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import orderExtractionRouter from "./order-extraction";

const router: IRouter = Router();

router.use(healthRouter);
router.use(openaiRouter);
router.use(orderExtractionRouter);

export default router;
