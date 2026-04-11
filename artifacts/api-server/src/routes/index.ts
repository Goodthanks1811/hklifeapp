import { Router, type IRouter } from "express";
import healthRouter from "./health";
import itipfootyRouter from "./itipfooty";
import notionRouter from "./notion";
import nrlRouter from "./nrl";
import trainingRouter from "./training";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/itipfooty", itipfootyRouter);
router.use("/notion", notionRouter);
router.use("/nrl", nrlRouter);
router.use("/training", trainingRouter);

export default router;
