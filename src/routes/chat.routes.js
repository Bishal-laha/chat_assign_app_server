import express from "express";
import isAuthenticated from "../middlewares/auth.middlewares.js";
import { getChatDetails, getMessages, getMyChat,sendAttachment } from "../controllers/chat.controllers.js";
import {attachmentsMulter} from "../middlewares/multer.middlewares.js";
import {sendAttachmentsValidator,validateHandler,chatIdValidator} from "../utils/validator.js";

const router = express.Router();

router.use(isAuthenticated);

router.get("/my",getMyChat);
router.post("/message",attachmentsMulter,sendAttachmentsValidator(),validateHandler,sendAttachment);
router.get("/message/:id",chatIdValidator(),validateHandler,getMessages);
router.route("/:id").get(chatIdValidator(),validateHandler,getChatDetails)

export default router;