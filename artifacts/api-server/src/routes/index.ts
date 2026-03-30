import { Router, type IRouter } from "express";
import healthRouter from "./health";
import notionRouter from "./notion";
import nrlRouter from "./nrl";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/notion", notionRouter);
router.use("/nrl", nrlRouter);

export default router;
