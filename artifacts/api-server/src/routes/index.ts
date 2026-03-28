import { Router, type IRouter } from "express";
import healthRouter from "./health";
import notionRouter from "./notion";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/notion", notionRouter);

export default router;
