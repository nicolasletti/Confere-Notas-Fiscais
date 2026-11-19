import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import accountRouter from "./account";
import dashboardRouter from "./dashboard";
import weeklyDashboardRouter from "./weekly-dashboard";
import replenishmentRouter from "./replenishment";
import supplierContactsRouter from "./supplier-contacts";
import generatedOrdersRouter from "./generated-orders";
import openaiRouter from "./openai";
import orderExtractionRouter from "./order-extraction";
import orderMatchesRouter from "./order-matches";
import companyRouter from "./company";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth);
router.use(accountRouter);
router.use(dashboardRouter);
router.use(weeklyDashboardRouter);
router.use(replenishmentRouter);
router.use(supplierContactsRouter);
router.use(generatedOrdersRouter);
router.use(openaiRouter);
router.use(orderExtractionRouter);
router.use(orderMatchesRouter);
router.use(companyRouter);

export default router;
