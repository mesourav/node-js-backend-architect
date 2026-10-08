import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import * as controller from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.schema";

const router = Router();

router.post("/register", validate({ body: registerSchema }), controller.register);
router.post("/login", validate({ body: loginSchema }), controller.login);
// refresh/logout identify the session by the cookie, not by an access token:
// they must work even after the access token has expired.
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.post("/logout-all", authenticate, controller.logoutAll);
router.get("/me", authenticate, controller.me);

export default router;
